import { http, HttpResponse } from "msw"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { server } from "./test-server"
import { workoutWire } from "./helpers/fixtures"

vi.mock("@/lib/auth-client", () => ({ getAccessToken: vi.fn() }))
import { getAccessToken } from "@/lib/auth-client"
import { api, ApiError } from "@/lib/api"

beforeEach(() => {
  vi.mocked(getAccessToken).mockReset().mockResolvedValue("jwt")
})

describe("REST authorization, persistence, and failure boundaries", () => {
  it("does not send a request when JWT acquisition fails", async () => {
    const requested = vi.fn()
    server.use(http.get("http://localhost:8000/wk/me", requested))
    vi.mocked(getAccessToken).mockRejectedValue(new Error("Session expired"))
    await expect(api.getWorkouts()).rejects.toThrow("Session expired")
    expect(requested).not.toHaveBeenCalled()
  })

  it.each([
    [401, "登入已失效，請重新登入。"],
    [403, "你沒有權限執行這項操作。"],
    [404, "找不到要求的資料。"],
    [409, "資料狀態已變更，請重新整理後再試。"],
    [422, "輸入資料格式不正確，請檢查後再試。"],
    [429, "操作過於頻繁，請稍後再試。"],
    [503, "服務暫時無法使用，請稍後再試。"],
    [400, "請求失敗，請稍後再試。"],
  ])(
    "maps HTTP %s even with a non-JSON error response",
    async (status, message) => {
      server.use(
        http.get(
          "http://localhost:8000/wk/me",
          () => new HttpResponse("upstream HTML", { status })
        )
      )
      await expect(api.getWorkouts()).rejects.toEqual(
        new ApiError(status, message)
      )
    }
  )

  it("preserves a safe not-found detail", async () => {
    server.use(
      http.get(
        "http://localhost:8000/body-profile/me/measurements/missing",
        () =>
          HttpResponse.json(
            { detail: "Measurement not found" },
            { status: 404 }
          )
      )
    )
    await expect(api.getBodyMeasurement("missing")).rejects.toEqual(
      new ApiError(404, "Measurement not found")
    )
  })

  it.each([null, 0, 3.5])(
    "saves calories %s without inventing weight or identity",
    async (calories) => {
      let body: unknown
      server.use(
        http.post("http://localhost:8000/wk/me/record", async ({ request }) => {
          expect(request.headers.get("Authorization")).toBe("Bearer jwt")
          body = await request.json()
          return HttpResponse.json(
            { ...workoutWire, calories_burned: calories },
            { status: 201 }
          )
        })
      )
      await expect(
        api.postWorkoutRecord({
          exercise: "squat",
          reps: 3,
          durationSec: 60,
          calories,
          errorsCount: 0,
        })
      ).resolves.toMatchObject({ calories, reps: 3 })
      expect(body).toEqual({
        exercise_type: "squat",
        reps: 3,
        sets: 1,
        duration_sec: 60,
        calories_burned: calories,
        avg_intensity: "moderate",
        errors_count: 0,
      })
    }
  )

  it.each([
    "invalid JSON",
    JSON.stringify({ unexpected: "not a workout list" }),
    "null",
  ])("rejects an invalid workout response: %s", async (body) => {
    server.use(
      http.get(
        "http://localhost:8000/wk/me",
        () =>
          new HttpResponse(body, {
            headers: { "Content-Type": "application/json" },
          })
      )
    )
    await expect(api.getWorkouts()).rejects.toBeInstanceOf(Error)
  })

  it("propagates a network failure so callers can show failure instead of empty success", async () => {
    server.use(
      http.get("http://localhost:8000/wk/me", () => HttpResponse.error())
    )
    await expect(api.getWorkouts()).rejects.toThrow()
  })
})
