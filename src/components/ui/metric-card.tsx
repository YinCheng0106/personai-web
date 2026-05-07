import * as React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type Props = {
  label: string
  value: React.ReactNode
  unit?: string
  delta?: { value: string; tone?: "up" | "down" | "neutral" }
  icon?: React.ReactNode
  className?: string
}

const DELTA_TONE = {
  up: "text-success",
  down: "text-destructive",
  neutral: "text-muted-foreground",
}

export function MetricCard({ label, value, unit, delta, icon, className }: Props) {
  return (
    <Card className={cn("h-full", className)}>
      <CardContent className="flex h-full flex-col gap-3 p-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
          {icon ? <span className="text-muted-foreground">{icon}</span> : null}
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-3xl font-semibold tracking-tight tabular-nums">{value}</span>
          {unit ? <span className="text-sm text-muted-foreground">{unit}</span> : null}
        </div>
        {delta ? (
          <span className={cn("text-xs font-medium", DELTA_TONE[delta.tone ?? "neutral"])}>
            {delta.value}
          </span>
        ) : null}
      </CardContent>
    </Card>
  )
}
