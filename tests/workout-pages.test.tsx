import { act, render, screen, waitFor, within } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { server } from "./test-server"
import { deferred, workoutWire } from "./helpers/fixtures"

const auth = vi.hoisted(() => ({
  session: {
    data: { user: { id: "user" } } as { user: { id: string } } | null,
    isPending: false,
  },
}))
vi.mock("@/lib/auth-client", () => ({
  useSession: () => auth.session,
  getAccessToken: vi.fn().mockResolvedValue("signed-jwt"),
}))
vi.mock("next/navigation", () => ({ usePathname: () => "/history" }))
import DashboardPage from "@/app/page"
import HistoryPage from "@/app/history/page"

function routes(calories: number | null = null) {
  server.use(
    http.get("http://localhost:8000/wk/me", ({ request }) => {
      expect(request.headers.get("authorization")).toBe("Bearer signed-jwt")
      return HttpResponse.json([
        { ...workoutWire, calories_burned: calories },
        {
          ...workoutWire,
          id: "older",
          exercise_type: "pushup",
          calories_burned: 0,
          form_score: 70,
          timestamp: "2026-10-14T06:00:00Z",
        },
      ])
    }),
    http.get("http://localhost:8000/wk/me/daily", () =>
      HttpResponse.json(
        [0, 5, 20, 40, 70].map((total_reps, index) => ({
          date: `2026-10-${11 + index}`,
          total_reps,
          total_calories: calories,
          total_duration_min: 1,
          workout_count: 1,
          calorie_workout_count: calories === null ? 0 : 1,
        }))
      )
    ),
    http.get("http://localhost:8000/wk/me/summary", () =>
      HttpResponse.json([
        {
          exercise_type: "squat",
          total_reps: 3,
          total_calories: calories,
          session_count: 1,
          calorie_session_count: calories === null ? 0 : 1,
          avg_form_score: 100,
        },
      ])
    )
  )
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date("2026-10-15T12:00:00Z"))
  auth.session = { data: { user: { id: "user" } }, isPending: false }
  routes()
})
afterEach(() => vi.useRealTimers())

describe.each([
  ["dashboard", DashboardPage, "載入訓練資料中…", "今日熱量估算"],
  ["history", HistoryPage, "載入訓練紀錄中…", "累積熱量估算"],
] as const)(
  "%s with the real REST client and MSW",
  (_, Page, loadingText, calorieLabel) => {
    it("hides private content and does not fetch workouts without a session", () => {
      const requested = vi.fn(() => HttpResponse.json([]))
      server.use(http.get("http://localhost:8000/wk/me", requested))
      auth.session = { data: null, isPending: false }
      render(<Page />)
      expect(screen.getByRole("link", { name: "登入" })).toBeVisible()
      expect(screen.queryByText(calorieLabel)).not.toBeInTheDocument()
      expect(requested).not.toHaveBeenCalled()
    })

    it("shows loading, then preserves unavailable calories alongside recorded reps", async () => {
      const response = deferred<Response>()
      server.use(
        http.get("http://localhost:8000/wk/me", () => response.promise)
      )
      render(<Page />)
      expect(await screen.findByText(loadingText)).toBeVisible()
      await act(async () => response.resolve(HttpResponse.json([workoutWire])))
      expect(
        (await screen.findAllByText("部分訓練缺少體重資料"))[0]
      ).toBeVisible()
      expect(screen.queryByText(loadingText)).not.toBeInTheDocument()
      const card = screen.getByText(calorieLabel).parentElement!.parentElement!
      expect(within(card).getByText("—")).toBeVisible()
      expect(screen.getAllByText("深蹲").length).toBeGreaterThan(0)
      expect(screen.getAllByText(/未估算/).length).toBeGreaterThan(0)
    })

    it("renders numeric zero as a known calorie estimate", async () => {
      routes(0)
      render(<Page />)
      await waitFor(() =>
        expect(screen.getAllByText("深蹲").length).toBeGreaterThan(0)
      )
      const card = screen.getByText(calorieLabel).parentElement!.parentElement!
      expect(within(card).getByText("0")).toBeVisible()
      expect(within(card).getByText("kcal")).toBeVisible()
      expect(screen.queryByText("部分訓練缺少體重資料")).not.toBeInTheDocument()
      if (Page === DashboardPage)
        expect(screen.queryByText("伏地挺身")).not.toBeInTheDocument()
      else expect(screen.getByText("伏地挺身")).toBeVisible()
    })

    it("surfaces an API failure instead of treating it as a successful empty response", async () => {
      server.use(
        http.get("http://localhost:8000/wk/me", () =>
          HttpResponse.json({}, { status: 401 })
        )
      )
      render(<Page />)
      expect(await screen.findByText("登入已失效，請重新登入。")).toBeVisible()
      expect(screen.queryByText(loadingText)).not.toBeInTheDocument()
    })

    it("renders an empty response without claiming calories are unavailable", async () => {
      server.use(
        ...["/wk/me", "/wk/me/daily", "/wk/me/summary"].map((path) =>
          http.get(`http://localhost:8000${path}`, () => HttpResponse.json([]))
        )
      )
      render(<Page />)
      await waitFor(() =>
        expect(screen.queryByText(loadingText)).not.toBeInTheDocument()
      )
      expect(screen.queryByText("部分訓練缺少體重資料")).not.toBeInTheDocument()
      expect(screen.queryByText("深蹲")).not.toBeInTheDocument()
    })
  }
)
