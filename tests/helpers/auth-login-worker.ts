// Real independent application process used only by the disposable DB suite.
import { Pool } from "pg"
import { createPersonaiAuth } from "../../src/lib/auth"

const url = new URL(process.env.PERSONAI_AUTH_TEST_DATABASE_URL!)
if (
  url.hostname !== "127.0.0.1" ||
  !/^\/personai_test_reset_[a-f0-9]+$/.test(url.pathname) ||
  url.search
)
  throw new Error("Requires disposable authentication test database")
const pool = new Pool({
  connectionString: url.href,
  options: "-c search_path=personai_auth",
})
const auth = createPersonaiAuth({
  pool,
  deliver: async () => {
    throw new Error("Worker must not send mail")
  },
  background: () => {},
})
const resume = Promise.withResolvers<void>()
const context = await auth.$context
const verify = context.password.verify
context.password.verify = async (input) => {
  const valid = await verify(input)
  if (valid) {
    process.send!({ type: "verified" })
    await resume.promise
  }
  return valid
}
process.on("message", async (message: { type: string; email?: string }) => {
  if (message.type === "resume") return resume.resolve()
  if (message.type !== "login") return
  try {
    const response = await auth.handler(
      new Request("http://localhost:3000/api/auth/sign-in/email", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
        },
        body: JSON.stringify({
          email: message.email,
          password: "OldPassword123!",
        }),
      })
    )
    process.send!({
      type: "result",
      status: response.status,
      cookie: response.headers.get("set-cookie"),
    })
  } finally {
    await auth.close()
    await pool.end()
    process.disconnect!()
  }
})
process.send!({ type: "ready" })
