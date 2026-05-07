import { RepCounter } from "./rep-counter"
import { FsmStateIndicator } from "./fsm-state-indicator"
import type { PoseData } from "@/types/pose"
import { formatCalories } from "@/lib/format"

type Props = {
  pose: PoseData
  exerciseLabel: string
}

export function HUDOverlay({ pose, exerciseLabel }: Props) {
  return (
    <>
      <div className="pointer-events-none absolute inset-x-4 top-4 flex items-start justify-between gap-3 md:inset-x-6 md:top-6">
        <div className="flex flex-col gap-2">
          <span className="rounded-full bg-black/55 px-3 py-1 text-[11px] font-semibold tracking-wider text-white uppercase backdrop-blur-md">
            {exerciseLabel}
          </span>
          <FsmStateIndicator state={pose.state} />
        </div>
        <div className="rounded-2xl bg-black/55 px-3 py-2 text-right text-white backdrop-blur-md">
          <div className="text-[10px] tracking-[0.2em] text-white/60 uppercase">Calories</div>
          <div className="text-lg font-semibold tabular-nums">
            {formatCalories(pose.calories)}
          </div>
        </div>
      </div>
      <div className="pointer-events-none absolute inset-x-4 bottom-4 flex items-end justify-between gap-3 md:inset-x-6 md:bottom-6">
        <RepCounter reps={pose.reps} />
        <div className="rounded-2xl bg-black/55 px-3 py-2 text-white backdrop-blur-md">
          <div className="text-[10px] tracking-[0.2em] text-white/60 uppercase">Confidence</div>
          <div className="text-lg font-semibold tabular-nums">
            {(pose.confidence * 100).toFixed(0)}%
          </div>
        </div>
      </div>
    </>
  )
}
