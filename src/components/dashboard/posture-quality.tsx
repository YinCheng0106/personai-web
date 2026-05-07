import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ProgressBar } from "@/components/ui/progress-bar"
import { Badge } from "@/components/ui/badge"

type Props = {
  score: number
}

export function PostureQuality({ score }: Props) {
  const tone = score >= 90 ? "success" : score >= 75 ? "primary" : "warning"
  const label = score >= 90 ? "優異" : score >= 75 ? "良好" : "待加強"
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>姿勢品質</CardTitle>
          <Badge tone={tone}>{label}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-semibold tabular-nums tracking-tight">{score}</span>
          <span className="text-sm text-muted-foreground">/ 100</span>
        </div>
        <ProgressBar value={score} tone={tone} />
        <p className="text-xs leading-relaxed text-muted-foreground">
          綜合本週訓練的姿態誤差、深度與節奏一致性計算而成。
        </p>
      </CardContent>
    </Card>
  )
}
