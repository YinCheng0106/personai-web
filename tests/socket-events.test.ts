import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  connectAnalyzeSocket,
  connectPKSocket,
  normalizeFrame,
} from "@/lib/socket"
import { serverFrame } from "./helpers/fixtures"
import { TestSocket } from "./helpers/socket"

describe("WebSocket event boundaries", () => {
  beforeEach(() => {
    TestSocket.instances = []
    vi.stubGlobal("WebSocket", TestSocket)
  })
  afterEach(() => vi.unstubAllGlobals())

  it("dispatches Analyze lifecycle, normalized frames, and server errors separately", () => {
    const handlers = {
      onOpen: vi.fn(),
      onClose: vi.fn(),
      onError: vi.fn(),
      onFrame: vi.fn(),
      onServerError: vi.fn(),
    }
    connectAnalyzeSocket("pushup", "jwt", handlers)
    const socket = TestSocket.instances[0]
    socket.open()
    socket.receiveRaw("not JSON")
    socket.receive(null)
    socket.receive({ state: null })
    socket.receive({ error: "Invalid pose message" })
    expect(handlers.onFrame).not.toHaveBeenCalled()
    expect(handlers.onServerError).toHaveBeenCalledExactlyOnceWith(
      "Invalid pose message"
    )
    socket.receive(serverFrame({ calories: 0, angles: { left_elbow: 0 } }))
    expect(handlers.onFrame).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        calories: 0,
        angles: expect.objectContaining({ leftElbow: 0, rightElbow: null }),
      })
    )
    const error = new Event("error")
    socket.onerror?.(error)
    socket.close()
    expect(handlers.onOpen).toHaveBeenCalledOnce()
    expect(handlers.onError).toHaveBeenCalledWith(error)
    expect(handlers.onClose).toHaveBeenCalledOnce()
  })

  it.each(["ACQUIRING", "ACTIVE", "PAUSED", "LOST"] as const)(
    "preserves %s, completed reps, and nullable angles without inventing calories",
    (tracking_state) => {
      const pose = normalizeFrame(
        serverFrame({ tracking_state, angles: { left_knee: null } })
      )
      expect(pose.trackingState).toBe(tracking_state)
      expect(pose.reps).toBe(3)
      expect(Object.values(pose.angles)).toEqual(Array(6).fill(null))
      expect(pose.calories).toBeNull()
    }
  )

  it("supports legacy angles/errors and visibility while preferring new form errors", () => {
    const legacy = serverFrame({
      tracking_state: undefined,
      form_errors: undefined,
      errors: ["legacy"],
      angles: { left_body: 120, right_body: 130 },
      is_visible: false,
    })
    expect(normalizeFrame(legacy)).toMatchObject({
      trackingState: "PAUSED",
      formErrors: ["legacy"],
      angles: { leftHip: 120, rightHip: 130 },
    })
    expect(
      normalizeFrame({
        ...legacy,
        is_visible: true,
        form_errors: [],
        angles: { left_hip: 0, left_body: 120 },
      })
    ).toMatchObject({
      trackingState: "ACTIVE",
      formErrors: [],
      angles: { leftHip: 0 },
    })
  })

  it("dispatches PK room/start/score/disconnect and ignores malformed or unrelated events", () => {
    const handlers = {
      onOpen: vi.fn(),
      onClose: vi.fn(),
      onError: vi.fn(),
      onRoomState: vi.fn(),
      onGameStart: vi.fn(),
      onGameBegin: vi.fn(),
      onGameEnd: vi.fn(),
      onOpponentScore: vi.fn(),
    }
    connectPKSocket("1234", "squat", "jwt", handlers)
    const socket = TestSocket.instances[0]
    socket.open()
    for (const data of [
      null,
      {},
      { type: "ROOM_STATE", player_count: "2" },
      { type: "OPPONENT_SCORE", score: "5" },
      { type: "UNKNOWN" },
    ])
      socket.receive(data)
    socket.receiveRaw("{")
    expect(handlers.onRoomState).not.toHaveBeenCalled()
    expect(handlers.onOpponentScore).not.toHaveBeenCalled()
    expect(handlers.onGameStart).not.toHaveBeenCalled()
    socket.receive({
      type: "ROOM_STATE",
      player_count: 2,
      opponent_ready: true,
      opponent_score: 0,
      exercise_type: "squat",
    })
    expect(handlers.onRoomState).toHaveBeenCalledExactlyOnceWith({
      playerCount: 2,
      opponentReady: true,
      opponentScore: 0,
      exercise: "squat",
    })
    socket.receive({
      type: "GAME_START",
      countdown_seconds: 10,
      duration_seconds: 60,
      server_time_ms: 1_000_000,
      starts_at_ms: 1_010_000,
      ends_at_ms: 1_070_000,
    })
    socket.receive({
      type: "GAME_BEGIN",
      duration_seconds: 60,
      server_time_ms: 1_010_000,
      starts_at_ms: 1_010_000,
      ends_at_ms: 1_070_000,
    })
    socket.receive({
      type: "GAME_END",
      score: 2,
      opponent_score: 4,
      result: "lose",
    })
    expect(handlers.onGameBegin).toHaveBeenCalledOnce()
    expect(handlers.onGameEnd).toHaveBeenCalledExactlyOnceWith({
      score: 2,
      opponentScore: 4,
      result: "lose",
    })
    socket.receive({ type: "OPPONENT_SCORE", score: 4 })
    expect(handlers.onGameStart).toHaveBeenCalledOnce()
    expect(handlers.onOpponentScore).toHaveBeenCalledExactlyOnceWith(4)
    socket.onerror?.(new Event("error"))
    socket.close(4409)
    expect(handlers.onOpen).toHaveBeenCalledOnce()
    expect(handlers.onError).toHaveBeenCalledOnce()
    expect(handlers.onClose).toHaveBeenCalledWith(
      expect.objectContaining({ code: 4409 })
    )
  })
})
