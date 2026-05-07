import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { HugeiconsIcon } from "@hugeicons/react"
import { FireIcon, TimerIcon, Activity04Icon } from "@hugeicons/core-free-icons"
import { formatCalories, formatDuration } from "@/lib/format"

type Props = {
  reps: number
  calories: number
  durationSec: number
  confidence: number
}

export function CalorieDisplay({ reps, calories, durationSec, confidence }: Props) {
  const items = [
    {
      label: "燃燒",
      value: formatCalories(calories),
      icon: FireIcon,
      tone: "text-orange-500",
    },
    {
      label: "計時",
      value: formatDuration(durationSec),
      icon: TimerIcon,
      tone: "text-primary",
    },
    {
      label: "信心度",
      value: `${(confidence * 100).toFixed(0)}%`,
      icon: Activity04Icon,
      tone: "text-success",
    },
  ]
  return (
    <Card>
      <CardHeader>
        <CardTitle>本次訓練</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-xs text-muted-foreground">完成下數</div>
            <div className="text-3xl font-semibold tabular-nums">{reps}</div>
          </div>
          <div className="text-xs text-muted-foreground tabular-nums">下</div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {items.map((item) => (
            <div key={item.label} className="rounded-xl bg-muted/60 p-3">
              <div className="mb-2 flex items-center gap-1.5">
                <HugeiconsIcon
                  icon={item.icon}
                  size={14}
                  strokeWidth={2}
                  className={item.tone}
                />
                <span className="text-[11px] text-muted-foreground">{item.label}</span>
              </div>
              <div className="text-sm font-semibold tabular-nums">{item.value}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
