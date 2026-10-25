"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { DoorOpen, Loader, Swords, Timer, Trophy } from "lucide-react"

import { RequireAuth } from "@/components/auth/require-auth"
import { CalorieDisplay } from "@/components/fitness/calorie-display"
import { CameraFrame } from "@/components/fitness/camera-frame"
import { ErrorList } from "@/components/fitness/error-list"
import { HUDOverlay } from "@/components/fitness/hud-overlay"
import { PageContainer } from "@/components/layout/page-container"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { usePoseAnalysis } from "@/hooks/use-pose-analysis"
import { getAccessToken } from "@/lib/auth-client"
import { connectPKSocket, type PKTiming } from "@/lib/socket"
import { cn } from "@/lib/utils"
import type { ExerciseType } from "@/types/pose"

type GameState = "lobby" | "room" | "countdown" | "playing" | "finished"

type ConnectionState = "offline" | "connecting" | "connected"

const PREPARE_SECONDS = 10
const MATCH_SECONDS = 60

const CLOSE_MESSAGE: Record<number, string> = {
  4400: "房間資訊或對戰訊息格式不正確。",
  4401: "登入已失效，請重新登入。",
  4403: "目前的網站來源不允許連線。",
  4409: "房間已滿，或你已在另一個視窗加入此房間。",
  4429: "訊息傳送過於頻繁，請稍後再試。",
}

function createRoomCode() {
  const value = new Uint32Array(1)
  crypto.getRandomValues(value)
  return String(1000 + (value[0] % 9000))
}

function formatTime(seconds: number) {
  const safeSeconds = Math.max(0, seconds)
  const minutes = Math.floor(safeSeconds / 60)
  const remainingSeconds = safeSeconds % 60

  return `${String(minutes).padStart(2, "0")}:${String(
    remainingSeconds
  ).padStart(2, "0")}`
}

