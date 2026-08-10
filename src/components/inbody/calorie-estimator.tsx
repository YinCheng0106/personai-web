"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EXERCISES } from "@/lib/constants"
import { api } from "@/lib/api"
import { cn } from "@/lib/utils"
import type { ExerciseType } from "@/types/pose"

type Props = {
  userId: string
}

export function CalorieEstimator({ userId }: Props) {
  const [exercise, setExercise] = useState<ExerciseType>("squat")
  const [duration, setDuration] = useState(8)
  const [calories, setCalories] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function estimate() {
    setLoading(true)
    setError(null)
    try {
      const result = await api.estimateCalories(userId, {
        exercise,
        durationMin: duration,
      })
      setCalories(result.calories)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "估算失敗。")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <CardTitle>卡路里估算器</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col space-y-4">
        <div className="grid grid-cols-2 gap-2">
          {EXERCISES.map((item) => (
            <button
              key={item.value}
              onClick={() => setExercise(item.value)}
              className={cn(
                "rounded-xl border px-3 py-2 text-sm font-medium transition-colors",
                item.value === exercise
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border bg-card hover:bg-muted/60"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
        <Field label="時長（分鐘）" value={duration} onChange={setDuration} />
        <Button
          type="button"
          variant="outline"
          onClick={() => void estimate()}
          disabled={loading || duration <= 0}
        >
          {loading ? "估算中…" : "使用已儲存體重估算"}
        </Button>
        <div className="flex flex-1 flex-col items-center justify-center rounded-xl bg-muted/60 p-4 text-center">
          <div className="text-xs text-muted-foreground">預估燃燒</div>
          <div className="text-4xl font-semibold tabular-nums tracking-tight">
            {calories === null ? "—" : calories.toFixed(1)}
            <span className="ml-1 text-sm font-normal text-muted-foreground">
              kcal
            </span>
          </div>
          {error ? (
            <p className="mt-2 text-xs text-destructive">{error}</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (value: number) => void
}) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <input
        type="number"
        min={1}
        max={1440}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-9 w-24 rounded-xl border border-border bg-background px-3 text-right text-sm tabular-nums"
      />
    </label>
  )
}
