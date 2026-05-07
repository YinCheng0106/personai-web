import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type Cell = { date: string; intensity: number }

type Props = {
  cells: Cell[]
}

const TONE = [
  "bg-muted",
  "bg-primary/20",
  "bg-primary/40",
  "bg-primary/70",
  "bg-primary",
]

export function Heatmap({ cells }: Props) {
  const weeks = Math.ceil(cells.length / 7)
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>訓練熱力圖</CardTitle>
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            少
            {TONE.map((c, i) => (
              <span key={i} className={cn("h-3 w-3 rounded-xs", c)} />
            ))}
            多
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div
          className="grid grid-flow-col gap-1.5 max-w-full overflow-x-auto"
          style={{ gridTemplateRows: "repeat(7, minmax(0, 1fr))" }}
        >
          {cells.map((cell, i) => (
            <div
              key={cell.date + i}
              title={`${cell.date} · 強度 ${cell.intensity}`}
              className={cn(
                "h-12 w-12 rounded-sm transition-transform hover:scale-105",
                TONE[Math.min(cell.intensity, 4)],
              )}
            />
          ))}
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">
          過去 {weeks} 週的訓練分布。
        </p>
      </CardContent>
    </Card>
  )
}
