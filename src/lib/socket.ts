import type { ExerciseType, PoseData, ServerFrame } from "@/types/pose"

const WS_BASE = process.env.NEXT_PUBLIC_WS_BASE ?? "ws://localhost:8000"

export function normalizeFrame(frame: ServerFrame): PoseData {
  const a = frame.angles ?? {}
  return {
    frameId: frame.frame_id,
    processingMs: frame.processing_ms,
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

export type PKRoomState = {
  playerCount: number
  opponentReady: boolean
  opponentScore: number
  exercise: ExerciseType
}

export type PKSocketHandlers = {
  onOpen?: () => void
  onClose?: (event: CloseEvent) => void
  onError?: () => void
  onRoomState: (state: PKRoomState) => void
  onGameStart: () => void
  onOpponentScore: (score: number) => void
}

export function connectAnalyzeSocket(
  exercise: ExerciseType,
  weightKg: number,
  token: string,
  handlers: AnalyzeSocketHandlers
): WebSocket {
  const url = `${WS_BASE}/ws/analyze/${exercise}?weight_kg=${weightKg}`
  const ws = new WebSocket(url, ["personai.v1", token])
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

export function connectPKSocket(
  room: string,
  exercise: ExerciseType,
  token: string,
  handlers: PKSocketHandlers
): WebSocket {
  const query = new URLSearchParams({ room, exercise_type: exercise })
  const ws = new WebSocket(`${WS_BASE}/ws/pk?${query}`, ["personai.v1", token])
  ws.onopen = () => handlers.onOpen?.()
  ws.onclose = (event) => handlers.onClose?.(event)
  ws.onerror = () => handlers.onError?.()
  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data) as Record<string, unknown>
      if (data.type === "ROOM_STATE") {
        if (
          typeof data.player_count === "number" &&
          typeof data.opponent_ready === "boolean" &&
          typeof data.opponent_score === "number" &&
          (data.exercise_type === "squat" || data.exercise_type === "pushup")
        ) {
          handlers.onRoomState({
            playerCount: data.player_count,
            opponentReady: data.opponent_ready,
            opponentScore: data.opponent_score,
            exercise: data.exercise_type,
          })
        }
      } else if (data.type === "GAME_START") {
        handlers.onGameStart()
      } else if (
        data.type === "OPPONENT_SCORE" &&
        typeof data.score === "number"
      ) {
        handlers.onOpponentScore(data.score)
      }
    } catch {
      // Ignore malformed server messages and keep the current room state.
    }
  }
  return ws
}
