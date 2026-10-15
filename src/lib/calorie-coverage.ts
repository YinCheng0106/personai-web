import type {
  DailySummary,
  ExerciseSummary,
  WorkoutRecord,
} from "@/types/workout"

export type CalorieCoverage = {
  calories: number | null
  covered: number
  total: number
}

function sumIfComplete(values: Array<number | null>) {
  let total = 0
  for (const value of values) {
    if (value === null) return null
    total += value
  }
  return total
}

export function workoutCalorieCoverage(
  records: WorkoutRecord[]
): CalorieCoverage {
  const available = records.filter((item) => item.calories !== null)
  return {
    calories:
      available.length === records.length
        ? sumIfComplete(records.map((item) => item.calories))
        : null,
    covered: available.length,
    total: records.length,
  }
}

export function dailyCalorieCoverage(rows: DailySummary[]): CalorieCoverage {
  const covered = rows.reduce((sum, item) => sum + item.calorieWorkoutCount, 0)
  const total = rows.reduce((sum, item) => sum + item.workoutCount, 0)
  return {
    calories:
      covered === total
        ? sumIfComplete(rows.map((item) => item.totalCalories))
        : null,
    covered,
    total,
  }
}

export function summaryCalorieCoverage(
  rows: ExerciseSummary[]
): CalorieCoverage {
  const covered = rows.reduce((sum, item) => sum + item.calorieSessions, 0)
  const total = rows.reduce((sum, item) => sum + item.sessions, 0)
  return {
    calories:
      covered === total
        ? sumIfComplete(rows.map((item) => item.totalCalories))
        : null,
    covered,
    total,
  }
}
