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
  phase?: string
}

export type PKGameResult = {
  score: number
  opponentScore: number
  result: "win" | "lose" | "draw"
}

export type PKSocketHandlers = {
  onOpen?: () => void
  onClose?: (event: CloseEvent) => void
  onError?: () => void
  onRoomState: (state: PKRoomState) => void
  onGameStart: (countdownSeconds: number, durationSeconds: number) => void
  onGameBegin: (durationSeconds: number) => void
  onGameEnd: (result: PKGameResult) => void
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
      // Ignore malformed frames.
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
  const query = new URLSearchParams({
    room,
    exercise_type: exercise,
  })

  const ws = new WebSocket(
    `${WS_BASE}/ws/pk?${query}`,
    ["personai.v1", token]
  )

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
          (data.exercise_type === "squat" ||
            data.exercise_type === "pushup")
        ) {
          handlers.onRoomState({
            playerCount: data.player_count,
            opponentReady: data.opponent_ready,
            opponentScore: data.opponent_score,
            exercise: data.exercise_type,
            phase:
              typeof data.phase === "string" ? data.phase : undefined,
          })
        }
      } else if (data.type === "GAME_START") {
        const countdownSeconds =
          typeof data.countdown_seconds === "number"
            ? data.countdown_seconds
            : 10

        const durationSeconds =
          typeof data.duration_seconds === "number"
            ? data.duration_seconds
            : 60

        handlers.onGameStart(countdownSeconds, durationSeconds)
      } else if (data.type === "GAME_BEGIN") {
        const durationSeconds =
          typeof data.duration_seconds === "number"
            ? data.duration_seconds
            : 60

        handlers.onGameBegin(durationSeconds)
      } else if (
        data.type === "GAME_END" &&
        typeof data.score === "number" &&
        typeof data.opponent_score === "number" &&
        (data.result === "win" ||
          data.result === "lose" ||
          data.result === "draw")
      ) {
        handlers.onGameEnd({
          score: data.score,
          opponentScore: data.opponent_score,
          result: data.result,
        })
      } else if (
        data.type === "OPPONENT_SCORE" &&
        typeof data.score === "number"
      ) {
        handlers.onOpponentScore(data.score)
      }
    } catch {
      // Ignore malformed server messages.
    }
  }

  return ws
}
