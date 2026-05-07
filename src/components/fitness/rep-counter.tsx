import { cn } from "@/lib/utils"

type Props = {
  reps: number
  goal?: number
  className?: string
}

export function RepCounter({ reps, goal, className }: Props) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-1 rounded-2xl bg-black/50 px-5 py-4 text-white backdrop-blur-md",
        className,
      )}
    >
      <span className="text-[11px] font-medium tracking-[0.2em] text-white/60 uppercase">
        Reps
      </span>
      <span className="text-5xl font-semibold tabular-nums tracking-tight">{reps}</span>
      {goal ? (
        <span className="text-[11px] text-white/70 tabular-nums">目標 {goal} 下</span>
      ) : null}
    </div>
  )
}
