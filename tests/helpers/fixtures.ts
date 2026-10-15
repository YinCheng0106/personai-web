import type { ServerFrame } from "@/types/pose"

export function serverFrame(values: Partial<ServerFrame> = {}): ServerFrame {
  return {
    frame_id: 1,
    processing_ms: 4,
    rep_count: 3,
    state: "UP",
    angles: {},
    form_errors: [],
    tracking_hints: [],
    tracking_state: "ACTIVE",
    confidence: 0.9,
    is_visible: true,
    calories: null,
    ...values,
  }
}

export const workoutWire = {
  id: "record-1",
  user_id: "private-user",
  exercise_type: "squat",
  reps: 3,
  sets: 1,
  duration_sec: 60,
  calories_burned: null,
  avg_intensity: "moderate",
  errors_count: 0,
  form_score: 100,
  timestamp: "2026-10-15T00:00:00Z",
}

export function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}
