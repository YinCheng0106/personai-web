import { expect, test, type WebSocketRoute } from "@playwright/test"

for (const width of [1280, 390]) {
  test.describe(`PK timer at ${width}px (mock transport)`, () => {
    test.use({ viewport: { width, height: 844 } })
    test("prepares, plays, ends with server scores, and leaves", async ({
      page,
    }, testInfo) => {
      await page.route("**/api/auth/get-session**", (route) =>
        route.fulfill({
          json: {
            session: {
              id: "pk-session",
              token: "fixture",
              userId: "pk-user",
              expiresAt: "2099-01-01T00:00:00Z",
            },
            user: {
              id: "pk-user",
              name: "PK Fixture",
              email: "pk@personai.test",
              emailVerified: false,
            },
          },
        })
      )
      await page.route("**/api/auth/token", (route) =>
        route.fulfill({ json: { token: "synthetic-pk-token" } })
      )
      await page.route("https://cdn.jsdelivr.net/**", (route) => route.abort())
      await page.route("https://storage.googleapis.com/**", (route) =>
        route.abort()
      )
      await page.routeWebSocket("ws://localhost:8000/ws/analyze/**", () => {})
      let transport!: WebSocketRoute
      await page.routeWebSocket("ws://localhost:8000/ws/pk**", (socket) => {
        transport = socket
      })
      await page.goto("/pk")
      await page.getByLabel("4 位數房號").fill("1234")
      await page.getByRole("button", { name: "加入", exact: true }).click()
      await expect(page.getByText("已連線 · 房號 1234")).toBeVisible()
      transport.send(
        JSON.stringify({
          type: "ROOM_STATE",
          player_count: 2,
          ready: false,
          opponent_ready: true,
          opponent_score: 0,
          exercise_type: "squat",
          phase: "waiting",
        })
      )
      const ready = page.getByRole("button", { name: "準備完成" })
      await expect(ready).toBeEnabled()
      await ready.click()
      await page.clock.install({ time: new Date("2026-10-15T00:00:00Z") })
      await page.clock.pauseAt(new Date("2026-10-15T00:00:01Z"))
      const timing = {
        server_time_ms: 1_000_000,
        starts_at_ms: 1_010_000,
        ends_at_ms: 1_070_000,
      }
      transport.send(
        JSON.stringify({
          type: "GAME_START",
          countdown_seconds: 10,
          duration_seconds: 60,
          ...timing,
        })
      )
      await expect(page.getByText("準備開始！")).toBeVisible()
      await page.screenshot({
        path: testInfo.outputPath("countdown.png"),
        fullPage: true,
      })
      await page.clock.fastForward(10_000)
      await expect(
        page.getByRole("main").getByText("0", { exact: true })
      ).toBeVisible()
      await expect(page.getByText("你的分數")).toHaveCount(0)
      transport.send(
        JSON.stringify({
          type: "GAME_BEGIN",
          duration_seconds: 60,
          ...timing,
          server_time_ms: 1_010_000,
        })
      )
      await expect(page.getByText("01:00")).toBeVisible()
      await page.clock.fastForward(60_000)
      await expect(page.getByText("00:00")).toBeVisible()
      transport.send(
        JSON.stringify({
          type: "GAME_END",
          score: 4,
          opponent_score: 2,
          result: "win",
        })
      )
      await expect(page.getByText("你贏了！")).toBeVisible()
      await expect(
        page.getByRole("main").getByText("4", { exact: true })
      ).toBeVisible()
      await expect(
        page.getByRole("main").getByText("2", { exact: true })
      ).toBeVisible()
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth
        )
      ).toBe(true)
      await page.screenshot({
        path: testInfo.outputPath("result.png"),
        fullPage: true,
      })
      await page.getByRole("button", { name: "返回 PK 大廳" }).click()
      await expect(
        page.getByRole("button", { name: "建立對戰房間" })
      ).toBeVisible()
    })
  })
}
