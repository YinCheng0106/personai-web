import { AsyncLocalStorage } from "node:async_hooks"
import { createHash, randomUUID } from "node:crypto"
import { Pool, type PoolClient } from "pg"

// Better Auth 1.6.9 reads, updates, and deletes reset state separately.
// Keep its queries on one transaction and serialize token use across workers.
export function createAuthDatabase(pool: Pool) {
  const transaction = new AsyncLocalStorage<PoolClient>()
  const database = new Proxy(pool, {
    get(target, property) {
      if (property === "connect") {
        return async () => {
          const client = transaction.getStore()
          if (!client) return pool.connect()
          return new Proxy(client, {
            get(target, property) {
              if (property === "release") return () => {}
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

  async function reset<T>(
    token: string,
    operation: () => Promise<T>,
    ok: (value: T) => boolean
  ) {
    const client = await pool.connect()
    try {
      await client.query("BEGIN")
      await client.query("SET LOCAL lock_timeout = '5s'")
      const digest = createHash("sha256").update(token).digest()
      await client.query("SELECT pg_advisory_xact_lock($1, $2)", [
        digest.readInt32BE(0),
        digest.readInt32BE(4),
      ])
      const result = await transaction.run(client, operation)
      await client.query(ok(result) ? "COMMIT" : "ROLLBACK")
      return result
    } catch (error) {
      await client.query("ROLLBACK")
      throw error
    } finally {
      client.release()
    }
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

  return { database, reset, allow }
}
