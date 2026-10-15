import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { deferred } from "./helpers/fixtures"

const state = vi.hoisted(() => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
  router: { replace: vi.fn() },
  search: new URLSearchParams("redirect=%2Fhistory"),
  session: { data: null as { user: { id: string } } | null, isPending: false },
}))
vi.mock("next/navigation", () => ({
  useRouter: () => state.router,
  useSearchParams: () => state.search,
}))
vi.mock("@/lib/auth-client", () => ({
  useSession: () => state.session,
  authClient: {
    signIn: { email: state.signIn },
    signUp: { email: state.signUp },
  },
}))
import LoginPage from "@/app/login/page"
import RegisterPage from "@/app/register/page"

beforeEach(() => {
  state.signIn.mockReset().mockResolvedValue({ error: null })
  state.signUp.mockReset().mockResolvedValue({ error: null })
  state.router.replace.mockClear()
  state.session = { data: null, isPending: false }
  state.search = new URLSearchParams("redirect=%2Fhistory")
})

async function login() {
  const user = userEvent.setup()
  render(<LoginPage />)
  await user.type(screen.getByLabelText("Email"), "user@personai.test")
  await user.type(
    screen.getByLabelText("密碼", { exact: true }),
    "Personai123!"
  )
  return user
}
async function register() {
  const user = userEvent.setup()
  render(<RegisterPage />)
  await user.type(screen.getByLabelText("顯示名稱"), "  Tester  ")
  await user.type(screen.getByLabelText("Email"), "user@personai.test")
  await user.type(
    screen.getByLabelText("密碼", { exact: true }),
    "Personai123!"
  )
  await user.type(screen.getByLabelText("再次輸入密碼"), "Personai123!")
  return user
}

describe("authentication forms at the Better Auth client boundary", () => {
  it("locks a pending login, supports password visibility, and redirects on success", async () => {
    const response = deferred<{ error: null }>()
    state.signIn.mockReturnValue(response.promise)
    const user = await login()
    await user.click(screen.getByRole("button", { name: "顯示密碼" }))
    expect(screen.getByLabelText("密碼", { exact: true })).toHaveAttribute(
      "type",
      "text"
    )
    await user.click(screen.getByRole("button", { name: "隱藏密碼" }))
    expect(screen.getByLabelText("密碼", { exact: true })).toHaveAttribute(
      "type",
      "password"
    )
    await user.click(screen.getByRole("button", { name: "登入" }))
    expect(screen.getByRole("button", { name: "登入中…" })).toBeDisabled()
    expect(screen.getByLabelText("Email")).toBeDisabled()
    await act(async () => response.resolve({ error: null }))
    expect(state.signIn).toHaveBeenCalledExactlyOnceWith({
      email: "user@personai.test",
      password: "Personai123!",
    })
    expect(state.router.replace).toHaveBeenCalledWith("/history")
  })

  it.each(["response", "network"])(
    "reports %s login failure and allows a retry",
    async (kind) => {
      if (kind === "response")
        state.signIn.mockResolvedValueOnce({
          error: { message: "Invalid credentials" },
        })
      else state.signIn.mockRejectedValueOnce(new Error("Offline"))
      const user = await login()
      await user.click(screen.getByRole("button", { name: "登入" }))
      expect(
        await screen.findByText(
          kind === "response"
            ? "Invalid credentials"
            : "目前無法連線至登入服務，請稍後再試。"
        )
      ).toBeVisible()
      expect(state.router.replace).not.toHaveBeenCalled()
      await user.click(screen.getByRole("button", { name: "登入" }))
      expect(state.router.replace).toHaveBeenCalledWith("/history")
    }
  )

  it.each([LoginPage, RegisterPage])(
    "keeps an existing session redirect inside the app",
    (Page) => {
      state.session = { data: { user: { id: "user" } }, isPending: false }
      state.search = new URLSearchParams("redirect=https://evil.test")
      render(<Page />)
      expect(state.router.replace).toHaveBeenCalledExactlyOnceWith("/")
    }
  )

  it("validates a registration before sending credentials", async () => {
    const user = userEvent.setup()
    render(<RegisterPage />)
    await user.click(screen.getByRole("button", { name: "建立帳號" }))
    expect(screen.getByText("請輸入顯示名稱。")).toBeVisible()
    expect(screen.getByText("請輸入 Email。")).toBeVisible()
    expect(state.signUp).not.toHaveBeenCalled()
  })

  it("submits trimmed registration fields and redirects", async () => {
    const user = await register()
    await user.click(screen.getByRole("button", { name: "建立帳號" }))
    expect(state.signUp).toHaveBeenCalledExactlyOnceWith({
      name: "Tester",
      email: "user@personai.test",
      password: "Personai123!",
    })
    expect(state.router.replace).toHaveBeenCalledWith("/history")
  })

  it.each(["response", "network"])(
    "keeps registration data after a %s failure",
    async (kind) => {
      if (kind === "response")
        state.signUp.mockResolvedValueOnce({
          error: { message: "Account exists" },
        })
      else state.signUp.mockRejectedValueOnce(new Error("Offline"))
      const user = await register()
      await user.click(screen.getByRole("button", { name: "建立帳號" }))
      expect(
        await screen.findByText(
          kind === "response"
            ? "Account exists"
            : "目前無法連線至註冊服務，請稍後再試。"
        )
      ).toBeVisible()
      expect(screen.getByLabelText("Email")).toHaveValue("user@personai.test")
      expect(state.router.replace).not.toHaveBeenCalled()
      expect(screen.getByRole("button", { name: "建立帳號" })).toBeEnabled()
    }
  )
})
