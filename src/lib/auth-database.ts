import { AsyncLocalStorage } from "node:async_hooks"
import { createHash, randomUUID } from "node:crypto"
import { Pool, type PoolClient } from "pg"

// Better Auth 1.6.9 reads, updates, and deletes reset state separately.
// Keep its queries on one transaction and serialize token use across workers.
export function createAuthDatabase(pool: Pool, rateLimitPool: Pool = pool) {
  const transaction = new AsyncLocalStorage<{
    client: PoolClient
    failed: boolean
    verifiedHash?: string
  }>()

  async function query(text: string, values: unknown[] = []) {
    const state = transaction.getStore()
    try {
      return await (state?.client ?? pool).query(text, values)
    } catch (error) {
      if (state) state.failed = true
      throw error
    }
  }
  const database = new Proxy(pool, {
    get(target, property) {
      if (property === "connect") {
        return async () => {
          const state = transaction.getStore()
          if (!state) return pool.connect()
          return new Proxy(state.client, {
            get(target, property) {
              if (property === "release") return () => {}
              if (property === "query") return query
              const value = Reflect.get(target, property)
              return typeof value === "function" ? value.bind(target) : value
            },
          })
        }
      }
      const value = Reflect.get(target, property)
      return typeof value === "function" ? value.bind(target) : value
    },
  })

  async function run<T>(
    operation: () => Promise<T>,
    ok: (value: T) => boolean,
    token?: string
  ) {
    const client = await pool.connect()
    let broken = false
    try {
      if ((await client.query("BEGIN")).command !== "BEGIN")
        throw new Error("Authentication transaction did not begin")
      await client.query("SET LOCAL lock_timeout = '5s'")
      if (token !== undefined) {
        const digest = createHash("sha256").update(token).digest()
        await client.query("SELECT pg_advisory_xact_lock($1, $2)", [
          digest.readInt32BE(0),
          digest.readInt32BE(4),
        ])
      }
      const state = { client, failed: false }
      const result = await transaction.run(state, operation)
      // Library code may catch a query rejection. Never commit that operation.
      if (state.failed) throw new Error("Authentication transaction failed")
      const command = ok(result) ? "COMMIT" : "ROLLBACK"
      if ((await client.query(command)).command !== command)
        throw new Error("Unexpected authentication transaction result")
      return result
    } catch (error) {
      try {
        if ((await client.query("ROLLBACK")).command !== "ROLLBACK")
          broken = true
      } catch {
        broken = true
      }
      throw error
    } finally {
      client.release(broken)
    }
  }

  function rememberVerifiedHash(hash: string) {
    const state = transaction.getStore()
    if (state) state.verifiedHash = hash
  }

  async function credentialIsCurrent(userId: string) {
    const state = transaction.getStore()
    if (!state?.verifiedHash) return false
    // SHARE conflicts with the reset's UPDATE until session issuance commits.
    // READ COMMITTED sees a reset that committed while password verification ran.
    const result = await query(
      'SELECT password FROM account WHERE "userId" = $1 AND "providerId" = \'credential\' FOR SHARE',
      [userId]
    )
    return (
      result.rows.length === 1 && result.rows[0].password === state.verifiedHash
    )
  }

  // Supported Better Auth customStorage: propagate errors and use UPSERT rather
  // than the built-in read/create race. An independent pool preserves counters
  // on credential rollback and cannot starve the credential connection pool.
  // Recovery admission uses allow() below, before any credential transaction.
  async function rateLimitQuery(text: string, values: unknown[]) {
    try {
      return await rateLimitPool.query(text, values)
    } catch (error) {
      const state = transaction.getStore()
      if (state) state.failed = true
      throw error
    }
  }
  const rateLimitStorage = {
    async get(key: string) {
      const result = await rateLimitQuery(
        'SELECT key, count, "lastRequest" FROM "rateLimit" WHERE key=$1',
        [key]
      )
      const row = result.rows[0]
      return row ? { ...row, lastRequest: Number(row.lastRequest) } : null
    },
    async set(key: string, value: { count: number; lastRequest: number }) {
      const windowMs = /\|\/(request-password-reset|reset-password)$/.test(key)
        ? 60_000
        : 10_000
      await rateLimitQuery(
        `INSERT INTO "rateLimit" (id,key,count,"lastRequest") VALUES ($1,$2,1,$3)
         ON CONFLICT (key) DO UPDATE SET
           count = CASE WHEN "rateLimit"."lastRequest" <= $3 - $4 THEN 1 ELSE "rateLimit".count + 1 END,
           "lastRequest" = $3`,
        [randomUUID(), key, value.lastRequest, windowMs]
      )
    },
  }

  // Atomic fixed-window counters use Better Auth's own rateLimit model.
  // No email addresses, passwords, or reset tokens are persisted here.
  async function allow(key: string, max: number, windowMs: number) {
    const result = await pool.query(
      `INSERT INTO "rateLimit" (id, key, count, "lastRequest")
       VALUES ($1, $2, 1, $3)
       ON CONFLICT (key) DO UPDATE SET
         count = CASE WHEN "rateLimit"."lastRequest" <= $3 - $4 THEN 1 ELSE "rateLimit".count + 1 END,
         "lastRequest" = CASE WHEN "rateLimit"."lastRequest" <= $3 - $4 THEN $3 ELSE "rateLimit"."lastRequest" END
       WHERE "rateLimit"."lastRequest" <= $3 - $4 OR "rateLimit".count < $5
       RETURNING count`,
      [randomUUID(), key, Date.now(), windowMs, max]
    )
    return result.rowCount === 1
  }

  return {
    database,
    allow,
    rateLimitStorage,
    rememberVerifiedHash,
    credentialIsCurrent,
    login: run,
    reset: <T>(
      token: string,
      operation: () => Promise<T>,
      ok: (value: T) => boolean
    ) => run(operation, ok, token),
  }
}
