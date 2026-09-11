import { http, HttpResponse } from "msw"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { server } from "./test-server"

vi.mock("@/lib/auth-client", () => ({
  getAccessToken: vi.fn().mockResolvedValue("signed-jwt"),
}))

import { api, ApiError } from "@/lib/api"

describe("authenticated REST client", () => {
  beforeEach(() => {
    server.use(
      http.get("http://localhost:8000/wk/me", ({ request }) => {
        expect(request.headers.get("authorization")).toBe("Bearer signed-jwt")
        return HttpResponse.json([
          {
            id: "record-1",
            user_id: "private-user",
            exercise_type: "squat",
            reps: 5,
            sets: 1,
            duration_sec: 60,
            calories_burned: 10.5,
            avg_intensity: "moderate",
            errors_count: 1,
            form_score: 80,
            timestamp: "2026-08-11T00:00:00Z",
          },
        ])
      })
    )
  })

  it("uses /me and normalizes API wire fields", async () => {
    await expect(api.getWorkouts()).resolves.toEqual([
      {
        id: "record-1",
        exercise: "squat",
        reps: 5,
        durationSec: 60,
        calories: 10.5,
        formScore: 80,
        performedAt: "2026-08-11T00:00:00Z",
      },
    ])
  })

  it("preserves nullable workout calories and numeric zero", async () => {
    server.use(
      http.get("http://localhost:8000/wk/me", () =>
        HttpResponse.json([
          {
            id: "unknown",
            user_id: "private-user",
            exercise_type: "squat",
            reps: 5,
            sets: 1,
            duration_sec: 60,
            calories_burned: null,
            avg_intensity: "moderate",
            errors_count: 0,
            form_score: 100,
            timestamp: "2026-09-11T00:00:00Z",
          },
          {
            id: "zero",
            user_id: "private-user",
            exercise_type: "pushup",
            reps: 0,
            sets: 1,
            duration_sec: 10,
            calories_burned: 0,
            avg_intensity: "light",
            errors_count: 0,
            form_score: 100,
            timestamp: "2026-09-11T00:01:00Z",
          },
        ])
      )
    )

    const workouts = await api.getWorkouts()
    expect(workouts[0].calories).toBeNull()
    expect(workouts[1].calories).toBe(0)
  })

  it("uses the preferred body-profile API and preserves null fields", async () => {
    server.use(
      http.get("http://localhost:8000/body-profile/me", () =>
        HttpResponse.json({
          state: "basic",
          height_cm: 175,
          weight_kg: null,
          bmi: null,
          updated_at: "2026-09-11T00:00:00Z",
        })
      ),
      http.get("http://localhost:8000/body-profile/me/measurements", () =>
        HttpResponse.json([
          {
            id: "measurement-1",
            source: "inbody",
            source_label: null,
            measured_at: "2026-09-10T00:00:00Z",
            created_at: "2026-09-11T00:00:00Z",
            updated_at: "2026-09-11T00:00:00Z",
            height_cm: null,
            weight_kg: null,
            body_fat_pct: 18.5,
            skeletal_muscle_mass_kg: null,
            body_fat_mass_kg: null,
            total_body_water_kg: null,
            visceral_fat_level: null,
            bmi: null,
            lean_body_mass_kg: null,
            bmr_kcal_day: null,
            bmr_is_formula_estimate: false,
          },
        ])
      )
    )

    await expect(api.getBodyProfile()).resolves.toMatchObject({
      state: "basic",
      heightCm: 175,
      weightKg: null,
      bmi: null,
    })
    await expect(api.getBodyMeasurements()).resolves.toMatchObject([
      {
        id: "measurement-1",
        bodyFatPct: 18.5,
        weightKg: null,
        bmrKcalDay: null,
      },
    ])
  })

  it("sends explicit nulls when clearing Basic Profile fields", async () => {
    server.use(
      http.patch(
        "http://localhost:8000/body-profile/me",
        async ({ request }) => {
          await expect(request.json()).resolves.toEqual({
            height_cm: null,
            weight_kg: 68,
          })
          return HttpResponse.json({
            state: "basic",
            height_cm: null,
            weight_kg: 68,
            bmi: null,
            updated_at: "2026-09-11T00:00:00Z",
          })
        }
      )
    )

    await expect(
      api.updateBodyProfile({ heightCm: null, weightKg: 68 })
    ).resolves.toMatchObject({ heightCm: null, weightKg: 68 })
  })

  it("updates an owned measurement without inventing omitted values", async () => {
    server.use(
      http.patch(
        "http://localhost:8000/body-profile/me/measurements/measurement-1",
        async ({ request }) => {
          await expect(request.json()).resolves.toEqual({
            body_fat_pct: 17.5,
          })
          return HttpResponse.json({
            id: "measurement-1",
            source: "inbody",
            source_label: null,
            measured_at: "2026-09-10T00:00:00Z",
            created_at: "2026-09-10T00:00:00Z",
            updated_at: "2026-09-11T00:00:00Z",
            height_cm: null,
            weight_kg: null,
            body_fat_pct: 17.5,
            skeletal_muscle_mass_kg: null,
            body_fat_mass_kg: null,
            total_body_water_kg: null,
            visceral_fat_level: null,
            bmi: null,
            lean_body_mass_kg: null,
            bmr_kcal_day: null,
            bmr_is_formula_estimate: false,
          })
        }
      )
    )

    await expect(
      api.updateBodyMeasurement("measurement-1", { bodyFatPct: 17.5 })
    ).resolves.toMatchObject({ id: "measurement-1", bodyFatPct: 17.5 })
  })

  it("maps backend calorie coverage fields", async () => {
    server.use(
      http.get("http://localhost:8000/wk/me/summary", () =>
        HttpResponse.json([
          {
            exercise_type: "squat",
            total_reps: 20,
            total_calories: null,
            session_count: 2,
            calorie_session_count: 1,
            avg_form_score: 90,
          },
        ])
      ),
      http.get("http://localhost:8000/wk/me/daily", () =>
        HttpResponse.json([
          {
            date: "2026-09-11",
            total_reps: 20,
            total_calories: null,
            total_duration_min: 5,
            workout_count: 2,
            calorie_workout_count: 1,
          },
        ])
      )
    )

    await expect(api.getWorkoutSummary()).resolves.toMatchObject([
      { totalCalories: null, sessions: 2, calorieSessions: 1 },
    ])
    await expect(api.getDailySummary()).resolves.toMatchObject([
      { totalCalories: null, workoutCount: 2, calorieWorkoutCount: 1 },
    ])
  })

  it("preserves editable InBody fields from the authenticated profile", async () => {
    server.use(
      http.get("http://localhost:8000/inbody/me", () =>
        HttpResponse.json({
          height_cm: 170,
          weight_kg: 65,
          age: 31,
          gender: "female",
          bmi: 22.49,
          bmi_category: "正常",
          body_fat_pct: 20,
          skeletal_muscle_mass_kg: 30,
          body_fat_mass_kg: 13,
          total_body_water_kg: 35,
          visceral_fat_level: 7,
          lean_body_mass_kg: 52,
          bmr_kcal_day: 1493.2,
          measured_at: "2026-08-11T00:00:00Z",
        })
      )
    )

    await expect(api.getInBody()).resolves.toMatchObject({
      age: 31,
      gender: "female",
      bodyFatMassKg: 13,
      totalBodyWaterKg: 35,
      visceralFatLevel: 7,
    })
  })

  it("does not expose raw server failures to the UI", async () => {
    server.use(
      http.get("http://localhost:8000/wk/me", () =>
        HttpResponse.json(
          { detail: "database host internal-db.local failed" },
          { status: 500 }
        )
      )
    )

    await expect(api.getWorkouts()).rejects.toEqual(
      new ApiError(500, "服務暫時無法使用，請稍後再試。")
    )
  })
})
