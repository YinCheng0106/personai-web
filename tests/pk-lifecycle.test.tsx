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
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

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

  it.each([
    ["win", "你贏了！", 2, 7],
    ["lose", "對手獲勝", 9, 1],
    ["draw", "平手", 4, 4],
  ])(
    "uses the server's %s result and final scores without deriving a winner",
    async (result, label, score, opponentScore) => {
      const { socket, rerender } = await joinRoom()
      act(() => socket.receive(startEvent()))
      act(() => socket.receive(beginEvent()))
      state.pose = normalizeFrame(serverFrame({ rep_count: 2 }))
      rerender(<PKPage />)
      const sent = socket.sent.length
      act(() =>
        socket.receive({
          type: "GAME_END",
          score,
          opponent_score: opponentScore,
          result,
        })
      )
      expect(screen.getByText(label)).toBeVisible()
      expect(
        screen.getAllByText(String(score), { exact: true })[0]
      ).toBeVisible()
      expect(
        screen.getAllByText(String(opponentScore), { exact: true })[0]
      ).toBeVisible()
      state.pose = normalizeFrame(serverFrame({ rep_count: 10 }))
      rerender(<PKPage />)
      act(() => {
        socket.receive(startEvent())
        socket.receive(beginEvent())
        socket.receive({ type: "OPPONENT_SCORE", score: 99 })
      })
      expect(socket.sent).toHaveLength(sent)
      expect(screen.getByText(label)).toBeVisible()
      expect(screen.queryByText("99", { exact: true })).not.toBeInTheDocument()
    }
  )

  it("does not send ACTIVE reps during preparation or start on an out-of-order begin", async () => {
    const { socket, rerender } = await joinRoom()
    act(() => socket.receive(beginEvent()))
    expect(screen.queryByText("你的分數")).not.toBeInTheDocument()
    act(() =>
      socket.receive({
        type: "GAME_END",
        score: 0,
        opponent_score: 0,
        result: "draw",
      })
    )
    expect(screen.queryByText("平手")).not.toBeInTheDocument()
    act(() => socket.receive(startEvent()))
    state.pose = normalizeFrame(serverFrame({ rep_count: 3 }))
    rerender(<PKPage />)
    expect(socket.sent).toEqual([])
    expect(screen.getByText("準備開始！")).toBeVisible()
  })

  it("ignores a begin with a different match window and permits a fresh match after cancellation", async () => {
    const { socket } = await joinRoom()
    act(() => socket.receive(startEvent()))
    room(socket, 1, false)
    act(() => socket.receive(startEvent()))
    expect(screen.queryByText("準備開始！")).not.toBeInTheDocument()
    const nextStart = {
      ...startEvent(),
      server_time_ms: 2_000_000,
      starts_at_ms: 2_010_000,
      ends_at_ms: 2_070_000,
    }
    room(socket)
    act(() => socket.receive(nextStart))
    expect(screen.getByText("準備開始！")).toBeVisible()
    act(() => socket.receive(beginEvent()))
    expect(screen.queryByText("你的分數")).not.toBeInTheDocument()
    act(() =>
      socket.receive({
        ...beginEvent(),
        server_time_ms: 2_010_000,
        starts_at_ms: 2_010_000,
        ends_at_ms: 2_070_000,
      })
    )
    expect(screen.getByText("01:00")).toBeVisible()
  })

  it.each(["countdown", "playing"])(
    "cleans up when leaving during %s and isolates the next connection",
    async (phase) => {
      const { socket, user, rerender } = await joinRoom()
      vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] })
      act(() => socket.receive(startEvent()))
      if (phase === "playing") act(() => socket.receive(beginEvent()))
      expect(vi.getTimerCount()).toBe(1)
      await user.click(screen.getByRole("button", { name: "離開房間" }))
      expect(vi.getTimerCount()).toBe(0)
      await user.click(screen.getByRole("button", { name: "加入" }))
      await act(async () => {})
      const nextSocket = TestSocket.instances[1]
      act(() => nextSocket.open())
      act(() => {
        socket.open()
        socket.receive(startEvent())
        socket.receive(beginEvent())
        socket.receive({
          type: "GAME_END",
          score: 99,
          opponent_score: 0,
          result: "win",
        })
        socket.onerror?.(new Event("error"))
        socket.close(4401)
      })
      expect(screen.getByText("已連線 · 房號 1234")).toBeVisible()
      expect(
        screen.queryByText("登入已失效，請重新登入。")
      ).not.toBeInTheDocument()
      act(() => nextSocket.receive(startEvent()))
      act(() => nextSocket.receive(beginEvent()))
      state.pose = normalizeFrame(serverFrame({ rep_count: 1 }))
      rerender(<PKPage />)
      expect(nextSocket.sent.map((value) => JSON.parse(value))).toEqual([
        { type: "SCORE_UPDATE", score: 1 },
      ])
    }
  )

  it.each(["countdown", "playing"])(
    "cleans up a disconnect during %s and fetches a new JWT on rejoin",
    async (phase) => {
      const { socket, user, rerender } = await joinRoom()
      vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] })
      act(() => socket.receive(startEvent()))
      if (phase === "playing") act(() => socket.receive(beginEvent()))
      act(() => socket.close(1006))
      expect(vi.getTimerCount()).toBe(0)
      state.pose = normalizeFrame(serverFrame({ rep_count: 3 }))
      rerender(<PKPage />)
      expect(socket.sent).toEqual([])
      state.token.mockResolvedValue("fresh-jwt")
      await user.clear(screen.getByLabelText("4 位數房號"))
      await user.type(screen.getByLabelText("4 位數房號"), "5678")
      await user.click(screen.getByRole("button", { name: "加入" }))
      await act(async () => {})
      const nextSocket = TestSocket.instances[1]
      expect(nextSocket.protocols).toEqual(["personai.v1", "fresh-jwt"])
      expect(new URL(nextSocket.url).searchParams.get("room")).toBe("5678")
      act(() => nextSocket.open())
      act(() => nextSocket.receive(startEvent()))
      expect(screen.getByText("準備開始！")).toBeVisible()
      expect(screen.getByText("10", { exact: true })).toBeVisible()
    }
  )

  it.each(["countdown", "playing"])(
    "removes timers on unmount during %s",
    async (phase) => {
      const { socket, unmount } = await joinRoom()
      vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] })
      act(() => socket.receive(startEvent()))
      if (phase === "playing") act(() => socket.receive(beginEvent()))
      unmount()
      expect(vi.getTimerCount()).toBe(0)
      expect(socket.closes).toContainEqual({
        code: 1000,
        reason: "Page closed",
      })
      const resetCount = state.reset.mock.calls.length
      act(() => {
        socket.receive(startEvent())
        socket.receive(beginEvent())
      })
      expect(state.reset).toHaveBeenCalledTimes(resetCount)
    }
  )

  it.each(["countdown", "playing"])(
    "ignores a retired %s interval callback after a new match starts",
    async (phase) => {
      const { socket } = await joinRoom()
      vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] })
      vi.spyOn(performance, "now").mockReturnValue(1000)
      const intervals = vi.spyOn(window, "setInterval")
      act(() => socket.receive(startEvent()))
      if (phase === "playing") act(() => socket.receive(beginEvent()))
      const oldTick = intervals.mock.calls.at(-1)![0] as () => void
      room(socket, 1, false)
      act(() =>
        socket.receive({
          ...startEvent(),
          server_time_ms: 2_000_000,
          starts_at_ms: 2_010_000,
          ends_at_ms: 2_070_000,
        })
      )
      if (phase === "playing")
        act(() =>
          socket.receive({
            ...beginEvent(),
            server_time_ms: 2_010_000,
            starts_at_ms: 2_010_000,
            ends_at_ms: 2_070_000,
          })
        )
      vi.spyOn(performance, "now").mockReturnValue(6000)
      act(() => vi.advanceTimersByTime(100))
      const expected = phase === "playing" ? "00:55" : "5"
      expect(screen.getByText(expected, { exact: true })).toBeVisible()
      // A callback queued before clearInterval must not mutate the next match.
      vi.spyOn(performance, "now").mockReturnValue(11_000)
      act(() => oldTick())
      expect(screen.getByText(expected, { exact: true })).toBeVisible()
    }
  )

  it("accepts a new window after cancellation even if the server wall clock moved backwards", async () => {
    const { socket } = await joinRoom()
    act(() => socket.receive(startEvent()))
    room(socket, 1, false)
    act(() =>
      socket.receive({
        ...startEvent(),
        server_time_ms: 500_000,
        starts_at_ms: 510_000,
        ends_at_ms: 570_000,
      })
    )
    expect(screen.getByText("準備開始！")).toBeVisible()
    act(() =>
      socket.receive({
        ...beginEvent(),
        server_time_ms: 510_000,
        starts_at_ms: 510_000,
        ends_at_ms: 570_000,
      })
    )
    expect(screen.getByText("你的分數")).toBeVisible()
  })

  it("accepts a server result during preparation when the server skips an expired playing period", async () => {
    const { socket } = await joinRoom()
    act(() => socket.receive(startEvent()))
    act(() =>
      socket.receive({
        type: "GAME_END",
        score: 0,
        opponent_score: 0,
        result: "draw",
      })
    )
    expect(screen.getByText("平手")).toBeVisible()
    act(() => socket.close(1006))
    expect(screen.getByText("平手")).toBeVisible()
    expect(screen.getByText("對戰連線已中斷，請重新加入。")).toBeVisible()
  })

  it("replaces the countdown interval when cancellation and restart are batched", async () => {
    const { socket } = await joinRoom()
    let now = 1000
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] })
    vi.spyOn(performance, "now").mockImplementation(() => now)
    act(() => socket.receive(startEvent()))
    act(() => {
      socket.receive({
        type: "ROOM_STATE",
        player_count: 1,
        opponent_ready: false,
        opponent_score: 0,
        exercise_type: "squat",
        phase: "waiting",
      })
      socket.receive({
        ...startEvent(),
        server_time_ms: 2_000_000,
        starts_at_ms: 2_010_000,
        ends_at_ms: 2_070_000,
      })
    })
    now += 1000
    act(() => vi.advanceTimersByTime(100))
    expect(screen.getByText("9", { exact: true })).toBeVisible()
    expect(vi.getTimerCount()).toBe(1)
  })

  it("blocks scores while the transport is closing before its close callback", async () => {
    const { socket, user, rerender } = await joinRoom()
    room(socket)
    socket.readyState = 2 // CLOSING, before the close event is dispatched.
    await user.click(screen.getByRole("button", { name: "準備完成" }))
    expect(socket.sent).toEqual([])
    socket.readyState = TestSocket.OPEN
    act(() => socket.receive(startEvent()))
    act(() => socket.receive(beginEvent()))
    socket.readyState = 2
    state.pose = normalizeFrame(serverFrame({ rep_count: 1 }))
    rerender(<PKPage />)
    expect(socket.sent).toEqual([])
    act(() => socket.close(1000))
    expect(screen.getByRole("button", { name: "建立對戰房間" })).toBeVisible()
    expect(
      screen.queryByText("對戰連線已中斷，請重新加入。")
    ).not.toBeInTheDocument()
  })

  it("applies readiness snapshots, reports current socket errors, and ignores retired room events", async () => {
    const { socket, user } = await joinRoom()
    act(() =>
      socket.receive({
        type: "ROOM_STATE",
        player_count: 2,
        ready: true,
        opponent_ready: false,
        opponent_score: 0,
        exercise_type: "squat",
        phase: "waiting",
      })
    )
    expect(screen.getByRole("button", { name: "取消準備" })).toBeVisible()
    act(() => socket.onerror?.(new Event("error")))
    expect(
      screen.getByText("無法連線至對戰服務，請確認後端是否已啟動。")
    ).toBeVisible()
    await user.click(screen.getByRole("button", { name: "離開房間" }))
    room(socket)
    expect(screen.getByRole("button", { name: "建立對戰房間" })).toBeVisible()
  })
})
