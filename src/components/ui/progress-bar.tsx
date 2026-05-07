import * as React from "react"
import { cn } from "@/lib/utils"

type Props = {
  value: number
  max?: number
  tone?: "primary" | "success" | "warning" | "danger" | "info"
  className?: string
  showLabel?: boolean
}

const TONE: Record<NonNullable<Props["tone"]>, string> = {
  primary: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-destructive",
  info: "bg-info",
}

export function ProgressBar({
  value,
  max = 100,
  tone = "primary",
  className,
  showLabel = false,
}: Props) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  return (
    <div className={cn("flex w-full items-center gap-3", className)}>
      <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-[width] duration-500", TONE[tone])}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel ? (
        <span className="text-xs font-medium tabular-nums text-muted-foreground">
          {Math.round(pct)}%
        </span>
      ) : null}
    </div>
  )
}
