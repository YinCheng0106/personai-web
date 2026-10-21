// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest"
import { sendResetEmail } from "@/lib/reset-email"

const email = {
  user: { email: "user@personai.test" },
  url: "https://auth.personai.test/reset-password?token=private-token",
  token: "private-token",
}
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

it("sends plain text through the server-only Resend API without tracking or token idempotency keys", async () => {
  vi.stubEnv("RESEND_API_KEY", "test-only-provider-key")
  vi.stubEnv("RESEND_FROM_EMAIL", "PersonAI <no-reply@personai.test>")
  const send = vi.fn().mockResolvedValue(new Response("{}"))
  vi.stubGlobal("fetch", send)
  await sendResetEmail(email)
  expect(send).toHaveBeenCalledTimes(1)
  const [url, init] = send.mock.calls[0]
  expect(url).toBe("https://api.resend.com/emails")
  expect(init.headers["Idempotency-Key"]).not.toContain(email.token)
  const body = JSON.parse(init.body)
  expect(body.text).toContain(email.url)
  expect(body.html).toBeUndefined()
  expect(body.to).toEqual([email.user.email])
})

it.each(["http", "network"])(
  "does not disclose provider %s errors",
  async (kind) => {
    vi.stubEnv("RESEND_API_KEY", "test-only-provider-key")
    vi.stubEnv("RESEND_FROM_EMAIL", "PersonAI <no-reply@personai.test>")
    const send =
      kind === "http"
        ? vi
            .fn()
            .mockResolvedValue(new Response("provider-secret", { status: 500 }))
        : vi.fn().mockRejectedValue(new Error("provider-secret"))
    vi.stubGlobal("fetch", send)
    const log = vi.spyOn(console, "error").mockImplementation(() => {})
    await expect(sendResetEmail(email)).resolves.toBeUndefined()
    expect(log.mock.calls).toEqual([["Password reset email delivery failed"]])
  }
)

it.each([
  "",
  "PersonAI <onboarding@resend.dev>",
  "PersonAI <no-reply@personai.test>\r\nBcc: evil@test.test",
])("fails closed for invalid sender %s", async (sender) => {
  vi.stubEnv("RESEND_API_KEY", "test-only-provider-key")
  vi.stubEnv("RESEND_FROM_EMAIL", sender)
  const send = vi.fn()
  vi.stubGlobal("fetch", send)
  vi.spyOn(console, "error").mockImplementation(() => {})
  await sendResetEmail(email)
  expect(send).not.toHaveBeenCalled()
})
