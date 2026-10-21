import { act, fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { deferred } from "./helpers/fixtures"

const state = vi.hoisted(() => ({
  request: vi.fn(),
  reset: vi.fn(),
  search: new URLSearchParams(),
}))
vi.mock("next/navigation", () => ({ useSearchParams: () => state.search }))
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    requestPasswordReset: state.request,
    resetPassword: state.reset,
  },
}))
import ForgotPasswordPage from "@/app/forgot-password/page"
import ResetPasswordPage from "@/app/reset-password/page"

beforeEach(() => {
  state.request.mockReset().mockResolvedValue({ error: null })
  state.reset.mockReset().mockResolvedValue({ error: null })
  state.search = new URLSearchParams(`token=${"A".repeat(24)}`)
})
afterEach(() => vi.unstubAllEnvs())

it("uses the configured canonical auth destination on another trusted host", async () => {
  vi.stubEnv("NEXT_PUBLIC_BETTER_AUTH_URL", "https://auth.personai.test")
  const user = userEvent.setup()
  render(<ForgotPasswordPage />)
  await user.type(screen.getByLabelText("電子郵件"), "user@personai.test")
  await user.click(screen.getByRole("button", { name: "寄送重設信件" }))
  expect(state.request).toHaveBeenCalledExactlyOnceWith({
    email: "user@personai.test",
    redirectTo: "https://auth.personai.test/reset-password",
  })
})

it("requests reset through Better Auth with a fixed local destination and blocks duplicate submissions", async () => {
  const pending = deferred<{ error: null }>()
  state.request.mockReturnValue(pending.promise)
  const user = userEvent.setup()
  render(<ForgotPasswordPage />)
  await user.type(screen.getByLabelText("電子郵件"), "user@personai.test")
  await user.click(screen.getByRole("button", { name: "寄送重設信件" }))
  expect(screen.getByRole("button", { name: "處理中…" })).toBeDisabled()
  fireEvent.submit(
    screen.getByRole("button", { name: "處理中…" }).closest("form")!
  )
  expect(state.request).toHaveBeenCalledTimes(1)
  expect(state.request.mock.calls[0][0]).toMatchObject({
    email: "user@personai.test",
    redirectTo: expect.stringMatching(/\/reset-password$/),
  })
  await act(async () => pending.resolve({ error: null }))
  expect(await screen.findByRole("status")).toHaveTextContent("若此信箱已註冊")
})

it.each(["server", "network", "rate"])(
  "uses safe request errors for %s failures",
  async (kind) => {
    if (kind === "network") state.request.mockRejectedValue(new Error("secret"))
    else
      state.request.mockResolvedValue({
        error: { message: "secret", status: kind === "rate" ? 429 : 500 },
      })
    const user = userEvent.setup()
    render(<ForgotPasswordPage />)
    await user.type(screen.getByLabelText("電子郵件"), "user@personai.test")
    await user.click(screen.getByRole("button", { name: "寄送重設信件" }))
    expect(await screen.findByRole("alert")).not.toHaveTextContent("secret")
    expect(screen.getByRole("link", { name: "返回登入頁面" })).toHaveAttribute(
      "href",
      "/login"
    )
  }
)

it.each(["", "token=invalid", `token=${"A".repeat(24)}&error=INVALID_TOKEN`])(
  "handles missing or invalid callback %s",
  (query) => {
    state.search = new URLSearchParams(query)
    render(<ResetPasswordPage />)
    expect(screen.getByRole("alert")).toHaveTextContent("連結無效")
    expect(screen.queryByLabelText("新密碼")).not.toBeInTheDocument()
  }
)

async function resetForm() {
  const user = userEvent.setup()
  render(<ResetPasswordPage />)
  await user.type(
    screen.getByLabelText("新密碼", { exact: true }),
    "NewPassword123!"
  )
  await user.type(screen.getByLabelText("確認新密碼"), "NewPassword123!")
  return user
}

it("rejects mismatched password confirmation", async () => {
  const user = await resetForm()
  await user.type(screen.getByLabelText("確認新密碼"), "different")
  await user.click(screen.getByRole("button", { name: "確認更新密碼" }))
  expect(screen.getByRole("alert")).toHaveTextContent("兩次輸入的密碼不一致")
  expect(state.reset).not.toHaveBeenCalled()
})

it("rejects weak passwords even when native validation is bypassed", async () => {
  render(<ResetPasswordPage />)
  fireEvent.change(screen.getByLabelText("新密碼", { exact: true }), {
    target: { value: "short" },
  })
  fireEvent.submit(
    screen.getByRole("button", { name: "確認更新密碼" }).closest("form")!
  )
  expect(screen.getByRole("alert")).toHaveTextContent("8 至 128")
  expect(state.reset).not.toHaveBeenCalled()
})

it.each(["invalid", "expired", "used", "network"])(
  "safely handles a %s token failure",
  async (kind) => {
    if (kind === "network") state.reset.mockRejectedValue(new Error("secret"))
    else state.reset.mockResolvedValue({ error: { message: `secret-${kind}` } })
    const user = await resetForm()
    await user.click(screen.getByRole("button", { name: "確認更新密碼" }))
    expect(await screen.findByRole("alert")).not.toHaveTextContent("secret")
    expect(
      screen.getByRole("link", { name: "重新申請重設連結" })
    ).toHaveAttribute("href", "/forgot-password")
  }
)

it("retains the token in memory, blocks duplicate submissions, and links to login after success", async () => {
  const pending = deferred<{ error: null }>()
  state.reset.mockReturnValue(pending.promise)
  const user = await resetForm()
  expect(window.location.search).toBe("")
  await user.click(screen.getByRole("button", { name: "確認更新密碼" }))
  fireEvent.submit(
    screen.getByRole("button", { name: "更新中…" }).closest("form")!
  )
  expect(state.reset).toHaveBeenCalledExactlyOnceWith({
    token: "A".repeat(24),
    newPassword: "NewPassword123!",
  })
  await act(async () => pending.resolve({ error: null }))
  expect(await screen.findByRole("status")).toHaveTextContent("密碼已重設")
  expect(screen.queryByLabelText("新密碼")).not.toBeInTheDocument()
  expect(screen.getByRole("link", { name: "返回登入頁面" })).toHaveAttribute(
    "href",
    "/login"
  )
})
