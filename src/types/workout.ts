import type { ExerciseType } from "./pose"

export type WorkoutRecord = {
  id: string
  exercise: ExerciseType
  reps: number
  durationSec: number
  calories: number | null
  formScore: number
  performedAt: string
}

export type WorkoutRecordInput = {
  exercise: ExerciseType
  reps: number
  sets?: number
  durationSec: number
  calories: number | null
  averageIntensity?: "light" | "moderate" | "vigorous"
  errorsCount: number
}

export type DailySummary = {
  date: string
  totalReps: number
  totalCalories: number | null
  durationMin: number
  workoutCount: number
  calorieWorkoutCount: number
}

export type ExerciseSummary = {
  exercise: ExerciseType
  totalReps: number
  totalCalories: number | null
  sessions: number
  calorieSessions: number
  avgFormScore: number
}