export default function GamePKPage() {
  const [gameState, setGameState] = useState<GameState>("lobby")
  const [matchGeneration, setMatchGeneration] = useState(0)
  const [connection, setConnection] = useState<ConnectionState>("offline")

  const [roomId, setRoomId] = useState("")
  const [inputRoomId, setInputRoomId] = useState("")
  const [exercise, setExercise] = useState<ExerciseType>("squat")

  const [isReady, setIsReady] = useState(false)
  const [opponentReady, setOpponentReady] = useState(false)
  const [playerCount, setPlayerCount] = useState(0)
  const [opponentScore, setOpponentScore] = useState(0)

  const [countdown, setCountdown] = useState(PREPARE_SECONDS)
  const [prepareDeadline, setPrepareDeadline] = useState(0)
  const [matchDeadline, setMatchDeadline] = useState(0)
  const [matchDuration, setMatchDuration] = useState(MATCH_SECONDS)
  const [remainingTime, setRemainingTime] = useState(MATCH_SECONDS)

  const [finalScore, setFinalScore] = useState(0)
  const [finalOpponentScore, setFinalOpponentScore] = useState(0)
  const [finalResult, setFinalResult] = useState<"win" | "lose" | "draw">(
    "draw"
  )

  const [error, setError] = useState<string | null>(null)
  const [video, setVideo] = useState<HTMLVideoElement | null>(null)

  const socketRef = useRef<WebSocket | null>(null)
  const lastSentScoreRef = useRef(0)
  const phaseRef = useRef<GameState>("lobby")
  const attemptRef = useRef(0)
  const matchDeadlineRef = useRef(0)
  const matchGenerationRef = useRef(0)

  const {
    pose,
    status,
    error: poseError,
    reset,
  } = usePoseAnalysis({
    active: gameState === "playing" && remainingTime > 0,
    exercise,
    video,
  })

  const resetMatch = useCallback(() => {
    setMatchGeneration(++matchGenerationRef.current)
    matchDeadlineRef.current = 0
    lastSentScoreRef.current = 0
    setIsReady(false)
    setOpponentReady(false)
    setOpponentScore(0)
    setCountdown(PREPARE_SECONDS)
    setPrepareDeadline(0)
    setMatchDeadline(0)
    setMatchDuration(MATCH_SECONDS)
    setRemainingTime(MATCH_SECONDS)
    setFinalScore(0)
    setFinalOpponentScore(0)
    setFinalResult("draw")
    setVideo(null)
    reset()
  }, [reset])

  const leaveRoom = useCallback(() => {
    const socket = socketRef.current
    socketRef.current = null
    phaseRef.current = "lobby"
    attemptRef.current++
    socket?.close(1000, "User left room")
    setGameState("lobby")
    setConnection("offline")
    setRoomId("")
    setPlayerCount(0)
    setError(null)
    resetMatch()
  }, [resetMatch])

  useEffect(() => {
    const attempts = attemptRef
    const generations = matchGenerationRef
    return () => {
      attempts.current++
      generations.current++
      const socket = socketRef.current
      socketRef.current = null
      socket?.close(1000, "Page closed")
    }
  }, [])

  const connectToRoom = useCallback(
    async (targetRoomId: string) => {
      if (!/^[0-9]{4}$/.test(targetRoomId)) {
        setError("請輸入 4 位數房號。")
        return
      }

      setConnection("connecting")
      setError(null)

      const previousSocket = socketRef.current
      socketRef.current = null
      previousSocket?.close(1000, "Replaced connection")
      const attempt = ++attemptRef.current

      try {
        const token = await getAccessToken()
        if (attempt !== attemptRef.current) return

        // Timing windows identify successive matches on this connection. Keep the
        // seen windows after cancellation so a delayed start cannot replay one.
        let latestTiming: PKTiming | null = null
        const startedWindows = new Set<string>()
        const socket = connectPKSocket(targetRoomId, exercise, token, {
          onOpen: () => {
            if (socketRef.current !== socket) return

            setConnection("connected")
            setRoomId(targetRoomId)
            phaseRef.current = "room"
            setGameState("room")
          },

          onRoomState: (state) => {
            if (socketRef.current !== socket) return

            setPlayerCount(state.playerCount)
            setOpponentReady(state.opponentReady)
            setOpponentScore(state.opponentScore)

            if (state.ready !== undefined) setIsReady(state.ready)
            if (state.playerCount < 2) setIsReady(false)
            if (state.phase === "waiting" && phaseRef.current !== "finished") {
              if (
                phaseRef.current === "countdown" ||
                phaseRef.current === "playing"
              ) {
                setError("對手已離開，比賽取消。重新加入後請再次準備。")
                resetMatch()
              }
              phaseRef.current = "room"
              setGameState("room")
            }
          },

          // 後端通知：雙方準備完成，進入 10 秒準備倒數。
          onGameStart: (countdownSeconds, durationSeconds, timing) => {
            if (socketRef.current !== socket) return

            const windowKey = `${timing.startsAtMs}:${timing.endsAtMs}`
            if (phaseRef.current !== "room" || startedWindows.has(windowKey))
              return
            startedWindows.add(windowKey)
            latestTiming = timing
            setMatchGeneration(++matchGenerationRef.current)
            phaseRef.current = "countdown"
            lastSentScoreRef.current = 0

            reset()

            setOpponentScore(0)
            setFinalScore(0)
            setFinalOpponentScore(0)
            setFinalResult("draw")

            const now = performance.now()
            const prepareLeft = Math.max(
              0,
              timing.startsAtMs - timing.serverTimeMs
            )
            const matchLeft = Math.max(0, timing.endsAtMs - timing.serverTimeMs)
            setPrepareDeadline(now + prepareLeft)
            matchDeadlineRef.current = now + matchLeft
            setMatchDeadline(matchDeadlineRef.current)
            setCountdown(
              Math.min(countdownSeconds, Math.ceil(prepareLeft / 1000))
            )
            setMatchDuration(durationSeconds)
            setRemainingTime(durationSeconds)

            setError(null)
            setGameState("countdown")
          },

          // 後端通知：正式比賽開始。
          onGameBegin: (durationSeconds, timing) => {
            if (socketRef.current !== socket) return

            if (
              phaseRef.current !== "countdown" ||
              !latestTiming ||
              timing.startsAtMs !== latestTiming.startsAtMs ||
              timing.endsAtMs !== latestTiming.endsAtMs
            )
              return
            phaseRef.current = "playing"
            const deadline = Math.min(
              matchDeadlineRef.current,
              performance.now() +
                Math.max(0, timing.endsAtMs - timing.serverTimeMs)
            )
            matchDeadlineRef.current = deadline
            setMatchDeadline(deadline)
            setMatchDuration(durationSeconds)
            setRemainingTime(
              Math.max(0, Math.ceil((deadline - performance.now()) / 1000))
            )
            setGameState("playing")
          },

          // 後端通知：比賽結束，使用伺服器最終分數。
          onGameEnd: (result) => {
            if (socketRef.current !== socket) return

            if (
              phaseRef.current !== "countdown" &&
              phaseRef.current !== "playing"
            )
              return
            matchGenerationRef.current++
            phaseRef.current = "finished"
            setFinalScore(result.score)
            setFinalOpponentScore(result.opponentScore)
            setFinalResult(result.result)
            setRemainingTime(0)
            setOpponentScore(result.opponentScore)
            setGameState("finished")
          },

          onOpponentScore: (score) => {
            if (
              socketRef.current === socket &&
              phaseRef.current === "playing"
            ) {
              setOpponentScore(score)
            }
          },

          onError: () => {
            if (socketRef.current === socket) {
              setError("無法連線至對戰服務，請確認後端是否已啟動。")
            }
          },

          onClose: (event) => {
            if (socketRef.current !== socket) return

            socketRef.current = null
            setConnection("offline")
            setPlayerCount(0)
            setIsReady(false)
            setOpponentReady(false)

            if (phaseRef.current !== "finished") {
              phaseRef.current = "lobby"
              setGameState("lobby")
              setRoomId("")
              resetMatch()
            }
            if (event.code !== 1000) {
              setError(
                CLOSE_MESSAGE[event.code] ?? "對戰連線已中斷，請重新加入。"
              )
            }
          },
        })

        socketRef.current = socket
      } catch {
        if (attempt !== attemptRef.current) return
        setConnection("offline")
        setError("無法取得登入憑證，請重新登入後再試。")
      }
    },
    [exercise, reset, resetMatch]
  )

  // 顯示 10 秒準備倒數。
  // 是否真正開始比賽，由後端的 GAME_BEGIN 決定。
  useEffect(() => {
    if (gameState !== "countdown") return

    const generation = matchGenerationRef.current
    const endAt = prepareDeadline

    const timer = window.setInterval(() => {
      if (
        matchGenerationRef.current !== generation ||
        phaseRef.current !== "countdown"
      )
        return
      const left = Math.max(0, Math.ceil((endAt - performance.now()) / 1000))

      setCountdown(left)
    }, 100)

    return () => window.clearInterval(timer)
  }, [gameState, prepareDeadline, matchGeneration])

  // 正式比賽時間只用來顯示倒數。
  // 最終結束與分數仍以後端 GAME_END 為準。
  useEffect(() => {
    if (gameState !== "playing") return

    const generation = matchGenerationRef.current
    const endAt = matchDeadline

    const timer = window.setInterval(() => {
      if (
        matchGenerationRef.current !== generation ||
        phaseRef.current !== "playing"
      )
        return
      const left = Math.max(0, Math.ceil((endAt - performance.now()) / 1000))

      setRemainingTime(left)
    }, 100)

    return () => window.clearInterval(timer)
  }, [gameState, matchDeadline, matchGeneration])

  // 只有正式比賽期間才傳送分數。
  useEffect(() => {
    if (
      gameState !== "playing" ||
      phaseRef.current !== "playing" ||
      performance.now() >= matchDeadlineRef.current ||
      pose.trackingState !== "ACTIVE" ||
      pose.reps <= lastSentScoreRef.current
    ) {
      return
    }

    const socket = socketRef.current

    if (socket?.readyState !== WebSocket.OPEN) return

    for (
      let score = lastSentScoreRef.current + 1;
      score <= pose.reps;
      score++
    ) {
      socket.send(JSON.stringify({ type: "SCORE_UPDATE", score }))
    }

    lastSentScoreRef.current = pose.reps
  }, [gameState, pose.reps, pose.trackingState])

  function toggleReady() {
    const socket = socketRef.current

    if (socket?.readyState !== WebSocket.OPEN || playerCount !== 2) {
      return
    }

    const ready = !isReady
    setIsReady(ready)

    socket.send(JSON.stringify({ type: "READY", ready }))
  }

  const connectionLabel =
    connection === "connected"
      ? `已連線 · 房號 ${roomId}`
      : connection === "connecting"
        ? "連線中…"
        : "尚未加入房間"

  const resultLabel =
    finalResult === "win"
      ? "你贏了！"
      : finalResult === "lose"
        ? "對手獲勝"
        : "平手"

  return (
    <PageContainer
      title="1v1 動作對戰"
      description="雙方各自在瀏覽器辨識姿勢，伺服器交換房間狀態與動作次數。"
      action={
        gameState !== "lobby" ? (
          <Button variant="outline" size="sm" onClick={leaveRoom}>
            <DoorOpen size={14} />
            離開房間
          </Button>
        ) : undefined
      }
    >
      <RequireAuth
        title="登入後加入動作對戰"
        description="對戰使用與即時分析相同的安全登入憑證與姿勢辨識流程。"
      >
        <div className="mx-auto max-w-5xl space-y-4">
          <div
            className="flex items-center justify-between gap-3 text-sm"
            aria-live="polite"
          >
            <span
              className={cn(
                "rounded-full border px-3 py-1 font-medium",
                connection === "connected"
                  ? "border-success/30 bg-success/10 text-success"
                  : "border-border bg-muted text-muted-foreground"
              )}
            >
              {connectionLabel}
            </span>

            {error ? <span className="text-destructive">{error}</span> : null}
          </div>

          {gameState === "lobby" ? (
            <Card className="mx-auto max-w-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Swords size={18} />
                  建立或加入房間
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-5">
                <label className="block space-y-1.5 text-sm">
                  <span className="text-muted-foreground">對戰動作</span>
                  <select
                    value={exercise}
                    onChange={(event) =>
                      setExercise(event.target.value as ExerciseType)
                    }
                    className="h-10 w-full rounded-xl border border-border bg-background px-3"
                  >
                    <option value="squat">深蹲</option>
                    <option value="pushup">伏地挺身</option>
                  </select>
                </label>

                <p className="text-xs text-muted-foreground">
                  未提供體重仍可正常對戰；只有熱量估算會顯示為未估算。
                </p>

                <Button
                  className="w-full"
                  disabled={connection === "connecting"}
                  onClick={() => void connectToRoom(createRoomCode())}
                >
                  {connection === "connecting" ? (
                    <Loader className="animate-spin" size={16} />
                  ) : (
                    <Swords size={16} />
                  )}
                  建立對戰房間
                </Button>

                <div className="flex gap-2 border-t border-border pt-5">
                  <label className="sr-only" htmlFor="room-code">
                    4 位數房號
                  </label>

                  <input
                    id="room-code"
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="輸入 4 位數房號"
                    value={inputRoomId}
                    onChange={(event) =>
                      setInputRoomId(
                        event.target.value.replace(/\D/g, "").slice(0, 4)
                      )
                    }
                    className="h-10 min-w-0 flex-1 rounded-xl border border-border bg-background px-3 text-center tabular-nums"
                  />

                  <Button
                    variant="outline"
                    disabled={
                      connection === "connecting" || inputRoomId.length !== 4
                    }
                    onClick={() => void connectToRoom(inputRoomId)}
                  >
                    加入
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {gameState === "room" ? (
            <Card className="mx-auto max-w-xl">
              <CardHeader>
                <CardTitle>房間 {roomId}</CardTitle>
              </CardHeader>

              <CardContent className="space-y-5">
                <p className="text-sm text-muted-foreground">
                  {exercise === "squat" ? "深蹲" : "伏地挺身"}對戰 ·
                  雙方準備完成後，先倒數 10 秒，再正式比賽 60 秒。
                </p>

                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="rounded-2xl border border-border bg-muted/40 p-4">
                    <p className="text-xs text-muted-foreground">你</p>
                    <p
                      className={cn(
                        "mt-1 font-medium",
                        isReady && "text-success"
                      )}
                    >
                      {isReady ? "已準備" : "尚未準備"}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-border bg-muted/40 p-4">
                    <p className="text-xs text-muted-foreground">對手</p>
                    <p
                      className={cn(
                        "mt-1 font-medium",
                        opponentReady && "text-success"
                      )}
                    >
                      {playerCount < 2
                        ? "等待加入"
                        : opponentReady
                          ? "已準備"
                          : "尚未準備"}
                    </p>
                  </div>
                </div>

                <Button
                  className="w-full"
                  variant={isReady ? "outline" : "default"}
                  disabled={playerCount !== 2}
                  onClick={toggleReady}
                >
                  {isReady ? "取消準備" : "準備完成"}
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {gameState === "countdown" ? (
            <Card className="mx-auto max-w-xl text-center">
              <CardContent className="space-y-5 py-12">
                <Timer className="mx-auto" size={36} />

                <p className="text-lg font-medium">準備開始！</p>

                <p className="text-8xl font-bold text-primary tabular-nums">
                  {countdown}
                </p>

                <p className="text-muted-foreground">
                  請站好位置、確認攝影機畫面，準備開始對戰。
                </p>

                <p className="text-sm text-muted-foreground">
                  正式比賽時間：{matchDuration} 秒
                </p>
              </CardContent>
            </Card>
          ) : null}

          {gameState === "playing" ? (
            <div className="space-y-4">
              <Card>
                <CardContent className="py-5 text-center">
                  <p className="text-sm text-muted-foreground">剩餘比賽時間</p>

                  <p
                    className={cn(
                      "mt-1 text-5xl font-bold tabular-nums",
                      remainingTime <= 10 ? "text-destructive" : "text-primary"
                    )}
                  >
                    {formatTime(remainingTime)}
                  </p>
                </CardContent>
              </Card>

              <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(16rem,1fr)]">
                <div className="space-y-4">
                  <div className="grid grid-cols-3 items-center rounded-2xl border border-border bg-card p-4 text-center">
                    <div>
                      <p className="text-xs text-muted-foreground">你的分數</p>
                      <p className="text-3xl font-semibold text-primary tabular-nums">
                        {pose.reps}
                      </p>
                    </div>

                    <strong className="text-muted-foreground">VS</strong>

                    <div>
                      <p className="text-xs text-muted-foreground">對手分數</p>
                      <p className="text-3xl font-semibold tabular-nums">
                        {opponentScore}
                      </p>
                    </div>
                  </div>

                  <CameraFrame
                    active={remainingTime > 0}
                    onVideoReady={setVideo}
                    className="border border-border"
                  >
                    <HUDOverlay pose={pose} exerciseLabel={exercise} />
                  </CameraFrame>
                </div>

                <div className="space-y-4">
                  <CalorieDisplay
                    reps={pose.reps}
                    calories={pose.calories}
                    durationSec={matchDuration - remainingTime}
                    confidence={pose.confidence}
                  />

                  <Card>
                    <CardHeader>
                      <CardTitle>分析狀態</CardTitle>
                    </CardHeader>

                    <CardContent className="text-sm text-muted-foreground">
                      {poseError ??
                        (status === "live"
                          ? "即時姿勢辨識中"
                          : "正在啟動姿勢辨識…")}
                    </CardContent>
                  </Card>

                  <ErrorList
                    errors={pose.formErrors}
                    isAnalyzing={pose.trackingState === "ACTIVE"}
                  />
                </div>
              </div>
            </div>
          ) : null}

          {gameState === "finished" ? (
            <Card className="mx-auto max-w-xl">
              <CardHeader>
                <CardTitle className="flex items-center justify-center gap-2">
                  <Trophy size={22} />
                  對戰結束
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-6 text-center">
                <p className="text-3xl font-bold">{resultLabel}</p>

                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-2xl border border-border bg-muted/40 p-5">
                    <p className="text-sm text-muted-foreground">你的分數</p>
                    <p className="mt-2 text-4xl font-bold text-primary tabular-nums">
                      {finalScore}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-border bg-muted/40 p-5">
                    <p className="text-sm text-muted-foreground">對手分數</p>
                    <p className="mt-2 text-4xl font-bold tabular-nums">
                      {finalOpponentScore}
                    </p>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground">
                  本場對戰時間已結束，分數以伺服器紀錄為準。
                </p>

                <Button className="w-full" onClick={leaveRoom}>
                  返回 PK 大廳
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </RequireAuth>
    </PageContainer>
  )
}
