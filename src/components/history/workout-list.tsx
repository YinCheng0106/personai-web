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

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const hours = Math.round(diff / (1000 * 60 * 60))
  if (hours < 1) return "剛剛"
  if (hours < 24) return `${hours} 小時前`
  return `${Math.round(hours / 24)} 天前`
}

export function WorkoutList({ records }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>歷次訓練</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-border/60">
          {records.map((r) => (
            <li key={r.id} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-muted text-muted-foreground">
                <HugeiconsIcon icon={ICON[r.exercise]} size={20} strokeWidth={2} />
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
              <div className="text-right">
                <div className="text-xs font-medium tabular-nums">
                  {formatRelative(r.performedAt)}
                </div>
                <div className="text-[11px] text-muted-foreground tabular-nums">
                  {new Date(r.performedAt).toLocaleDateString("zh-TW", {
                    month: "2-digit",
                    day: "2-digit",
                  })}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
