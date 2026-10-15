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
function startEvent() {
  return {
    type: "GAME_START",
    countdown_seconds: 10,
    duration_seconds: 60,
    server_time_ms: 1_000_000,
    starts_at_ms: 1_010_000,
    ends_at_ms: 1_070_000,
  }
}
function beginEvent() {
  return {
    type: "GAME_BEGIN",
    duration_seconds: 60,
    server_time_ms: 1_010_000,
    starts_at_ms: 1_010_000,
    ends_at_ms: 1_070_000,
  }
}
function room(socket: TestSocket, player_count = 2, opponent_ready = true) {
  act(() =>
    socket.receive({
      type: "ROOM_STATE",
      player_count,
      opponent_ready,
      opponent_score: 0,
      exercise_type: "squat",
      phase: "waiting",
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
    act(() => socket.receive(startEvent()))
    expect(screen.getByText("準備開始！")).toBeVisible()
    state.pose = normalizeFrame(
      serverFrame({ rep_count: 2, tracking_state: "PAUSED" })
    )
    rerender(<PKPage />)
    expect(socket.sent).toHaveLength(2)
    act(() => socket.receive(beginEvent()))
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
      socket.receive(startEvent())
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
  it("uses server deadlines, ignores duplicate events, and waits for the final server result", async () => {
    const { socket, rerender, unmount } = await joinRoom()
    room(socket)
    let now = 1000
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] })
    vi.spyOn(performance, "now").mockImplementation(() => now)
    try {
      act(() => socket.receive(startEvent()))
      act(() => socket.receive(startEvent()))
      expect(state.reset).toHaveBeenCalledTimes(1)
      now += 4000
      act(() => vi.advanceTimersByTime(100))
      expect(screen.getByText("6", { exact: true })).toBeVisible()
      now += 6000
      act(() => vi.advanceTimersByTime(100))
      expect(screen.getByText("0", { exact: true })).toBeVisible()
      expect(screen.queryByText("你的分數")).not.toBeInTheDocument()
      act(() => socket.receive(beginEvent()))
      expect(screen.getByText("01:00")).toBeVisible()
      now += 59_000
      act(() => vi.advanceTimersByTime(100))
      expect(screen.getByText("00:01")).toBeVisible()
      act(() => socket.receive(beginEvent()))
      expect(screen.getByText("00:01")).toBeVisible()
      now += 1000
      act(() => vi.advanceTimersByTime(100))
      expect(screen.getByText("00:00")).toBeVisible()
      state.pose = normalizeFrame(serverFrame({ rep_count: 3 }))
      rerender(<PKPage />)
      expect(socket.sent).toEqual([])
      expect(screen.queryByText("平手")).not.toBeInTheDocument()
      act(() =>
        socket.receive({
          type: "GAME_END",
          score: 1,
          opponent_score: 2,
          result: "lose",
        })
      )
      expect(screen.getByText("對手獲勝")).toBeVisible()
      act(() => {
        socket.receive(beginEvent())
        socket.receive({
          type: "GAME_END",
          score: 99,
          opponent_score: 0,
          result: "win",
        })
      })
      expect(screen.getByText("對手獲勝")).toBeVisible()
      unmount()
      expect(vi.getTimerCount()).toBe(0)
    } finally {
      vi.useRealTimers()
      vi.restoreAllMocks()
    }
  })

  it.each(["countdown", "playing"])(
    "returns to the room when the opponent leaves during %s",
    async (phase) => {
      const { socket, rerender } = await joinRoom()
      room(socket)
      act(() => socket.receive(startEvent()))
      if (phase === "playing") act(() => socket.receive(beginEvent()))
      room(socket, 1, false)
      expect(
        screen.getByText("對手已離開，比賽取消。重新加入後請再次準備。")
      ).toBeVisible()
      expect(screen.getByRole("button", { name: "準備完成" })).toBeDisabled()
      state.pose = normalizeFrame(serverFrame({ rep_count: 4 }))
      rerender(<PKPage />)
      expect(socket.sent).toEqual([])
      room(socket, 2, false)
      expect(screen.getByRole("button", { name: "準備完成" })).toBeEnabled()
    }
  )

  it("ignores a token response after unmount", async () => {
    let resolve!: (value: string) => void
    state.token.mockReturnValue(
      new Promise<string>((done) => {
        resolve = done
      })
    )
    const user = userEvent.setup()
    const { unmount } = render(<PKPage />)
    await user.click(screen.getByRole("button", { name: "建立對戰房間" }))
    unmount()
    await act(async () => resolve("late-jwt"))
    expect(TestSocket.instances).toHaveLength(0)
  })
})
