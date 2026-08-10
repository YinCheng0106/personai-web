import type { ExerciseType, PoseData, ServerFrame } from "@/types/pose"

const WS_BASE = process.env.NEXT_PUBLIC_WS_BASE ?? "ws://localhost:8000"

export function normalizeFrame(frame: ServerFrame): PoseData {
  const a = frame.angles ?? {}
  return {
    reps: frame.rep_count,
    state: (frame.state.toLowerCase() as PoseData["state"]) ?? "idle",
    angles: {
      leftKnee: a.left_knee ?? 0,
      rightKnee: a.right_knee ?? 0,
      leftHip: a.left_hip ?? a.left_body ?? 0,
      rightHip: a.right_hip ?? a.right_body ?? 0,
      leftElbow: a.left_elbow ?? 0,
      rightElbow: a.right_elbow ?? 0,
    },
    errors: frame.errors ?? [],
    confidence: frame.confidence,
    isVisible: frame.is_visible,
    calories: frame.calories,
  }
}

export type AnalyzeSocketHandlers = {
  onFrame: (data: PoseData) => void
  onOpen?: () => void
  onClose?: () => void
  onError?: (err: Event) => void
  onServerError?: (message: string) => void
}

export function connectAnalyzeSocket(
  exercise: ExerciseType,
  weightKg: number,
  handlers: AnalyzeSocketHandlers
): WebSocket {
  const url = `${WS_BASE}/ws/analyze/${exercise}?weight_kg=${weightKg}`
  const ws = new WebSocket(url)
  ws.onopen = () => handlers.onOpen?.()
  ws.onclose = () => handlers.onClose?.()
  ws.onerror = (e) => handlers.onError?.(e)
  ws.onmessage = (e) => {
    try {
      const parsed = JSON.parse(e.data) as ServerFrame & { error?: string }
      if (parsed.error) {
        handlers.onServerError?.(parsed.error)
        return
      }
      handlers.onFrame(normalizeFrame(parsed))
    } catch {
      // ignore malformed frames
    }
  }
  return ws
}
