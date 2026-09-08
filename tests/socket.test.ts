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
      calories: 1.2,
    })

    expect(result).toMatchObject({
      frameId: 12,
      processingMs: 4.25,
      reps: 3,
      state: "bottom",
      angles: { leftKnee: 91, rightKnee: 93 },
    })
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
