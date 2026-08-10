import type { ExerciseType } from "@/types/pose"

// 前後端正式帳號串接完成前，所有 Mock Session 共用此測試使用者。
export const INTEGRATION_TEST_USER_ID = "u001"

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
  "knee valgus detected": "膝蓋內夾",
  "insufficient depth": "深度不足",
  "back rounding": "腰背圓背",
  "hip drop": "髖部下沉",
  "elbow flare": "手肘外開",
}
