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

it.each([0, 1, 32, 34])(
  "treats %s landmarks as pose_missing without partial keypoints",
  (count) => {
    const message = createPoseObservation(
      10,
      1,
      Array.from({ length: count }, () => ({ x: 0, y: 0 }))
    )
    expect(message).toEqual({
      kind: "pose_missing",
      frame_id: 10,
      timestamp: 1,
    })
  }
)

it("preserves zero coordinates and defaults absent z/visibility without adding video data", () => {
  const message = createPoseObservation(
    11,
    2,
    Array.from({ length: 33 }, () => ({ x: 0, y: 0 }))
  )
  expect(message).toEqual({
    kind: "landmarks",
    frame_id: 11,
    timestamp: 2,
    keypoints: Array.from({ length: 33 }, () => ({
      x: 0,
      y: 0,
      z: 0,
      visibility: 0,
    })),
  })
})
