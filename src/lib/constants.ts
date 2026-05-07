import type { ExerciseType } from "@/types/pose"

export const EXERCISES: { value: ExerciseType; label: string; description: string }[] = [
  { value: "squat", label: "深蹲", description: "雙腳與肩同寬，腰背挺直" },
  { value: "pushup", label: "伏地挺身", description: "核心收緊，手肘成 90°" },
]

export const ANGLE_THRESHOLDS = {
  squat: { down: 100, up: 160 },
  pushup: { down: 90, up: 160 },
} as const

export const FORM_ERROR_LABEL: Record<string, string> = {
  "knee valgus detected": "膝蓋內夾",
  "insufficient depth": "深度不足",
  "back rounding": "腰背圓背",
  "hip drop": "髖部下沉",
  "elbow flare": "手肘外開",
}
