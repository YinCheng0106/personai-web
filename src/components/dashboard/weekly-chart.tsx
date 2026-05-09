import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { DailySummary } from "@/types/workout"

type Props = {
  data: DailySummary[]
}

const WEEK_LABEL = ["日", "一", "二", "三", "四", "五", "六"]

export function WeeklyChart({ data }: Props) {
  const max = Math.max(1, ...data.map((d) => d.totalReps))
  const totalReps = data.reduce((s, d) => s + d.totalReps, 0)
  const totalCal = data.reduce((s, d) => s + d.totalCalories, 0)
  return (
    <Card>
      <CardHeader>
        <div className="flex items-end justify-between">
          <CardTitle>本週活動</CardTitle>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">本週總量</div>
            <div className="text-sm font-semibold tabular-nums">
              {totalReps} 下 · {totalCal} kcal
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex h-44 gap-2 pt-2">
          {data.map((day) => {
            const date = new Date(day.date)
            const pct = (day.totalReps / max) * 100
            return (
              <div
                key={day.date}
                className="flex flex-1 flex-col items-center gap-2"
              >
                <div className="relative flex w-full flex-1 items-end">
                  <div
                    className="w-full rounded-xl bg-linear-to-t from-primary/70 to-primary transition-[height] duration-500"
                    style={{ height: `${Math.max(pct, 4)}%` }}
                  />
                </div>
                <div className="text-[10px] font-medium tabular-nums text-muted-foreground">
                  {WEEK_LABEL[date.getDay()]}
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
