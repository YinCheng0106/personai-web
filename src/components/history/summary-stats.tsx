import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ProgressBar } from "@/components/ui/progress-bar"
import { EXERCISE_LABEL } from "@/types/pose"
import type { ExerciseSummary } from "@/types/workout"

type Props = {
  summary: ExerciseSummary[]
}

export function SummaryStats({ summary }: Props) {
  const total = summary.reduce((s, r) => s + r.totalReps, 0) || 1
  return (
    <Card>
      <CardHeader>
        <CardTitle>分項統計</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {summary.map((row) => {
          const pct = (row.totalReps / total) * 100
          return (
            <div key={row.exercise} className="space-y-1.5">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-medium">{EXERCISE_LABEL[row.exercise]}</span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {row.totalReps} 下 · {row.totalCalories} kcal · {row.sessions} 場
                </span>
              </div>
              <ProgressBar value={pct} tone="primary" />
              <div className="text-[11px] text-muted-foreground tabular-nums">
                平均姿勢 {row.avgFormScore}
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
