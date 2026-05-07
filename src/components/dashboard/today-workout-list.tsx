import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { HugeiconsIcon } from "@hugeicons/react"
import { WorkoutSquatsIcon, WorkoutWarmUpIcon } from "@hugeicons/core-free-icons"
import { EXERCISE_LABEL, type ExerciseType } from "@/types/pose"
import { formatDuration } from "@/lib/format"
import type { WorkoutRecord } from "@/types/workout"

type Props = {
  records: WorkoutRecord[]
}

const ICON: Record<ExerciseType, typeof WorkoutSquatsIcon> = {
  squat: WorkoutSquatsIcon,
  pushup: WorkoutWarmUpIcon,
}

export function TodayWorkoutList({ records }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>今日訓練</CardTitle>
      </CardHeader>
      <CardContent>
        {records.length === 0 ? (
          <p className="rounded-xl bg-muted/60 p-3 text-center text-sm text-muted-foreground">
            今天還沒有訓練紀錄，啟動一場分析開始吧！
          </p>
        ) : (
          <ul className="divide-y divide-border/60">
            {records.map((r) => (
              <li
                key={r.id}
                className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
              >
                <span className="grid h-10 w-10 place-items-center rounded-2xl bg-muted text-muted-foreground">
                  <HugeiconsIcon icon={ICON[r.exercise]} size={18} strokeWidth={2} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">
                      {EXERCISE_LABEL[r.exercise]}
                    </span>
                    <Badge tone={r.formScore >= 85 ? "success" : "warning"}>
                      姿勢 {r.formScore}
                    </Badge>
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                    {r.reps} 下 · {formatDuration(r.durationSec)} · {r.calories} kcal
                  </div>
                </div>
                <div className="text-right text-[11px] text-muted-foreground tabular-nums">
                  {new Date(r.performedAt).toLocaleTimeString("zh-TW", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
