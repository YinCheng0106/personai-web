import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { TodayWorkoutList } from "@/components/dashboard/today-workout-list"
import { WeeklyChart } from "@/components/dashboard/weekly-chart"

describe("nullable calorie UI", () => {
  it("explains incomplete dashboard calorie coverage", () => {
    render(
      <WeeklyChart
        data={[
          {
            date: "2026-09-11",
            totalReps: 10,
            totalCalories: null,
            durationMin: 2,
            workoutCount: 2,
            calorieWorkoutCount: 1,
          },
        ]}
      />
    )

    expect(screen.getByText("部分訓練缺少體重資料")).toBeInTheDocument()
    expect(screen.getByText(/10 下 · —/)).toBeInTheDocument()
  })

  it("distinguishes unavailable workout calories from zero", () => {
    render(
      <TodayWorkoutList
        records={[
          {
            id: "unknown",
            exercise: "squat",
            reps: 1,
            durationSec: 4,
            calories: null,
            formScore: 100,
            performedAt: "2026-09-11T00:00:00Z",
          },
          {
            id: "zero",
            exercise: "pushup",
            reps: 1,
            durationSec: 4,
            calories: 0,
            formScore: 100,
            performedAt: "2026-09-11T00:01:00Z",
          },
        ]}
      />
    )

    expect(screen.getByText(/未估算/)).toBeInTheDocument()
    expect(screen.getByText(/0\.0 kcal/)).toBeInTheDocument()
  })
})
