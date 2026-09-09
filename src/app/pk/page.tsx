"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { DoorOpen, Loader, Swords } from "lucide-react"

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
import { connectPKSocket } from "@/lib/socket"
import { cn } from "@/lib/utils"
import type { ExerciseType } from "@/types/pose"

type GameState = "lobby" | "room" | "playing"
type ConnectionState = "offline" | "connecting" | "connected"

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

export default function GamePKPage() {
  const [gameState, setGameState] = useState<GameState>("lobby")
  const [connection, setConnection] = useState<ConnectionState>("offline")
  const [roomId, setRoomId] = useState("")
  const [inputRoomId, setInputRoomId] = useState("")
  const [exercise, setExercise] = useState<ExerciseType>("squat")
  const [weightKg, setWeightKg] = useState(70)
  const [isReady, setIsReady] = useState(false)
  const [opponentReady, setOpponentReady] = useState(false)
  const [playerCount, setPlayerCount] = useState(0)
  const [opponentScore, setOpponentScore] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [video, setVideo] = useState<HTMLVideoElement | null>(null)
  const socketRef = useRef<WebSocket | null>(null)
  const lastSentScoreRef = useRef(0)

  const {
    pose,
    status,
    error: poseError,
    reset,
  } = usePoseAnalysis({
    active: gameState === "playing",
    exercise,
    weightKg,
    video,
  })

  const leaveRoom = useCallback(() => {
    const socket = socketRef.current
    socketRef.current = null
    socket?.close(1000, "User left room")
    setGameState("lobby")
    setConnection("offline")
    setRoomId("")
    setIsReady(false)
    setOpponentReady(false)
    setPlayerCount(0)
    setOpponentScore(0)
    setVideo(null)
    lastSentScoreRef.current = 0
    reset()
  }, [reset])

  useEffect(() => {
    return () => {
      socketRef.current?.close(1000, "Page closed")
      socketRef.current = null
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
      socketRef.current?.close(1000, "Replaced connection")

      try {
        const token = await getAccessToken()
        const socket = connectPKSocket(targetRoomId, exercise, token, {
          onOpen: () => {
            if (socketRef.current !== socket) return
            setConnection("connected")
            setRoomId(targetRoomId)
            setGameState("room")
          },
          onRoomState: (state) => {
            if (socketRef.current !== socket) return
            setPlayerCount(state.playerCount)
            setOpponentReady(state.opponentReady)
            setOpponentScore(state.opponentScore)
            if (state.playerCount < 2) setIsReady(false)
          },
          onGameStart: () => {
            if (socketRef.current !== socket) return
            lastSentScoreRef.current = 0
            reset()
            setGameState("playing")
          },
          onOpponentScore: (score) => {
            if (socketRef.current === socket) setOpponentScore(score)
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
            setGameState("lobby")
            setPlayerCount(0)
            setIsReady(false)
            setOpponentReady(false)
            if (event.code !== 1000) {
              setError(
                CLOSE_MESSAGE[event.code] ?? "對戰連線已中斷，請重新加入。"
              )
            }
          },
        })
        socketRef.current = socket
      } catch {
        setConnection("offline")
        setError("無法取得登入憑證，請重新登入後再試。")
      }
    },
    [exercise, reset]
  )

  useEffect(() => {
    if (gameState !== "playing" || pose.reps <= lastSentScoreRef.current) {
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
  }, [gameState, pose.reps])

  function toggleReady() {
    const socket = socketRef.current
    if (socket?.readyState !== WebSocket.OPEN || playerCount !== 2) return
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

  return (
    <PageContainer
      title="1v1 動作對戰"
      description="雙方各自在瀏覽器辨識姿勢，伺服器只交換房間狀態與動作次數。"
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
                  <Swords size={18} /> 建立或加入房間
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
                <label className="block space-y-1.5 text-sm">
                  <span className="text-muted-foreground">體重（kg）</span>
                  <input
                    type="number"
                    min={20}
                    max={300}
                    step={0.5}
                    value={weightKg}
                    onChange={(event) =>
                      setWeightKg(Number(event.target.value))
                    }
                    className="h-10 w-full rounded-xl border border-border bg-background px-3"
                  />
                </label>
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
                  分享房號給對手，雙方準備後會自動開始。
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

          {gameState === "playing" ? (
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
                  active
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
                  durationSec={0}
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
                <ErrorList errors={pose.errors} />
              </div>
            </div>
          ) : null}
        </div>
      </RequireAuth>
    </PageContainer>
  )
}
