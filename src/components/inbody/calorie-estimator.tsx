"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { EXERCISES } from "@/lib/constants"
import type { ExerciseType } from "@/types/pose"
import { cn } from "@/lib/utils"

const MET: Record<ExerciseType, number> = {
  squat: 5.0,
  pushup: 3.8,
}

type Props = {
  defaultWeightKg: number
}

export function CalorieEstimator({ defaultWeightKg }: Props) {
  const [exercise, setExercise] = useState<ExerciseType>("squat")
  const [reps, setReps] = useState(30)
  const [duration, setDuration] = useState(8)
  const [weight, setWeight] = useState(defaultWeightKg)

  const calories = useMemo(() => {
    const met = MET[exercise]
    return ((met * 3.5 * weight) / 200) * duration
  }, [exercise, weight, duration])

  return (
    <Card>
      <CardHeader>
        <CardTitle>卡路里估算器</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          {EXERCISES.map((ex) => {
            const active = ex.value === exercise
            return (
              <button
                key={ex.value}
                onClick={() => setExercise(ex.value)}
                className={cn(
                  "rounded-xl border px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border bg-card text-foreground hover:bg-muted/60",
                )}
              >
                {ex.label}
              </button>
            )
          })}
        </div>
        <Field label="體重 (kg)" value={weight} onChange={setWeight} step={0.5} />
        <Field label="次數" value={reps} onChange={setReps} step={1} />
        <Field label="時長 (分鐘)" value={duration} onChange={setDuration} step={1} />
        <div className="rounded-xl bg-muted/60 p-4 text-center">
          <div className="text-xs text-muted-foreground">預估燃燒</div>
          <div className="text-3xl font-semibold tabular-nums tracking-tight">
            {calories.toFixed(1)}
            <span className="ml-1 text-sm font-normal text-muted-foreground">kcal</span>
          </div>
        </div>
        <Button variant="outline" className="w-full" onClick={() => setReps((r) => r + 5)}>
          再加 5 下試試
        </Button>
      </CardContent>
    </Card>
  )
}

function Field({
  label,
  value,
  onChange,
  step,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  step: number
}) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <input
        type="number"
        value={value}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-9 w-24 rounded-xl border border-border bg-background px-3 text-right text-sm tabular-nums outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
      />
    </label>
  )
}
