import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { bmiCategory } from "@/lib/format"

type Props = {
  bmi: number
}

const SEGMENTS = [
  { label: "過輕", range: [0, 18.5], tone: "bg-info/40" },
  { label: "正常", range: [18.5, 24], tone: "bg-success/60" },
  { label: "過重", range: [24, 27], tone: "bg-warning/70" },
  { label: "肥胖", range: [27, 35], tone: "bg-destructive/60" },
] as const

const LABEL: Record<ReturnType<typeof bmiCategory>, string> = {
  underweight: "體重過輕",
  normal: "標準範圍",
  overweight: "略為過重",
  obese: "肥胖",
}

const TONE: Record<ReturnType<typeof bmiCategory>, "info" | "success" | "warning" | "danger"> = {
  underweight: "info",
  normal: "success",
  overweight: "warning",
  obese: "danger",
}

export function BmiChart({ bmi }: Props) {
  const cat = bmiCategory(bmi)
  const min = 14
  const max = 35
  const pos = ((Math.min(max, Math.max(min, bmi)) - min) / (max - min)) * 100
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>BMI 指數</CardTitle>
          <Badge tone={TONE[cat]}>{LABEL[cat]}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-semibold tabular-nums tracking-tight">
            {bmi.toFixed(1)}
          </span>
          <span className="text-sm text-muted-foreground">kg/m²</span>
        </div>
        <div className="relative mt-5">
          <div className="flex h-3 w-full overflow-hidden rounded-full">
            {SEGMENTS.map((s) => (
              <div
                key={s.label}
                className={cn("h-full", s.tone)}
                style={{
                  width: `${((s.range[1] - s.range[0]) / (max - min)) * 100}%`,
                }}
              />
            ))}
          </div>
          <div
            className="absolute -top-1 h-5 w-1 rounded-full bg-foreground shadow"
            style={{ left: `calc(${pos}% - 2px)` }}
          />
          <div className="mt-2 flex justify-between text-[10px] tabular-nums text-muted-foreground">
            {SEGMENTS.map((s) => (
              <span key={s.label}>{s.label}</span>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
