import { HugeiconsIcon } from "@hugeicons/react"
import { WorkoutSquatsIcon, WorkoutWarmUpIcon } from "@hugeicons/core-free-icons"
import { EXERCISES } from "@/lib/constants"
import type { ExerciseType } from "@/types/pose"
import { cn } from "@/lib/utils"

const ICON: Record<ExerciseType, typeof WorkoutSquatsIcon> = {
  squat: WorkoutSquatsIcon,
  pushup: WorkoutWarmUpIcon,
}

type Props = {
  value: ExerciseType
  onChange: (v: ExerciseType) => void
  disabled?: boolean
}

export function ExerciseSelector({ value, onChange, disabled }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {EXERCISES.map((ex) => {
        const active = ex.value === value
        return (
          <button
            key={ex.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(ex.value)}
            className={cn(
              "group relative flex flex-col items-start gap-2 rounded-2xl border p-4 text-left transition-all",
              "disabled:cursor-not-allowed disabled:opacity-60",
              active
                ? "border-primary/40 bg-primary/5 ring-1 ring-primary/30"
                : "border-border/70 bg-card hover:border-primary/30 hover:bg-muted/40",
            )}
          >
            <span
              className={cn(
                "grid h-8 w-8 place-items-center rounded-xl",
                active
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground",
              )}
            >
              <HugeiconsIcon icon={ICON[ex.value]} size={18} strokeWidth={2} />
            </span>
            <span className="text-sm font-semibold tracking-tight">{ex.label}</span>
            <span className="text-xs leading-snug text-muted-foreground">{ex.description}</span>
          </button>
        )
      })}
    </div>
  )
}
