import type { ExerciseType } from "@/types/pose"

export const EXERCISES: {
  value: ExerciseType
  label: string
  description: string
}[] = [
  { value: "squat", label: "深蹲", description: "雙腳與肩同寬，腰背挺直" },
  { value: "pushup", label: "伏地挺身", description: "核心收緊，手肘成 90°" },
]

export const ANGLE_THRESHOLDS = {
  squat: { down: 100, up: 160 },
  pushup: { down: 90, up: 160 },
} as const

export const FORM_ERROR_LABEL: Record<string, string> = {
  SQUAT_DEPTH_INSUFFICIENT: "深蹲深度不足，請蹲得再低一些",
  SQUAT_KNEE_VALGUS: "膝蓋內扣，請將膝蓋對齊腳尖方向",
  SQUAT_TORSO_LEAN: "軀幹過度前傾，請保持挺胸",
  PUSHUP_DEPTH_INSUFFICIENT: "伏地挺身深度不足，請再往下壓低一些",
  PUSHUP_HIP_SAG: "身體下沉，請收緊核心並保持身體成一直線",
  PUSHUP_HIP_PIKE: "臀部過高，請放低臀部並保持身體成一直線",
  "knee valgus detected": "膝蓋內夾",
  "insufficient depth": "深度不足",
  "back rounding": "腰背圓背",
  "hip drop": "髖部下沉",
  "elbow flare": "手肘外開",
}

export const TRACKING_HINT_LABEL: Record<string, string> = {
  POSE_NOT_FOUND: "目前無法偵測到人物，請保持全身在畫面內",
  SQUAT_KNEES_NOT_VISIBLE: "無法清楚偵測膝蓋或腳踝，請讓必要關節入鏡",
  PUSHUP_ARMS_NOT_VISIBLE: "無法清楚偵測手肘或手腕，請讓必要關節入鏡",
  MOVE_LEFT: "請稍微向左移動",
  MOVE_RIGHT: "請稍微向右移動",
  MOVE_FARTHER: "請稍微遠離鏡頭",
  REACQUIRING_POSE: "正在重新取得姿勢，請保持位置",
}
