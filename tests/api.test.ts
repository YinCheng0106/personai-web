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
