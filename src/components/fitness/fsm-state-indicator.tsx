import { Badge } from "@/components/ui/badge"
import { FSM_LABEL, type FsmState } from "@/types/pose"

type Props = {
  state: FsmState
}

const TONE: Record<FsmState, "neutral" | "info" | "primary" | "warning" | "success"> = {
  idle: "neutral",
  up: "info",
  descending: "primary",
  bottom: "warning",
  ascending: "success",
}

export function FsmStateIndicator({ state }: Props) {
  return (
    <Badge tone={TONE[state]} className="gap-1.5 px-3 py-1 text-xs font-semibold">
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
      </span>
      {FSM_LABEL[state]}
    </Badge>
  )
}
