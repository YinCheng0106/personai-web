import type { ExerciseType } from "./pose"

export type WorkoutRecord = {
  id: string
  exercise: ExerciseType
  reps: number
  durationSec: number
  calories: number
  formScore: number
  performedAt: string
}

export type DailySummary = {
  date: string
  totalReps: number
  totalCalories: number
  durationMin: number
}

export type ExerciseSummary = {
  exercise: ExerciseType
  totalReps: number
  totalCalories: number
  sessions: number
  avgFormScore: number
}

export type GoalProgress = {
  label: string
  current: number
  target: number
  unit: string
}
