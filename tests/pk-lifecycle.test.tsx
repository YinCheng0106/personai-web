import type { ReactNode } from "react"
import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { normalizeFrame } from "@/lib/socket"
import { serverFrame } from "./helpers/fixtures"
import { TestSocket } from "./helpers/socket"

const state = vi.hoisted(() => ({
  pose: {} as ReturnType<typeof normalizeFrame>,
  reset: vi.fn(),
  token: vi.fn(),
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
  getAccessToken: state.token,
}))
vi.mock("next/navigation", () => ({ usePathname: () => "/pk" }))
vi.mock("@/components/fitness/camera-frame", () => ({
  CameraFrame: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))
import PKPage from "@/app/pk/page"

beforeEach(() => {
  state.pose = normalizeFrame(serverFrame({ rep_count: 0 }))
  state.reset.mockClear()
  state.token.mockReset().mockResolvedValue("signed-jwt")
  TestSocket.instances = []
  vi.stubGlobal("WebSocket", TestSocket)
})
afterEach(() => vi.unstubAllGlobals())

async function joinRoom() {
  const user = userEvent.setup()
  const view = render(<PKPage />)
  await user.type(screen.getByLabelText("4 位數房號"), "1234")
  await user.click(screen.getByRole("button", { name: "加入" }))
  await waitFor(() => expect(TestSocket.instances).toHaveLength(1))
  const socket = TestSocket.instances[0]
  act(() => socket.open())
  return { user, socket, ...view }
}
function room(socket: TestSocket, player_count = 2, opponent_ready = true) {
  act(() =>
    socket.receive({
      type: "ROOM_STATE",
      player_count,
      opponent_ready,
      opponent_score: 0,
      exercise_type: "squat",
    })
  )
}

describe("PK page with the real WebSocket adapter", () => {
  it("validates room input, creates a four-digit room, and waits for two players", async () => {
    const user = userEvent.setup()
    render(<PKPage />)
    const input = screen.getByLabelText("4 位數房號")
    await user.type(input, "a12")
    expect(input).toHaveValue("12")
    expect(screen.getByRole("button", { name: "加入" })).toBeDisabled()
    await user.click(screen.getByRole("button", { name: "建立對戰房間" }))
    await waitFor(() => expect(TestSocket.instances).toHaveLength(1))
    const socket = TestSocket.instances[0]
    expect(new URL(socket.url).searchParams.get("room")).toMatch(
      /^[1-9][0-9]{3}$/
    )
    expect(socket.protocols).toEqual(["personai.v1", "signed-jwt"])
    act(() => socket.open())
    room(socket, 1, false)
    expect(screen.getByRole("button", { name: "準備完成" })).toBeDisabled()
    expect(screen.getByText("等待加入")).toBeVisible()
  })

  it("joins, toggles ready, starts, sends only confirmed ACTIVE reps, and leaves", async () => {
    const { user, socket, rerender } = await joinRoom()
    room(socket)
    await user.click(screen.getByRole("button", { name: "準備完成" }))
    await user.click(screen.getByRole("button", { name: "取消準備" }))
    expect(socket.sent.map((value) => JSON.parse(value))).toEqual([
      { type: "READY", ready: true },
      { type: "READY", ready: false },
    ])
    act(() => socket.receive({ type: "GAME_START" }))
    expect(screen.getByText("你的分數")).toBeVisible()
    state.pose = normalizeFrame(
      serverFrame({ rep_count: 2, tracking_state: "PAUSED" })
    )
    rerender(<PKPage />)
    expect(socket.sent).toHaveLength(2)
    state.pose = { ...state.pose, trackingState: "ACTIVE" }
    rerender(<PKPage />)
    expect(socket.sent.slice(2).map((value) => JSON.parse(value))).toEqual([
      { type: "SCORE_UPDATE", score: 1 },
      { type: "SCORE_UPDATE", score: 2 },
    ])
    rerender(<PKPage />)
    expect(socket.sent).toHaveLength(4)
    act(() => socket.receive({ type: "OPPONENT_SCORE", score: 7 }))
    expect(screen.getByText("7")).toBeVisible()
    await user.click(screen.getByRole("button", { name: "離開房間" }))
    expect(screen.getByRole("button", { name: "建立對戰房間" })).toBeVisible()
    expect(socket.closes).toContainEqual({
      code: 1000,
      reason: "User left room",
    })
    act(() => {
      socket.receive({ type: "GAME_START" })
      socket.receive({ type: "OPPONENT_SCORE", score: 99 })
    })
    expect(screen.queryByText("你的分數")).not.toBeInTheDocument()
  })

  it.each([
    [4401, "登入已失效，請重新登入。"],
    [4409, "房間已滿，或你已在另一個視窗加入此房間。"],
    [1006, "對戰連線已中斷，請重新加入。"],
  ])("handles disconnect %s and permits rejoining", async (code, message) => {
    const { user, socket } = await joinRoom()
    room(socket)
    act(() => socket.close(code))
    expect(screen.getByText(message)).toBeVisible()
    await user.click(screen.getByRole("button", { name: "加入" }))
    await waitFor(() => expect(TestSocket.instances).toHaveLength(2))
    expect(screen.queryByText(message)).not.toBeInTheDocument()
  })

  it("resets readiness when the opponent leaves and closes on unmount", async () => {
    const { user, socket, unmount } = await joinRoom()
    room(socket)
    await user.click(screen.getByRole("button", { name: "準備完成" }))
    room(socket, 1, false)
    expect(screen.getByRole("button", { name: "準備完成" })).toBeDisabled()
    unmount()
    expect(socket.closes).toContainEqual({ code: 1000, reason: "Page closed" })
  })

  it("shows JWT failure without opening a room socket", async () => {
    state.token.mockRejectedValue(new Error("Expired"))
    const user = userEvent.setup()
    render(<PKPage />)
    await user.click(screen.getByRole("button", { name: "建立對戰房間" }))
    expect(
      await screen.findByText("無法取得登入憑證，請重新登入後再試。")
    ).toBeVisible()
    expect(TestSocket.instances).toHaveLength(0)
    expect(screen.getByRole("button", { name: "建立對戰房間" })).toBeEnabled()
  })
})
