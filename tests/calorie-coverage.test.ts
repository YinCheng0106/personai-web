import { describe, expect, it } from "vitest"

import {
  dailyCalorieCoverage,
  summaryCalorieCoverage,
  workoutCalorieCoverage,
} from "@/lib/calorie-coverage"

describe("calorie coverage", () => {
  it("does not present partial daily calories as a complete total", () => {
    expect(
      dailyCalorieCoverage([
        {
          date: "2026-09-11",
          totalReps: 20,
          totalCalories: null,
          durationMin: 10,
          workoutCount: 2,
          calorieWorkoutCount: 1,
        },
      ])
    ).toEqual({ calories: null, covered: 1, total: 2 })
  })

  it("preserves a fully covered numeric zero", () => {
    expect(
      summaryCalorieCoverage([
        {
          exercise: "squat",
          totalReps: 0,
          totalCalories: 0,
          sessions: 1,
          calorieSessions: 1,
          avgFormScore: 100,
        },
      ])
    ).toEqual({ calories: 0, covered: 1, total: 1 })
  })

  it("marks a workout list incomplete when one calorie value is null", () => {
    expect(
      workoutCalorieCoverage([
        {
          id: "known",
          exercise: "squat",
          reps: 1,
          durationSec: 4,
          calories: 0,
          formScore: 100,
          performedAt: "2026-09-11T00:00:00Z",
        },
        {
          id: "unknown",
          exercise: "pushup",
          reps: 1,
          durationSec: 4,
          calories: null,
          formScore: 100,
          performedAt: "2026-09-11T00:01:00Z",
        },
      ])
    ).toEqual({ calories: null, covered: 1, total: 2 })
  })
})
