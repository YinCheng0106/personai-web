import { describe, expect, it } from "vitest"

import { createPoseObservation } from "@/lib/pose-messages"

describe("pose observation messages", () => {
  it("emits an explicit pose_missing message when MediaPipe finds no pose", () => {
    expect(createPoseObservation(125, 10.416, undefined)).toEqual({
      kind: "pose_missing",
      frame_id: 125,
      timestamp: 10.416,
    })
  })

  it("emits a version-compatible landmark frame for 33 points", () => {
    const landmarks = Array.from({ length: 33 }, () => ({
      x: 0.5,
      y: 0.4,
      z: 0,
      visibility: 0.9,
    }))

    const message = createPoseObservation(126, 10.5, landmarks)

    expect(message.kind).toBe("landmarks")
    expect("keypoints" in message && message.keypoints).toHaveLength(33)
  })
})
