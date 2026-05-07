"use client"

import { useEffect, useRef, useState } from "react"
import type { CameraType } from "react-camera-pro"
import { HugeiconsIcon } from "@hugeicons/react"
import { PlayIcon, ReloadIcon, StopCircleIcon } from "@hugeicons/core-free-icons"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PageContainer } from "@/components/layout/page-container"
import { CameraFrame } from "@/components/fitness/camera-frame"
import { HUDOverlay } from "@/components/fitness/hud-overlay"
import { ExerciseSelector } from "@/components/fitness/exercise-selector"
import { AngleDisplay } from "@/components/fitness/angle-display"
import { ErrorList } from "@/components/fitness/error-list"
import { CalorieDisplay } from "@/components/fitness/calorie-display"
import { useMockPose } from "@/hooks/use-mock-pose"
import { EXERCISE_LABEL, type ExerciseType } from "@/types/pose"

const HIGHLIGHTS: Record<ExerciseType, Array<"leftKnee" | "rightKnee" | "leftHip" | "rightHip" | "leftElbow" | "rightElbow">> = {
  squat: ["leftKnee", "rightKnee", "leftHip", "rightHip"],
  pushup: ["leftElbow", "rightElbow", "leftHip", "rightHip"],
}

export default function AnalyzePage() {
  const cameraRef = useRef<CameraType>(null)
  const [exercise, setExercise] = useState<ExerciseType>("squat")
  const [running, setRunning] = useState(false)
  const [duration, setDuration] = useState(0)

  const pose = useMockPose({ exercise, active: running })

  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setDuration((d) => d + 1), 1000)
    return () => clearInterval(id)
  }, [running])

  function handleReset() {
    setRunning(false)
    setDuration(0)
  }

  return (
    <PageContainer
      title="即時分析"
      description="開啟相機，AI 會即時偵測動作姿態並計算次數。"
      action={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={!running && duration === 0}
          >
            <HugeiconsIcon icon={ReloadIcon} size={14} strokeWidth={2} />
            重置
          </Button>
          <Button
            size="sm"
            onClick={() => setRunning((r) => !r)}
            variant={running ? "destructive" : "default"}
          >
            <HugeiconsIcon
              icon={running ? StopCircleIcon : PlayIcon}
              size={14}
              strokeWidth={2}
            />
            {running ? "停止訓練" : "開始訓練"}
          </Button>
        </div>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <CameraFrame ref={cameraRef} active={running}>
            {running ? (
              <HUDOverlay pose={pose} exerciseLabel={EXERCISE_LABEL[exercise]} />
            ) : null}
          </CameraFrame>
          <Card>
            <CardHeader>
              <CardTitle>選擇動作</CardTitle>
            </CardHeader>
            <CardContent>
              <ExerciseSelector
                value={exercise}
                onChange={setExercise}
                disabled={running}
              />
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
          <AngleDisplay angles={pose.angles} highlight={HIGHLIGHTS[exercise]} />
          <ErrorList errors={pose.errors} />
        </div>
      </div>
    </PageContainer>
  )
}
