import type { DailySummary, ExerciseSummary, GoalProgress, WorkoutRecord } from "@/types/workout"
import type { BodyComposition, InBody } from "@/types/inbody"

export const MOCK_DAILY: DailySummary[] = Array.from({ length: 7 }).map((_, i) => {
  const d = new Date()
  d.setDate(d.getDate() - (6 - i))
  return {
    date: d.toISOString().slice(0, 10),
    totalReps: 20 + Math.round(Math.random() * 60),
    totalCalories: 80 + Math.round(Math.random() * 200),
    durationMin: 8 + Math.round(Math.random() * 22),
  }
})

export const MOCK_WORKOUTS: WorkoutRecord[] = [
  {
    id: "w-1",
    exercise: "squat",
    reps: 32,
    durationSec: 540,
    calories: 142,
    formScore: 92,
    performedAt: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
  },
  {
    id: "w-2",
    exercise: "pushup",
    reps: 24,
    durationSec: 410,
    calories: 96,
    formScore: 84,
    performedAt: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(),
  },
  {
    id: "w-3",
    exercise: "squat",
    reps: 40,
    durationSec: 620,
    calories: 168,
    formScore: 88,
    performedAt: new Date(Date.now() - 1000 * 60 * 60 * 50).toISOString(),
  },
  {
    id: "w-4",
    exercise: "pushup",
    reps: 18,
    durationSec: 320,
    calories: 72,
    formScore: 79,
    performedAt: new Date(Date.now() - 1000 * 60 * 60 * 76).toISOString(),
  },
]

export const MOCK_EXERCISE_SUMMARY: ExerciseSummary[] = [
  { exercise: "squat", totalReps: 312, totalCalories: 1240, sessions: 12, avgFormScore: 90 },
  { exercise: "pushup", totalReps: 188, totalCalories: 720, sessions: 9, avgFormScore: 82 },
]

export const MOCK_GOALS: GoalProgress[] = [
  { label: "本週深蹲次數", current: 124, target: 200, unit: "下" },
  { label: "本週訓練時間", current: 86, target: 150, unit: "分" },
  { label: "燃燒卡路里", current: 720, target: 1200, unit: "kcal" },
]

export const MOCK_INBODY: InBody = {
  heightCm: 174,
  weightKg: 68.4,
  bodyFatPct: 17.8,
  skeletalMuscleKg: 31.2,
  bmr: 1568,
  measuredAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
}

export const MOCK_BODY_COMPOSITION: BodyComposition[] = [
  { label: "體脂率", current: 17.8, target: 15, unit: "%", tone: "warning" },
  { label: "骨骼肌", current: 31.2, target: 33, unit: "kg", tone: "good" },
  { label: "BMR", current: 1568, target: 1600, unit: "kcal", tone: "neutral" },
]

export const MOCK_HEATMAP: { date: string; intensity: number }[] = Array.from({
  length: 84,
}).map((_, i) => {
  const d = new Date()
  d.setDate(d.getDate() - (83 - i))
  return {
    date: d.toISOString().slice(0, 10),
    intensity: Math.random() < 0.35 ? 0 : Math.ceil(Math.random() * 4),
  }
})
