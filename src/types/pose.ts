export type ExerciseType = "squat" | "pushup"

export type FsmState = "idle" | "up" | "descending" | "bottom" | "ascending"

export type AngleSet = {
  leftKnee: number
  rightKnee: number
  leftHip: number
  rightHip: number
  leftElbow: number
  rightElbow: number
}

export type PoseData = {
  reps: number
  state: FsmState
  angles: AngleSet
  errors: string[]
  confidence: number
  isVisible: boolean
  calories: number
}

export type ServerFrame = {
  rep_count: number
  state: string
  angles: Partial<{
    left_knee: number
    right_knee: number
    left_hip: number
    right_hip: number
    left_elbow: number
    right_elbow: number
  }>
  errors: string[]
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
