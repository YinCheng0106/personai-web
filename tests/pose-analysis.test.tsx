import { act, renderHook, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { deferred, serverFrame } from "./helpers/fixtures"
import { TestSocket } from "./helpers/socket"

const boundary = vi.hoisted(() => ({
  token: vi.fn(),
  detect: vi.fn(),
}))
vi.mock("@/lib/auth-client", () => ({ getAccessToken: boundary.token }))
vi.mock("@mediapipe/tasks-vision", () => ({
  FilesetResolver: { forVisionTasks: vi.fn().mockResolvedValue({}) },
  PoseLandmarker: {
    createFromOptions: vi
      .fn()
      .mockResolvedValue({ detectForVideo: boundary.detect }),
  },
}))

import { EMPTY_POSE, usePoseAnalysis } from "@/hooks/use-pose-analysis"

describe("pose analysis lifecycle with a controlled camera/model boundary", () => {
  let nextFrame: FrameRequestCallback | undefined
  let now: number
  let video: HTMLVideoElement

  beforeEach(() => {
    TestSocket.instances = []
    boundary.token.mockReset().mockResolvedValue("signed-jwt")
    boundary.detect.mockReset().mockReturnValue({ landmarks: [] })
    now = 1000
    nextFrame = undefined
    vi.stubGlobal("WebSocket", TestSocket)
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn((callback) => {
        nextFrame = callback
        return 1
      })
    )
    vi.stubGlobal("cancelAnimationFrame", vi.fn())
    vi.spyOn(performance, "now").mockImplementation(() => now)
    video = document.createElement("video")
    Object.defineProperty(video, "readyState", {
      value: HTMLMediaElement.HAVE_CURRENT_DATA,
    })
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  function setup(active = true) {
    return renderHook(
      ({ active }) => usePoseAnalysis({ active, exercise: "squat", video }),
      { initialProps: { active } }
    )
  }
  async function connected() {
    await waitFor(() => expect(TestSocket.instances).toHaveLength(1))
    await waitFor(() => expect(nextFrame).toBeTypeOf("function"))
    const socket = TestSocket.instances[0]
    act(() => socket.open())
    return socket
  }
  function tick(seconds: number) {
    now += 100
    video.currentTime = seconds
    act(() => nextFrame?.(now))
  }

  it("stays idle without opening a socket or acquiring a JWT when inactive", () => {
    const { result } = setup(false)
    expect(result.current.status).toBe("idle")
    expect(result.current.pose).toEqual(EMPTY_POSE)
    expect(boundary.token).not.toHaveBeenCalled()
    expect(TestSocket.instances).toHaveLength(0)
  })

  it("sends pose_missing then only 33 keypoints with increasing frame ids and seconds", async () => {
    const { result, unmount } = setup()
    const socket = await connected()
    expect(socket.protocols).toEqual(["personai.v1", "signed-jwt"])
    expect(result.current.status).toBe("live")
    tick(1)
    expect(JSON.parse(socket.sent[0])).toEqual({
      kind: "pose_missing",
      frame_id: 1,
      timestamp: 1.1,
    })
    boundary.detect.mockReturnValue({
      landmarks: [Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.4 }))],
    })
    tick(2)
    expect(JSON.parse(socket.sent[1])).toEqual({
      kind: "landmarks",
      frame_id: 2,
      timestamp: 1.2,
      keypoints: Array.from({ length: 33 }, () => ({
        x: 0.5,
        y: 0.4,
        z: 0,
        visibility: 0,
      })),
    })
    const sent = socket.sent.length
    tick(2) // A repeated video time must not send another observation.
    expect(socket.sent).toHaveLength(sent)
    unmount()
    expect(socket.closes).toHaveLength(1)
    expect(cancelAnimationFrame).toHaveBeenCalled()
    tick(3)
    expect(socket.sent).toHaveLength(sent)
  })

  it("ignores stale/duplicate results, preserves LOST reps, and resets only on request", async () => {
    const { result } = setup()
    const socket = await connected()
    act(() =>
      socket.receive(
        serverFrame({
          frame_id: 10,
          rep_count: 5,
          tracking_state: "LOST",
          tracking_hints: ["POSE_NOT_FOUND"],
        })
      )
    )
    act(() => {
      socket.receive(serverFrame({ frame_id: 9, rep_count: 99 }))
      socket.receive(serverFrame({ frame_id: 10, rep_count: 99 }))
    })
    expect(result.current.pose).toMatchObject({
      frameId: 10,
      reps: 5,
      trackingState: "LOST",
      calories: null,
      formErrors: [],
    })
    act(() => result.current.reset())
    expect(result.current.pose).toEqual(EMPTY_POSE)
    expect(socket.sent).toEqual([JSON.stringify({ action: "reset" })])
  })

  it("closes the connection when stopped and ignores late server events", async () => {
    const { result, rerender } = setup()
    const socket = await connected()
    act(() => socket.receive(serverFrame({ frame_id: 2 })))
    rerender({ active: false })
    act(() => socket.receive(serverFrame({ frame_id: 3, rep_count: 99 })))
    expect(result.current.pose.reps).toBe(3)
    expect(result.current.status).toBe("idle")
    expect(socket.closes).toHaveLength(1)
  })

  it("does not connect after a pending JWT resolves following unmount", async () => {
    const token = deferred<string>()
    boundary.token.mockReturnValue(token.promise)
    const { unmount } = setup()
    unmount()
    await act(async () => token.resolve("late-jwt"))
    expect(TestSocket.instances).toHaveLength(0)
  })

  it("shows JWT failure without attempting an unauthenticated socket", async () => {
    boundary.token.mockRejectedValue(new Error("登入已失效"))
    const { result } = setup()
    await waitFor(() => expect(result.current.status).toBe("error"))
    expect(result.current.error).toBe("登入已失效")
    expect(TestSocket.instances).toHaveLength(0)
  })

  it("surfaces transport, server, and detector failures", async () => {
    const { result } = setup()
    const socket = await connected()
    act(() => socket.onerror?.(new Event("error")))
    expect(result.current.error).toBe("無法連線至姿勢分析伺服器。")
    act(() => socket.receive({ error: "Too many frames" }))
    expect(result.current.error).toBe("Too many frames")
    boundary.detect.mockImplementation(() => {
      throw new Error("Model failed")
    })
    tick(1)
    expect(result.current.error).toBe("Model failed")
    act(() => socket.close(1006))
    expect(result.current.status).toBe("error")
  })
})
