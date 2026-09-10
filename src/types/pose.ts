import {
  WorkoutSquatsIcon,
  WorkoutWarmUpIcon,
} from "@hugeicons/core-free-icons"

export type ExerciseType = "squat" | "pushup"

export type FsmState = "idle" | "up" | "descending" | "bottom" | "ascending"

export type TrackingState = "ACQUIRING" | "ACTIVE" | "PAUSED" | "LOST"

export type AngleSet = {
  leftKnee: number | null
  rightKnee: number | null
  leftHip: number | null
  rightHip: number | null
  leftElbow: number | null
  rightElbow: number | null
}

export type PoseData = {
  frameId: number
  processingMs: number
  reps: number
  state: FsmState
  angles: AngleSet
  formErrors: string[]
  trackingHints: string[]
  trackingState: TrackingState
  confidence: number
  isVisible: boolean
  calories: number
}

export type ServerFrame = {
  frame_id: number
  processing_ms: number
  rep_count: number
  state: string
  angles: Partial<{
    left_knee: number | null
    right_knee: number | null
    left_hip: number | null
    right_hip: number | null
    left_elbow: number | null
    right_elbow: number | null
    left_body: number | null
    right_body: number | null
  }>
  errors?: string[]
  form_errors?: string[]
  tracking_hints?: string[]
  tracking_state?: TrackingState
  confidence: number
  is_visible: boolean
  calories: number
}

export const EXERCISE_LABEL: Record<ExerciseType, string> = {
  squat: "深蹲",
  pushup: "伏地挺身",
}

export const FSM_LABEL: Record<FsmState, string> = {
  idle: "待機",
  up: "起始",
  descending: "下降",
  bottom: "底部",
  ascending: "上升",
}

export const EXERCISE_ICONS: Record<ExerciseType, typeof WorkoutSquatsIcon> = {
  squat: WorkoutSquatsIcon,
  pushup: WorkoutWarmUpIcon,
}
