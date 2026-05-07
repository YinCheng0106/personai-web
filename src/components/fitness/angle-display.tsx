import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ProgressBar } from "@/components/ui/progress-bar"
import { formatAngle } from "@/lib/format"
import type { AngleSet } from "@/types/pose"

type Props = {
  angles: AngleSet
  highlight: Array<keyof AngleSet>
}

const LABELS: Record<keyof AngleSet, string> = {
  leftKnee: "左膝",
  rightKnee: "右膝",
  leftHip: "左髖",
  rightHip: "右髖",
  leftElbow: "左肘",
  rightElbow: "右肘",
}

export function AngleDisplay({ angles, highlight }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>關節角度</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {highlight.map((key) => {
          const value = angles[key]
          const pct = Math.max(0, Math.min(100, ((value - 60) / (180 - 60)) * 100))
          return (
            <div key={key} className="grid grid-cols-[3.5rem_1fr_3rem] items-center gap-3">
              <span className="text-xs text-muted-foreground">{LABELS[key]}</span>
              <ProgressBar value={pct} tone="primary" />
              <span className="text-right text-sm font-semibold tabular-nums">
                {formatAngle(value)}
              </span>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
