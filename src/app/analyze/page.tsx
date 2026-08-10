"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { CameraType } from "react-camera-pro"
import { Play, RotateCcw, Square } from "lucide-react"

import { RequireAuth } from "@/components/auth/require-auth"
import { AngleDisplay } from "@/components/fitness/angle-display"
import { CalorieDisplay } from "@/components/fitness/calorie-display"
import { CameraFrame } from "@/components/fitness/camera-frame"
import { ErrorList } from "@/components/fitness/error-list"
import { ExerciseSelector } from "@/components/fitness/exercise-selector"
import { HUDOverlay } from "@/components/fitness/hud-overlay"
import { PageContainer } from "@/components/layout/page-container"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { usePoseAnalysis } from "@/hooks/use-pose-analysis"
import { api } from "@/lib/api"
import { useSession } from "@/lib/auth-client"
import type { ExerciseType } from "@/types/pose"

const HIGHLIGHTS: Record<
  ExerciseType,
  Array<
    | "leftKnee"
    | "rightKnee"
    | "leftHip"
    | "rightHip"
    | "leftElbow"
    | "rightElbow"
  >
> = {
  squat: ["leftKnee", "rightKnee", "leftHip", "rightHip"],
  pushup: ["leftElbow", "rightElbow", "leftHip", "rightHip"],
}

const STATUS_LABEL = {
  idle: "尚未開始",
  "loading-model": "載入姿勢模型中…",
  connecting: "連線分析伺服器中…",
  live: "即時分析中",
  error: "分析連線異常",
} as const

export default function AnalyzePage() {
  const cameraRef = useRef<CameraType>(null)
  const errorEvents = useRef(0)
  const hadErrors = useRef(false)
  const session = useSession()
  const [video, setVideo] = useState<HTMLVideoElement | null>(null)
  const [exercise, setExercise] = useState<ExerciseType>("squat")
  const [weightKg, setWeightKg] = useState(70)
  const [running, setRunning] = useState(false)
  const [duration, setDuration] = useState(0)
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const { pose, status, error, reset } = usePoseAnalysis({
    active: running,
    exercise,
    weightKg,
    video,
  })

  const handleVideoReady = useCallback((element: HTMLVideoElement | null) => {
    setVideo(element)
  }, [])

  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setDuration((value) => value + 1), 1000)
    return () => clearInterval(id)
  }, [running])

  useEffect(() => {
    const hasErrors = pose.errors.length > 0
    if (running && hasErrors && !hadErrors.current) errorEvents.current += 1
    hadErrors.current = hasErrors
  }, [pose.errors, running])

  function startTraining() {
    setDuration(0)
    setSaveMessage(null)
    errorEvents.current = 0
    hadErrors.current = false
    reset()
    setRunning(true)
  }

  async function stopTraining() {
    setRunning(false)
    if (!session.data || duration <= 0) return
    setSaving(true)
    setSaveMessage(null)
    try {
      await api.postWorkoutRecord(session.data.user.id, {
        exercise,
        reps: pose.reps,
        durationSec: duration,
        calories: pose.calories,
        errorsCount: errorEvents.current,
      })
      setSaveMessage("本次訓練已儲存。")
    } catch (cause) {
      setSaveMessage(
        cause instanceof Error ? cause.message : "訓練紀錄儲存失敗。"
      )
    } finally {
      setSaving(false)
    }
  }

  function handleReset() {
    reset()
    setDuration(0)
    errorEvents.current = 0
    hadErrors.current = false
    setSaveMessage(null)
  }

  return (
    <PageContainer
      title="即時分析"
      description="相機影像只在瀏覽器內處理，後端僅接收 33 個人體關鍵點。"
      action={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={saving}
          >
            <RotateCcw size={14} />
            重置
          </Button>
          <Button
            size="sm"
            onClick={running ? stopTraining : startTraining}
            variant={running ? "destructive" : "default"}
            disabled={saving}
          >
            {running ? <Square size={14} /> : <Play size={14} />}
            {saving ? "儲存中…" : running ? "停止並儲存" : "開始訓練"}
          </Button>
        </div>
      }
    >
      <RequireAuth
        title="登入後開始訓練"
        description="登入後才能儲存分析結果與訓練紀錄。"
      >
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <div className="space-y-4">
            <CameraFrame
              ref={cameraRef}
              active={running}
              onVideoReady={handleVideoReady}
            >
              {running ? (
                <HUDOverlay pose={pose} exerciseLabel={exercise} />
              ) : null}
            </CameraFrame>
            <Card>
              <CardHeader>
                <CardTitle>訓練設定</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <ExerciseSelector
                  value={exercise}
                  onChange={setExercise}
                  disabled={running}
                />
                <label className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">體重（kg）</span>
                  <input
                    type="number"
                    min={20}
                    max={300}
                    step={0.5}
                    value={weightKg}
                    disabled={running}
                    onChange={(event) =>
                      setWeightKg(Number(event.target.value))
                    }
                    className="h-9 w-24 rounded-xl border border-border bg-background px-3 text-right"
                  />
                </label>
                <div className="text-xs text-muted-foreground">
                  {STATUS_LABEL[status]}
                  {error ? (
                    <span className="ml-2 text-destructive">{error}</span>
                  ) : null}
                  {saveMessage ? (
                    <span className="ml-2 text-primary">{saveMessage}</span>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          </div>
          <div className="space-y-4">
            <CalorieDisplay
              reps={pose.reps}
              calories={pose.calories}
              durationSec={duration}
              confidence={pose.confidence}
            />
            <AngleDisplay
              angles={pose.angles}
              highlight={HIGHLIGHTS[exercise]}
            />
            <ErrorList errors={pose.errors} />
          </div>
        </div>
      </RequireAuth>
    </PageContainer>
  )
}
