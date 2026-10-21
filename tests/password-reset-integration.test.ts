// @vitest-environment node
import { randomUUID } from "node:crypto"
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
    auth = createPersonaiAuth({ pool, deliver: delivery, background })
    replica = createPersonaiAuth({
      pool: replicaPool,
      deliver: delivery,
      background,
    })
    await (await getMigrations(auth.options)).runMigrations()
  }, 30_000)

  afterAll(async () => {
    await Promise.all(jobs)
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
})
