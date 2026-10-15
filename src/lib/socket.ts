import type { ExerciseType, PoseData, ServerFrame } from "@/types/pose"

const WS_BASE = process.env.NEXT_PUBLIC_WS_BASE ?? "ws://localhost:8000"

export function normalizeFrame(frame: ServerFrame): PoseData {
  const a = frame.angles ?? {}
  const angle = (value: number | null | undefined) => value ?? null
  return {
    frameId: frame.frame_id,
    processingMs: frame.processing_ms,
    reps: frame.rep_count,
    state: (frame.state.toLowerCase() as PoseData["state"]) ?? "idle",
    angles: {
      leftKnee: angle(a.left_knee),
      rightKnee: angle(a.right_knee),
      leftHip: angle(a.left_hip ?? a.left_body),
      rightHip: angle(a.right_hip ?? a.right_body),
      leftElbow: angle(a.left_elbow),
      rightElbow: angle(a.right_elbow),
    },
    formErrors: frame.form_errors ?? frame.errors ?? [],
    trackingHints: frame.tracking_hints ?? [],
    trackingState:
      frame.tracking_state ?? (frame.is_visible ? "ACTIVE" : "PAUSED"),
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
  phase?: "waiting" | "countdown" | "playing" | "finished"
  ready?: boolean
}

export type PKGameResult = {
  score: number
  opponentScore: number
  result: "win" | "lose" | "draw"
}

export type PKTiming = {
  serverTimeMs: number
  startsAtMs: number
  endsAtMs: number
}

export type PKSocketHandlers = {
  onOpen?: () => void
  onClose?: (event: CloseEvent) => void
  onError?: () => void
  onRoomState: (state: PKRoomState) => void
  onGameStart: (
    countdownSeconds: number,
    durationSeconds: number,
    timing: PKTiming
  ) => void
  onGameBegin: (durationSeconds: number, timing: PKTiming) => void
  onGameEnd: (result: PKGameResult) => void
  onOpponentScore: (score: number) => void
}

export function connectAnalyzeSocket(
  exercise: ExerciseType,
  token: string,
  handlers: AnalyzeSocketHandlers
): WebSocket {
  const url = `${WS_BASE}/ws/analyze/${exercise}`
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
  const query = new URLSearchParams({
    room,
    exercise_type: exercise,
  })

  const ws = new WebSocket(`${WS_BASE}/ws/pk?${query}`, ["personai.v1", token])

  ws.onopen = () => handlers.onOpen?.()
  ws.onclose = (event) => handlers.onClose?.(event)
  ws.onerror = () => handlers.onError?.()

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data) as Record<string, unknown>
      if (!data || typeof data !== "object") return
      const score = (value: unknown): value is number =>
        Number.isInteger(value) &&
        (value as number) >= 0 &&
        (value as number) <= 10_000
      const timing = (): PKTiming | null => {
        const values = [data.server_time_ms, data.starts_at_ms, data.ends_at_ms]
        if (
          !values.every(
            (value) =>
              typeof value === "number" && Number.isFinite(value) && value >= 0
          )
        )
          return null
        if ((data.ends_at_ms as number) < (data.starts_at_ms as number))
          return null
        return {
          serverTimeMs: data.server_time_ms as number,
          startsAtMs: data.starts_at_ms as number,
          endsAtMs: data.ends_at_ms as number,
        }
      }

      if (data.type === "ROOM_STATE") {
        if (
          Number.isInteger(data.player_count) &&
          (data.player_count === 1 || data.player_count === 2) &&
          typeof data.opponent_ready === "boolean" &&
          score(data.opponent_score) &&
          (data.exercise_type === "squat" || data.exercise_type === "pushup")
        ) {
          handlers.onRoomState({
            playerCount: data.player_count,
            opponentReady: data.opponent_ready,
            opponentScore: data.opponent_score,
            exercise: data.exercise_type,
            ...(data.phase === "waiting" ||
            data.phase === "countdown" ||
            data.phase === "playing" ||
            data.phase === "finished"
              ? { phase: data.phase }
              : {}),
            ...(typeof data.ready === "boolean" ? { ready: data.ready } : {}),
          })
        }
      } else if (data.type === "GAME_START") {
        const clock = timing()
        if (
          clock &&
          data.countdown_seconds === 10 &&
          data.duration_seconds === 60
        ) {
          handlers.onGameStart(10, 60, clock)
        }
      } else if (data.type === "GAME_BEGIN") {
        const clock = timing()
        if (clock && data.duration_seconds === 60) {
          handlers.onGameBegin(60, clock)
        }
      } else if (
        data.type === "GAME_END" &&
        score(data.score) &&
        score(data.opponent_score) &&
        (data.result === "win" ||
          data.result === "lose" ||
          data.result === "draw")
      ) {
        handlers.onGameEnd({
          score: data.score,
          opponentScore: data.opponent_score,
          result: data.result,
        })
      } else if (data.type === "OPPONENT_SCORE" && score(data.score)) {
        handlers.onOpponentScore(data.score)
      }
    } catch {
      // Ignore malformed server messages.
    }
  }

  return ws
}
