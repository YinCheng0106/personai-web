// @vitest-environment node
import { randomUUID } from "node:crypto"
import { spawn } from "node:child_process"
import { fileURLToPath } from "node:url"
import { Pool } from "pg"
import { getMigrations } from "better-auth/db/migration"
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest"
import { createPersonaiAuth } from "@/lib/auth"
import { createAuthDatabase } from "@/lib/auth-database"
import type { ResetEmail } from "@/lib/reset-email"

const adminURL = process.env.PERSONAI_AUTH_TEST_DATABASE_URL
const suite = adminURL ? describe : describe.skip

suite("Better Auth 1.6.9 reset with PostgreSQL and mocked delivery", () => {
  const databaseName = `personai_test_reset_${randomUUID().replaceAll("-", "")}`
  let admin: Pool
  let pool: Pool
  let replicaPool: Pool
  let auth: ReturnType<typeof createPersonaiAuth>
  let replica: ReturnType<typeof createPersonaiAuth>
  let email: string
  let cookie: string
  const delivery = vi.fn<(email: ResetEmail) => Promise<void>>()
  const jobs: Promise<unknown>[] = []
  const background = (promise: Promise<unknown>) => {
    jobs.push(promise)
  }
  const instances: ReturnType<typeof createPersonaiAuth>[] = []
  function makeAuth(options: Parameters<typeof createPersonaiAuth>[0]) {
    const instance = createPersonaiAuth(options)
    instances.push(instance)
    return instance
  }

  beforeAll(async () => {
    const url = new URL(adminURL!)
    if (
      !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
      url.pathname !== "/personai_test" ||
      url.search
    )
      throw new Error("Requires dedicated local personai_test database")
    admin = new Pool({ connectionString: adminURL })
    await admin.query(`CREATE DATABASE "${databaseName}"`)
    url.pathname = `/${databaseName}`
    pool = new Pool({
      connectionString: url.href,
      options: "-c search_path=personai_auth",
      max: 8,
    })
    replicaPool = new Pool({
      connectionString: url.href,
      options: "-c search_path=personai_auth",
      max: 8,
    })
    await pool.query("CREATE SCHEMA personai_auth")
    auth = makeAuth({ pool, deliver: delivery, background })
    replica = makeAuth({
      pool: replicaPool,
      deliver: delivery,
      background,
    })
    await (await getMigrations(auth.options)).runMigrations()
  }, 30_000)

  afterAll(async () => {
    await Promise.all(jobs)
    await Promise.all(instances.map((instance) => instance.close()))
    await pool?.end()
    await replicaPool?.end()
    if (admin) {
      await admin.query(
        `DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`
      )
      await admin.end()
    }
  })

  async function post(path: string, body: unknown, instance = auth) {
    return instance.handler(
      new Request(`http://localhost:3000/api/auth/${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://localhost:3000",
        },
        body: JSON.stringify(body),
      })
    )
  }
  const requestReset = (
    address = email,
    redirectTo = "http://localhost:3000/reset-password"
  ) => post("request-password-reset", { email: address, redirectTo })
  async function token() {
    const response = await requestReset()
    expect(response.status).toBe(200)
    await Promise.all(jobs)
    expect(delivery).toHaveBeenCalledTimes(1)
    return delivery.mock.calls[0][0].token
  }
  const reset = (
    value: string,
    newPassword = "NewPassword123!",
    instance = auth
  ) => post("reset-password", { token: value, newPassword }, instance)

  beforeEach(async () => {
    await Promise.all(jobs)
    jobs.length = 0
    delivery.mockReset().mockResolvedValue(undefined)
    await pool.query('DELETE FROM "rateLimit"')
    email = `reset-${randomUUID()}@personai.test`
    const signup = await post("sign-up/email", {
      email,
      password: "OldPassword123!",
      name: "Reset Test",
    })
    expect(signup.status).toBe(200)
    cookie = signup.headers.get("set-cookie")!.split(";")[0]
  })

  it("returns equivalent public bodies for existing, nonexistent and failed email delivery", async () => {
    const existing = await requestReset()
    const missing = await requestReset(`absent-${randomUUID()}@personai.test`)
    await pool.query('DELETE FROM "rateLimit"')
    delivery.mockRejectedValueOnce(new Error("provider-secret-detail"))
    const log = vi.spyOn(console, "error").mockImplementation(() => {})
    const failure = await requestReset()
    await Promise.all(jobs)
    expect([existing.status, missing.status, failure.status]).toEqual([
      200, 200, 200,
    ])
    expect(await existing.json()).toEqual(await missing.json())
    expect(await failure.json()).toEqual({
      status: true,
      message: "若此信箱已註冊，您將收到重設密碼信件。",
    })
    expect(log.mock.calls.flat().join(" ")).not.toContain(
      "provider-secret-detail"
    )
    log.mockRestore()
  })

  it("changes the same credential, rejects old password and revokes existing sessions", async () => {
    const value = await token()
    const hash = (
      await pool.query(
        'SELECT identifier FROM verification WHERE value = (SELECT id::text FROM "user" WHERE email = $1)',
        [email]
      )
    ).rows[0].identifier
    expect(hash).not.toContain(value)
    expect((await reset(value)).status).toBe(200)
    expect(
      (await post("sign-in/email", { email, password: "OldPassword123!" }))
        .status
    ).toBe(401)
    const session = await auth.handler(
      new Request("http://localhost:3000/api/auth/get-session", {
        headers: { cookie },
      })
    )
    expect(await session.json()).toBeNull()
    expect(
      (await post("sign-in/email", { email, password: "NewPassword123!" }))
        .status
    ).toBe(200)
    const credential = (
      await pool.query(
        'SELECT password FROM account WHERE "userId" = (SELECT id FROM "user" WHERE email = $1)',
        [email]
      )
    ).rows[0].password
    expect(credential).not.toBe("NewPassword123!")
    expect(credential).not.toContain("NewPassword")
  })

  it("rejects invalid and missing tokens", async () => {
    expect((await reset("A".repeat(24))).status).toBe(400)
    expect(
      (await post("reset-password", { newPassword: "NewPassword123!" })).status
    ).toBe(400)
  })

  it("rejects expired tokens", async () => {
    const value = await token()
    await pool.query(
      "UPDATE verification SET \"expiresAt\" = NOW() - INTERVAL '1 second'"
    )
    expect((await reset(value)).status).toBe(400)
  })

  it("rejects sequential token reuse", async () => {
    const value = await token()
    expect((await reset(value)).status).toBe(200)
    expect((await reset(value, "OtherPassword123!")).status).toBe(400)
  })

  it("allows exactly one concurrent token consumer across independent auth instances", async () => {
    const value = await token()
    const responses = await Promise.all([
      reset(value, "FirstPassword123!"),
      reset(value, "SecondPassword123!", replica),
    ])
    expect(responses.map((response) => response.status).sort()).toEqual([
      200, 400,
    ])
    const winner = responses[0].ok ? "FirstPassword123!" : "SecondPassword123!"
    expect(
      (await post("sign-in/email", { email, password: winner })).status
    ).toBe(200)
  })

  it.each(["short", "x".repeat(129)])(
    "rejects invalid password length without consuming the token (%#)",
    async (password) => {
      const value = await token()
      expect((await reset(value, password)).status).toBe(400)
      expect((await reset(value)).status).toBe(200)
    }
  )

  it.each([
    "https://evil.test/reset-password",
    "//evil.test",
    "http://localhost:3000/login",
    "http://localhost:3000/reset-password?redirect=https://evil.test",
  ])("rejects untrusted or noncanonical redirect %s", async (redirect) => {
    expect((await requestReset(email, redirect)).status).toBe(400)
    expect(delivery).not.toHaveBeenCalled()
  })

  it("throttles repeat requests per email without revealing existence", async () => {
    const responses = await Promise.all([
      requestReset(),
      requestReset(),
      requestReset(),
    ])
    expect(responses.map((response) => response.status)).toEqual([
      200, 200, 200,
    ])
    await Promise.all(jobs)
    expect(delivery).toHaveBeenCalledTimes(1)
  })

  it("enforces the shared global quota independently of spoofed client IPs", async () => {
    await pool.query(
      'INSERT INTO "rateLimit" (id,key,count,"lastRequest") VALUES ($1,$2,30,$3)',
      [randomUUID(), "reset-request-global", Date.now()]
    )
    expect((await requestReset()).status).toBe(429)
    expect(delivery).not.toHaveBeenCalled()
  })

  it("rolls back credential and token consumption when session revocation fails", async () => {
    const value = await token()
    await pool.query(
      `CREATE FUNCTION reject_session_delete() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected failure'; END $$`
    )
    await pool.query(
      "CREATE TRIGGER reject_session_delete BEFORE DELETE ON session FOR EACH STATEMENT EXECUTE FUNCTION reject_session_delete()"
    )
    try {
      expect((await reset(value)).status).toBe(503)
      expect(
        (await post("sign-in/email", { email, password: "OldPassword123!" }))
          .status
      ).toBe(200)
    } finally {
      await pool.query("DROP TRIGGER reject_session_delete ON session")
      await pool.query("DROP FUNCTION reject_session_delete()")
    }
    expect((await reset(value)).status).toBe(200)
  })

  it("protects direct server reset calls across independent instances", async () => {
    const value = await token()
    const results = await Promise.allSettled([
      auth.api.resetPassword({
        body: { token: value, newPassword: "DirectPassword123!" },
      }),
      replica.api.resetPassword({
        body: { token: value, newPassword: "ReplicaPassword123!" },
      }),
    ])
    expect(
      results.filter((result) => result.status === "fulfilled")
    ).toHaveLength(1)
    expect(
      results.filter((result) => result.status === "rejected")
    ).toHaveLength(1)
  })

  it.each(["not-json", "null", '"string"'])(
    "rejects malformed request body %s",
    async (body) => {
      const response = await auth.handler(
        new Request("http://localhost:3000/api/auth/request-password-reset", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
        })
      )
      expect(response.status).toBe(400)
    }
  )

  it("rejects oversized bodies before parsing", async () => {
    const response = await post("request-password-reset", {
      email: "a".repeat(5000),
    })
    expect(response.status).toBe(413)
    expect(delivery).not.toHaveBeenCalled()
  })

  it.each(["reset%2Dpassword", "/reset-password"])(
    "rejects encoded or duplicate-separator route aliases %s",
    async (path) => {
      expect(
        (
          await post(path, {
            token: "A".repeat(24),
            newPassword: "Password123!",
          })
        ).status
      ).toBe(400)
    }
  )

  it("rejects an untrusted callback and preserves the token", async () => {
    const value = await token()
    const response = await auth.handler(
      new Request(
        `http://localhost:3000/api/auth/reset-password/${value}?callbackURL=https://evil.test`
      )
    )
    expect(response.status).toBe(403)
    expect(response.headers.get("location")).toBeNull()
    expect((await reset(value)).status).toBe(200)
  })

  it("never reports success when a late rate-limit SQL error aborts the transaction", async () => {
    const value = await token()
    await pool.query(`CREATE FUNCTION reject_reset_limit() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.key LIKE '%|/reset-password' THEN RAISE EXCEPTION 'injected auxiliary failure'; END IF; RETURN NEW; END $$`)
    await pool.query(
      'CREATE TRIGGER reject_reset_limit BEFORE INSERT ON "rateLimit" FOR EACH ROW EXECUTE FUNCTION reject_reset_limit()'
    )
    try {
      expect((await reset(value)).status).toBe(503)
      expect(
        (
          await pool.query(
            'SELECT count(*)::int AS n FROM verification WHERE value = (SELECT id::text FROM "user" WHERE email=$1)',
            [email]
          )
        ).rows[0].n
      ).toBe(1)
      expect(
        (
          await pool.query(
            'SELECT count(*)::int AS n FROM session WHERE "userId" = (SELECT id FROM "user" WHERE email=$1)',
            [email]
          )
        ).rows[0].n
      ).toBe(1)
    } finally {
      await pool.query('DROP TRIGGER reject_reset_limit ON "rateLimit"')
      await pool.query("DROP FUNCTION reject_reset_limit()")
    }
    expect(
      (await post("sign-in/email", { email, password: "OldPassword123!" }))
        .status
    ).toBe(200)
    expect(
      (await post("sign-in/email", { email, password: "NewPassword123!" }))
        .status
    ).toBe(401)
    expect((await reset(value)).status).toBe(200)
  })

  it.each(["http", "server"])(
    "rejects a verified old-password login resumed after a reset commits (%s)",
    async (entry) => {
      const value = await token()
      const context = await auth.$context
      const original = context.password.verify
      const reached = Promise.withResolvers<void>()
      const resume = Promise.withResolvers<void>()
      const verify = vi
        .spyOn(context.password, "verify")
        .mockImplementation(async (input) => {
          const valid = await original(input)
          if (valid) {
            reached.resolve()
            await resume.promise
          }
          return valid
        })
      const pending =
        entry === "http"
          ? post("sign-in/email", { email, password: "OldPassword123!" })
          : auth.api.signInEmail({
              body: { email, password: "OldPassword123!" },
              asResponse: true,
            })
      try {
        await reached.promise
        const resetResponse =
          entry === "http"
            ? await reset(value, "NewPassword123!", replica)
            : await replica.api.resetPassword({
                body: { newPassword: "NewPassword123!" },
                query: { token: value },
                asResponse: true,
              })
        expect(resetResponse.status).toBe(200)
      } finally {
        resume.resolve()
        verify.mockRestore()
      }
      const response = await pending
      expect(response.status).toBe(401)
      expect(response.headers.get("set-cookie")).toBeNull()
      expect(
        (
          await pool.query(
            'SELECT count(*)::int AS n FROM session WHERE "userId" = (SELECT id FROM "user" WHERE email=$1)',
            [email]
          )
        ).rows[0].n
      ).toBe(0)
      const jwt = await auth.handler(
        new Request("http://localhost:3000/api/auth/token", {
          headers: { cookie },
        })
      )
      expect(jwt.status).toBe(401)
    }
  )

  it("rejects stale credential issuance across independent OS processes", async () => {
    const value = await token()
    const databaseURL = new URL(adminURL!)
    databaseURL.pathname = `/${databaseName}`
    const worker = spawn(
      "bun",
      [
        fileURLToPath(
          new URL("./helpers/auth-login-worker.ts", import.meta.url)
        ),
      ],
      {
        stdio: ["ignore", "pipe", "pipe", "ipc"],
        env: {
          ...process.env,
          PERSONAI_AUTH_TEST_DATABASE_URL: databaseURL.href,
          RESEND_API_KEY: "",
          RESEND_FROM_EMAIL: "",
        },
      }
    )
    const ready = Promise.withResolvers<void>()
    const verified = Promise.withResolvers<void>()
    const result = Promise.withResolvers<{
      status: number
      cookie: string | null
    }>()
    worker.on(
      "message",
      (message: { type: string; status: number; cookie: string | null }) => {
        if (message.type === "ready") ready.resolve()
        if (message.type === "verified") verified.resolve()
        if (message.type === "result") result.resolve(message)
      }
    )
    worker.on("error", (error) => {
      ready.reject(error)
      verified.reject(error)
      result.reject(error)
    })
    try {
      await ready.promise
      worker.send({ type: "login", email })
      await verified.promise
      expect((await reset(value, "NewPassword123!", replica)).status).toBe(200)
      worker.send({ type: "resume" })
      expect(await result.promise).toMatchObject({ status: 401, cookie: null })
      expect(
        (
          await pool.query(
            'SELECT count(*)::int AS n FROM session WHERE "userId"=(SELECT id FROM "user" WHERE email=$1)',
            [email]
          )
        ).rows[0].n
      ).toBe(0)
      expect(
        (
          await auth.handler(
            new Request("http://localhost:3000/api/auth/token", {
              headers: { cookie },
            })
          )
        ).status
      ).toBe(401)
    } finally {
      worker.kill()
    }
  }, 15_000)

  it("rejects malformed inputs before charging either global budget", async () => {
    expect((await requestReset("invalid-email")).status).toBe(400)
    expect((await reset("invalid-token")).status).toBe(400)
    expect(
      (
        await pool.query(
          "SELECT count(*)::int AS n FROM \"rateLimit\" WHERE key IN ('reset-request-global','reset-submit-global')"
        )
      ).rows[0].n
    ).toBe(0)
    expect((await requestReset()).status).toBe(200)
  })

  it("rejects even a swallowed late SQL failure and preserves all credential state", async () => {
    const value = await token()
    const storage = auth.options.rateLimit!.customStorage!
    const original = storage.set.bind(storage)
    const swallow = vi
      .spyOn(storage, "set")
      .mockImplementation(async (...args) => {
        try {
          await original(...args)
        } catch {
          /* simulate library best-effort auxiliary storage */
        }
      })
    await pool.query(`CREATE FUNCTION reject_swallowed_limit() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.key LIKE '%|/reset-password' THEN RAISE EXCEPTION 'injected swallowed failure'; END IF; RETURN NEW; END $$`)
    await pool.query(
      'CREATE TRIGGER reject_swallowed_limit BEFORE INSERT ON "rateLimit" FOR EACH ROW EXECUTE FUNCTION reject_swallowed_limit()'
    )
    try {
      expect((await reset(value)).status).toBe(503)
      expect(
        (
          await pool.query(
            'SELECT count(*)::int AS n FROM verification WHERE value=(SELECT id::text FROM "user" WHERE email=$1)',
            [email]
          )
        ).rows[0].n
      ).toBe(1)
      expect(
        (
          await pool.query(
            'SELECT count(*)::int AS n FROM session WHERE "userId"=(SELECT id FROM "user" WHERE email=$1)',
            [email]
          )
        ).rows[0].n
      ).toBe(1)
    } finally {
      swallow.mockRestore()
      await pool.query('DROP TRIGGER reject_swallowed_limit ON "rateLimit"')
      await pool.query("DROP FUNCTION reject_swallowed_limit()")
    }
    expect(
      (await post("sign-in/email", { email, password: "NewPassword123!" }))
        .status
    ).toBe(401)
    expect(
      (await post("sign-in/email", { email, password: "OldPassword123!" }))
        .status
    ).toBe(200)
    expect((await reset(value)).status).toBe(200)
  })

  async function waitForDatabaseBarrier(needle: string, count: number) {
    const deadline = Date.now() + 3000
    while (Date.now() < deadline) {
      const result = await pool.query(
        "SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=$1 AND wait_event='advisory' AND query ILIKE $2",
        [databaseName, needle]
      )
      if (result.rows[0].n >= count) return
      await new Promise((resolve) => setTimeout(resolve, 10))
    }
    throw new Error("Database execution barrier was not reached")
  }

  it("commits both users resetting from one IP during concurrent rate-limit key creation", async () => {
    const first = { email, token: await token() }
    const secondEmail = `second-${randomUUID()}@personai.test`
    expect(
      (
        await post("sign-up/email", {
          email: secondEmail,
          password: "OldPassword123!",
          name: "Second",
        })
      ).status
    ).toBe(200)
    expect((await requestReset(secondEmail)).status).toBe(200)
    await Promise.all(jobs)
    const second = {
      email: secondEmail,
      token: delivery.mock.calls.find(
        ([message]) => message.user.email === secondEmail
      )![0].token,
    }
    await pool.query('DELETE FROM "rateLimit"')
    const gate = await pool.connect()
    await gate.query("SELECT pg_advisory_lock(7712401)")
    await pool.query(`CREATE FUNCTION concurrent_limit_gate() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.key LIKE '%|/reset-password' THEN PERFORM pg_advisory_xact_lock(7712401); END IF; RETURN NEW; END $$`)
    await pool.query(
      'CREATE TRIGGER concurrent_limit_gate BEFORE INSERT ON "rateLimit" FOR EACH ROW EXECUTE FUNCTION concurrent_limit_gate()'
    )
    const pending = Promise.all([
      reset(first.token),
      reset(second.token, "NewPassword123!", replica),
    ])
    let responses: Response[] = []
    try {
      await waitForDatabaseBarrier('%INSERT INTO "rateLimit"%', 2)
    } finally {
      await gate.query("SELECT pg_advisory_unlock(7712401)")
      gate.release()
      responses = await pending
      await pool.query('DROP TRIGGER concurrent_limit_gate ON "rateLimit"')
      await pool.query("DROP FUNCTION concurrent_limit_gate()")
    }
    expect(responses.map((response) => response.status)).toEqual([200, 200])
    expect(
      (
        await pool.query(
          "SELECT count FROM \"rateLimit\" WHERE key LIKE '%|/reset-password'"
        )
      ).rows[0].count
    ).toBe(2)
    for (const user of [first, second]) {
      expect(
        (
          await pool.query(
            'SELECT count(*)::int AS n FROM verification WHERE value=(SELECT id::text FROM "user" WHERE email=$1)',
            [user.email]
          )
        ).rows[0].n
      ).toBe(0)
      expect(
        (
          await pool.query(
            'SELECT count(*)::int AS n FROM session WHERE "userId"=(SELECT id FROM "user" WHERE email=$1)',
            [user.email]
          )
        ).rows[0].n
      ).toBe(0)
      expect(
        (
          await post("sign-in/email", {
            email: user.email,
            password: "OldPassword123!",
          })
        ).status
      ).toBe(401)
      // The existing 3/10s login limiter also applies to this integration test.
      await pool.query(
        "DELETE FROM \"rateLimit\" WHERE key LIKE '%|/sign-in/email'"
      )
      expect(
        (
          await post("sign-in/email", {
            email: user.email,
            password: "NewPassword123!",
          })
        ).status
      ).toBe(200)
      expect((await reset(user.token)).status).toBe(400)
    }
  })

  it("revokes a login issued before reset and preserves normal JWT/JWKS behavior", async () => {
    const value = await token()
    const response = await post("sign-in/email", {
      email,
      password: "OldPassword123!",
    })
    expect(response.status).toBe(200)
    const loginCookie = response.headers.get("set-cookie")!.split(";")[0]
    const get = (path: string, sessionCookie = loginCookie) =>
      auth.handler(
        new Request(`http://localhost:3000/api/auth/${path}`, {
          headers: { cookie: sessionCookie },
        })
      )
    const issued = await get("token")
    expect(issued.status).toBe(200)
    const jwt = (await issued.json()).token as string
    const payload = JSON.parse(
      Buffer.from(jwt.split(".")[1], "base64url").toString()
    )
    expect(payload).toMatchObject({
      email,
      iss: "http://localhost:3000",
      aud: "personai-api",
    })
    const jwks = await get("jwks")
    expect(jwks.status).toBe(200)
    const keys = (await jwks.json()).keys as JsonWebKey[]
    const header = JSON.parse(
      Buffer.from(jwt.split(".")[0], "base64url").toString()
    )
    const key = keys.find(
      (key) => (key as JsonWebKey & { kid: string }).kid === header.kid
    )!
    const publicKey = await crypto.subtle.importKey(
      "jwk",
      key,
      { name: "Ed25519" },
      false,
      ["verify"]
    )
    expect(
      await crypto.subtle.verify(
        "Ed25519",
        publicKey,
        Buffer.from(jwt.split(".")[2], "base64url"),
        Buffer.from(jwt.split(".").slice(0, 2).join("."))
      )
    ).toBe(true)
    expect((await reset(value)).status).toBe(200)
    expect(await (await get("get-session")).json()).toBeNull()
    expect((await get("token")).status).toBe(401)
    expect(
      (await post("sign-in/email", { email, password: "NewPassword123!" }))
        .status
    ).toBe(200)
  })

  it("does not starve a one-connection pool during login and reset", async () => {
    const value = await token()
    const smallPool = new Pool({
      ...pool.options,
      max: 1,
      connectionTimeoutMillis: 1500,
    })
    const small = makeAuth({
      pool: smallPool,
      deliver: delivery,
      background,
    })
    try {
      expect(
        (
          await post(
            "sign-in/email",
            { email, password: "OldPassword123!" },
            small
          )
        ).status
      ).toBe(200)
      expect((await reset(value, "NewPassword123!", small)).status).toBe(200)
    } finally {
      await smallPool.end()
    }
  })

  it.each([
    { path: "request-password-reset", body: "{", status: 400 },
    {
      path: "request-password-reset",
      body: JSON.stringify({
        email: ".bad@personai.test",
        redirectTo: "http://localhost:3000/reset-password",
      }),
      status: 400,
    },
    {
      path: "reset-password",
      body: JSON.stringify({ token: "wrong", newPassword: "NewPassword123!" }),
      status: 400,
    },
    {
      path: "reset-password",
      body: JSON.stringify({ token: "A".repeat(24), newPassword: "short" }),
      status: 400,
    },
    {
      path: "request-password-reset",
      origin: "https://evil.test",
      status: 403,
    },
    { path: "request-password-reset", origin: "", status: 403 },
    { path: "request-password-reset", fetchSite: "cross-site", status: 403 },
    { path: "request-password-reset", contentType: "text/plain", status: 415 },
    { path: "request-password-reset", contentType: "", status: 415 },
  ])(
    "rejects invalid recovery metadata before any quota debit (%#)",
    async (input) => {
      const headers = new Headers({
        "content-type": input.contentType ?? "application/json",
        origin: input.origin ?? "http://localhost:3000",
      })
      if (input.fetchSite) headers.set("sec-fetch-site", input.fetchSite)
      const response = await auth.handler(
        new Request(`http://localhost:3000/api/auth/${input.path}`, {
          method: "POST",
          headers,
          body:
            input.body ??
            JSON.stringify({
              email,
              redirectTo: "http://localhost:3000/reset-password",
            }),
        })
      )
      expect(response.status).toBe(input.status)
      expect(
        (
          await pool.query(
            "SELECT count(*)::int AS n FROM \"rateLimit\" WHERE key LIKE 'reset-%'"
          )
        ).rows[0].n
      ).toBe(0)
      expect((await requestReset()).status).toBe(200)
    }
  )

  it("isolates valid-format abuse by trusted source despite spoofed forwarding headers", async () => {
    const ingress = makeAuth({
      pool: replicaPool,
      deliver: delivery,
      background,
      clientIpHeader: "x-test-ingress-ip",
    })
    const incoming = (
      address: string,
      path: string,
      body: unknown,
      forwarded = "203.0.113.99"
    ) =>
      ingress.handler(
        new Request(`http://localhost:3000/api/auth/${path}`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            origin: "http://localhost:3000",
            "x-test-ingress-ip": address,
            "x-forwarded-for": forwarded,
            "x-real-ip": forwarded,
            "x-personai-client-ip": forwarded,
          },
          body: JSON.stringify(body),
        })
      )
    const statuses = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        incoming(
          "192.0.2.10",
          "request-password-reset",
          {
            email: `abuse-${i}@personai.test`,
            redirectTo: "http://localhost:3000/reset-password",
          },
          `203.0.113.${i}`
        ).then((response) => response.status)
      )
    )
    expect(statuses.filter((status) => status === 200)).toHaveLength(5)
    expect(statuses.filter((status) => status === 429)).toHaveLength(15)
    expect(
      (
        await pool.query(
          "SELECT count FROM \"rateLimit\" WHERE key='reset-request-global'"
        )
      ).rows[0].count
    ).toBe(5)
    const legitimate = await incoming("192.0.2.20", "request-password-reset", {
      email,
      redirectTo: "http://localhost:3000/reset-password",
    })
    expect(legitimate.status).toBe(200)
    await Promise.all(jobs)
    const value = delivery.mock.calls[0][0].token
    const submits = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        incoming("192.0.2.10", "reset-password", {
          token: String(i).padStart(24, "A"),
          newPassword: "NewPassword123!",
        }).then((response) => response.status)
      )
    )
    expect(submits.filter((status) => status === 400)).toHaveLength(10)
    expect(submits.filter((status) => status === 429)).toHaveLength(10)
    expect(
      (
        await pool.query(
          "SELECT count FROM \"rateLimit\" WHERE key='reset-submit-global'"
        )
      ).rows[0].count
    ).toBe(10)
    expect(
      (
        await incoming("192.0.2.20", "reset-password", {
          token: value,
          newPassword: "NewPassword123!",
        })
      ).status
    ).toBe(200)
  })

  it("does not charge shared capacity for repeated suppressed email", async () => {
    await Promise.all([requestReset(), requestReset(), requestReset()])
    expect(
      (
        await pool.query(
          "SELECT count FROM \"rateLimit\" WHERE key='reset-request-global'"
        )
      ).rows[0].count
    ).toBe(1)
    expect(delivery).toHaveBeenCalledTimes(1)
  })

  it("rejects swallowed SQL errors independently of the final command tag", async () => {
    const db = createAuthDatabase(pool)
    await expect(
      db.reset(
        "test",
        async () => {
          const client = await db.database.connect()
          try {
            await client.query("SELECT 1/0")
          } catch {
            /* deliberately swallowed */
          }
          client.release()
          return Response.json({ status: true })
        },
        (response) => response.ok
      )
    ).rejects.toThrow("Authentication transaction failed")
    expect((await reset(await token())).status).toBe(200)
  })

  it("persists failed-login and failed-reset limiter counts outside credential rollback", async () => {
    const statuses: number[] = []
    for (let i = 0; i < 4; i++)
      statuses.push(
        (await post("sign-in/email", { email, password: "WrongPassword123!" }))
          .status
      )
    expect(statuses).toEqual([401, 401, 401, 429])
    expect(
      (
        await pool.query(
          "SELECT count FROM \"rateLimit\" WHERE key LIKE '%|/sign-in/email'"
        )
      ).rows[0].count
    ).toBe(3)
    expect((await reset("A".repeat(24))).status).toBe(400)
    expect(
      (
        await pool.query(
          "SELECT count FROM \"rateLimit\" WHERE key LIKE '%|/reset-password'"
        )
      ).rows[0].count
    ).toBe(1)
  })

  it("keeps public JWKS available without a client-source header", async () => {
    const ingress = makeAuth({
      pool,
      deliver: delivery,
      background,
      clientIpHeader: "x-test-required-ingress",
    })
    const response = await ingress.handler(
      new Request("http://localhost:3000/api/auth/jwks", {
        headers: { "x-personai-client-ip": "203.0.113.1" },
      })
    )
    expect(response.status).toBe(200)
    expect((await response.json()).keys).toBeInstanceOf(Array)
    const blocked = await ingress.handler(
      new Request("http://localhost:3000/api/auth/token", {
        headers: { cookie },
      })
    )
    expect(blocked.status).toBe(503)
  })
})
