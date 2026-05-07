import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ProgressBar } from "@/components/ui/progress-bar"
import type { GoalProgress as Goal } from "@/types/workout"

type Props = {
  goals: Goal[]
}

export function GoalProgressCard({ goals }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>本週目標</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {goals.map((goal) => {
          const pct = Math.min(100, (goal.current / goal.target) * 100)
          const tone = pct >= 100 ? "success" : pct >= 60 ? "primary" : "warning"
          return (
            <div key={goal.label} className="space-y-1.5">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-medium">{goal.label}</span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {goal.current} / {goal.target} {goal.unit}
                </span>
              </div>
              <ProgressBar value={pct} tone={tone} />
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
