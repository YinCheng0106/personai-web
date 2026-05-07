import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ProgressBar } from "@/components/ui/progress-bar"
import type { BodyComposition as Item } from "@/types/inbody"

type Props = {
  items: Item[]
}

const TONE_MAP: Record<Item["tone"], "primary" | "success" | "warning" | "danger" | "info"> = {
  neutral: "primary",
  good: "success",
  warning: "warning",
  danger: "danger",
}

export function BodyComposition({ items }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>身體組成</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.map((item) => {
          const pct = Math.min(100, (item.current / item.target) * 100)
          return (
            <div key={item.label} className="space-y-1.5">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-medium">{item.label}</span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {item.current} / {item.target} {item.unit}
                </span>
              </div>
              <ProgressBar value={pct} tone={TONE_MAP[item.tone]} />
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
