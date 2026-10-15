import { beforeEach, describe, expect, it, vi } from "vitest"
const boundary = vi.hoisted(() => ({ token: vi.fn() }))
vi.mock("better-auth/react", () => ({
  createAuthClient: () => ({ token: boundary.token }),
}))
import { getAccessToken } from "@/lib/auth-client"

beforeEach(() => {
  boundary.token.mockReset()
})
describe("Better Auth JWT acquisition", () => {
  it("returns the issued JWT", async () => {
    boundary.token.mockResolvedValue({
      data: { token: "signed-jwt" },
      error: null,
    })
    await expect(getAccessToken()).resolves.toBe("signed-jwt")
  })
  it.each([
    { data: null, error: null },
    { data: {}, error: null },
    { data: { token: "" }, error: null },
  ])(
    "rejects missing/empty JWTs rather than sending Bearer undefined",
    async (response) => {
      boundary.token.mockResolvedValue(response)
      await expect(getAccessToken()).rejects.toThrow(
        "無法取得 API 登入憑證，請重新登入。"
      )
    }
  )
  it("preserves an authentication error even when stale token data exists", async () => {
    boundary.token.mockResolvedValue({
      data: { token: "stale" },
      error: { message: "Session expired" },
    })
    await expect(getAccessToken()).rejects.toThrow("Session expired")
  })
})
