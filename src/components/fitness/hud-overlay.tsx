import { HugeiconsIcon } from "@hugeicons/react"
import { RepCounter } from "./rep-counter"
import { FsmStateIndicator } from "./fsm-state-indicator"
import { ExerciseType, EXERCISE_LABEL, EXERCISE_ICONS } from "@/types/pose"
import type { PoseData } from "@/types/pose"
import { formatCalories } from "@/lib/format"

type Props = {
  pose: PoseData
  exerciseLabel: ExerciseType
}

export function HUDOverlay({ pose, exerciseLabel }: Props) {
  return (
    <>
      <div className="pointer-events-none absolute inset-x-4 top-4 flex items-start justify-between gap-3 md:inset-x-6 md:top-6">
        <div className="flex gap-2">
          <span className="inline-flex items-center rounded-full bg-white/55 px-3 py-1 text-sm font-semibold tracking-wider text-white uppercase backdrop-blur-md">
            <HugeiconsIcon icon={EXERCISE_ICONS[exerciseLabel]} className="shrink-0" size={16} />
            <span className="ml-1">{EXERCISE_LABEL[exerciseLabel]}</span>
          </span>
        </div>
        <FsmStateIndicator state={pose.state} />
        <div className="rounded-xl bg-black/55 px-3 py-2 text-right text-white backdrop-blur-md">
          <div className="text-[10px] tracking-[0.2em] text-white/60 uppercase">Calories</div>
          <div className="text-lg font-semibold tabular-nums">
            {formatCalories(pose.calories)}
          </div>
        </div>
      </div>
      <div className="pointer-events-none absolute inset-x-4 bottom-4 flex items-end justify-between gap-3 md:inset-x-6 md:bottom-6">
        <RepCounter reps={pose.reps} />
        <div className="rounded-xl bg-black/55 px-3 py-2 text-white backdrop-blur-md">
          <div className="text-[10px] tracking-[0.2em] text-white/60 uppercase">Confidence</div>
          <div className="text-lg font-semibold tabular-nums">
            {(pose.confidence * 100).toFixed(0)}%
          </div>
        </div>
      </div>
    </>
  )
}
