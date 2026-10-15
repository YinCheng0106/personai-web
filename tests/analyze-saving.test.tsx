import { type ReactNode } from "react"
import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { server } from "./test-server"
import { deferred, serverFrame, workoutWire } from "./helpers/fixtures"
import { normalizeFrame } from "@/lib/socket"

const state = vi.hoisted(() => ({
  pose: {} as ReturnType<typeof normalizeFrame>,
  reset: vi.fn(),
}))
vi.mock("@/hooks/use-pose-analysis", () => ({
  usePoseAnalysis: () => ({
    pose: state.pose,
    status: "live",
    error: null,
    reset: state.reset,
  }),
}))
vi.mock("@/lib/auth-client", () => ({
  useSession: () => ({ data: { user: { id: "user" } }, isPending: false }),
  getAccessToken: vi.fn().mockResolvedValue("signed-jwt"),
}))
vi.mock("next/navigation", () => ({ usePathname: () => "/analyze" }))
vi.mock("@/components/fitness/camera-frame", () => ({
  CameraFrame: function Camera({ children }: { children: ReactNode }) {
    return <div>{children}</div>
  },
}))
import AnalyzePage from "@/app/analyze/page"

beforeEach(() => {
  state.pose = normalizeFrame(
    serverFrame({
      tracking_state: "PAUSED",
      tracking_hints: ["POSE_NOT_FOUND"],
    })
  )
  state.reset.mockClear()
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] })
})
afterEach(() => vi.useRealTimers())

async function startAndAdvance() {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  const view = render(<AnalyzePage />)
  await user.click(screen.getByRole("button", { name: "開始訓練" }))
  act(() => vi.advanceTimersByTime(2000))
  return { user, ...view }
}

describe("Analyze workout persistence through the authenticated API client", () => {
  it("saves nullable calories and counts only distinct form-error episodes", async () => {
    let body: unknown
    const response = deferred<Response>()
    server.use(
      http.post("http://localhost:8000/wk/me/record", async ({ request }) => {
        expect(request.headers.get("authorization")).toBe("Bearer signed-jwt")
        body = await request.json()
        return response.promise
      })
    )
    const { user, rerender } = await startAndAdvance()
    expect(screen.getByText(/目前暫停姿勢判定/)).toBeVisible()
    state.pose = normalizeFrame(
      serverFrame({ form_errors: ["SQUAT_KNEE_VALGUS"] })
    )
    rerender(<AnalyzePage />)
    state.pose = {
      ...state.pose,
      frameId: 2,
      formErrors: ["SQUAT_KNEE_VALGUS"],
    }
    rerender(<AnalyzePage />)
    state.pose = { ...state.pose, frameId: 3, formErrors: [] }
    rerender(<AnalyzePage />)
    state.pose = {
      ...state.pose,
      frameId: 4,
      formErrors: ["SQUAT_KNEE_VALGUS"],
    }
    rerender(<AnalyzePage />)
    await user.click(screen.getByRole("button", { name: "停止並儲存" }))
    expect(screen.getByRole("button", { name: "儲存中…" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "重置" })).toBeDisabled()
    await waitFor(() =>
      expect(body).toMatchObject({
        calories_burned: null,
        errors_count: 2,
        reps: 3,
        duration_sec: 2,
      })
    )
    await act(async () => response.resolve(HttpResponse.json(workoutWire)))
    expect(await screen.findByText("本次訓練已儲存。")).toBeVisible()
    expect(screen.getByRole("button", { name: "開始訓練" })).toBeEnabled()
  })

  it("reports save failures and releases controls without claiming success", async () => {
    server.use(
      http.post("http://localhost:8000/wk/me/record", () =>
        HttpResponse.json({ detail: "private db host" }, { status: 500 })
      )
    )
    const { user } = await startAndAdvance()
    await user.click(screen.getByRole("button", { name: "停止並儲存" }))
    expect(
      await screen.findByText("服務暫時無法使用，請稍後再試。")
    ).toBeVisible()
    expect(screen.queryByText("本次訓練已儲存。")).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "重置" }))
    expect(
      screen.queryByText("服務暫時無法使用，請稍後再試。")
    ).not.toBeInTheDocument()
    expect(state.reset).toHaveBeenCalledTimes(2)
  })
})
