type LandmarkObservation = {
  x: number
  y: number
  z?: number
  visibility?: number
}

export function createPoseObservation(
  frameId: number,
  timestamp: number,
  landmarks: LandmarkObservation[] | undefined
) {
  if (landmarks?.length !== 33) {
    return {
      kind: "pose_missing" as const,
      frame_id: frameId,
      timestamp,
    }
  }

  return {
    kind: "landmarks" as const,
    frame_id: frameId,
    keypoints: landmarks.map((point) => ({
      x: point.x,
      y: point.y,
      z: point.z ?? 0,
      visibility: point.visibility ?? 0,
    })),
    timestamp,
  }
}
