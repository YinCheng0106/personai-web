import { describe, expect, it, vi } from "vitest"

import {
  connectAnalyzeSocket,
  connectPKSocket,
  normalizeFrame,
} from "@/lib/socket"

describe("pose socket contract", () => {
  it("normalizes frame identifiers, timing, and snake_case angles", () => {
    const result = normalizeFrame({
      frame_id: 12,
      processing_ms: 4.25,
      rep_count: 3,
      state: "BOTTOM",
      angles: { left_knee: 91, right_knee: 93 },
      errors: [],
      confidence: 0.9,
      is_visible: true,
      tracking_state: "ACTIVE",
      tracking_hints: [],
      form_errors: [],
      calories: 1.2,
    })

    expect(result).toMatchObject({
      frameId: 12,
      processingMs: 4.25,
      reps: 3,
      state: "bottom",
      angles: { leftKnee: 91, rightKnee: 93 },
      trackingState: "ACTIVE",
      formErrors: [],
      trackingHints: [],
    })
  })

  it("keeps unavailable angles null and separates tracking hints", () => {
    const result = normalizeFrame({
      frame_id: 13,
      processing_ms: 1,
      rep_count: 3,
      state: "IDLE",
      angles: { left_knee: null },
      errors: [],
      form_errors: [],
      tracking_hints: ["SQUAT_KNEES_NOT_VISIBLE"],
      tracking_state: "PAUSED",
      confidence: 0.4,
      is_visible: false,
      calories: 1.2,
    })

    expect(result.angles.leftKnee).toBeNull()
    expect(result.formErrors).toEqual([])
    expect(result.trackingHints).toEqual(["SQUAT_KNEES_NOT_VISIBLE"])
    expect(result.trackingState).toBe("PAUSED")
  })

  it("passes the JWT in Sec-WebSocket-Protocol instead of the URL", () => {
    const constructor = vi.fn(function MockWebSocket(
      this: Record<string, unknown>,
      url: string,
      protocols: string[]
    ) {
      this.url = url
      this.protocols = protocols
    })
    vi.stubGlobal("WebSocket", constructor)

    connectAnalyzeSocket("squat", 70, "header.payload.signature", {
      onFrame: vi.fn(),
    })

    expect(constructor).toHaveBeenCalledWith(
      "ws://localhost:8000/ws/analyze/squat?weight_kg=70",
      ["personai.v1", "header.payload.signature"]
    )
    expect(constructor.mock.calls[0][0]).not.toContain("signature")
    vi.unstubAllGlobals()
  })

  it("authenticates the PK socket without putting the JWT in its URL", () => {
    const constructor = vi.fn(function MockWebSocket(
      this: Record<string, unknown>,
      url: string,
      protocols: string[]
    ) {
      this.url = url
      this.protocols = protocols
    })
    vi.stubGlobal("WebSocket", constructor)

    connectPKSocket("1234", "pushup", "header.payload.signature", {
      onRoomState: vi.fn(),
      onGameStart: vi.fn(),
      onOpponentScore: vi.fn(),
    })

    expect(constructor).toHaveBeenCalledWith(
      "ws://localhost:8000/ws/pk?room=1234&exercise_type=pushup",
      ["personai.v1", "header.payload.signature"]
    )
    expect(constructor.mock.calls[0][0]).not.toContain("signature")
    vi.unstubAllGlobals()
  })
})
