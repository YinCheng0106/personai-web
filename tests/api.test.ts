import { http, HttpResponse } from "msw"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { server } from "./test-server"

vi.mock("@/lib/auth-client", () => ({
  getAccessToken: vi.fn().mockResolvedValue("signed-jwt"),
}))

import { api } from "@/lib/api"

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
})
