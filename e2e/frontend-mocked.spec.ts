import { expect, test } from "@playwright/test"

// Everything across the auth/API boundary is synthetic in this suite.
// Real Better Auth + local PostgreSQL is covered separately by auth.spec.ts.
for (const viewport of [
  { width: 1280, height: 800 },
  { width: 390, height: 844 },
]) {
  test.describe(`mocked frontend at ${viewport.width}px`, () => {
    test.use({ viewport })

    test("retries profile loading and uses browser form validation before saving nullable data", async ({
      page,
    }) => {
      const timestamp = "2026-10-15T00:00:00.000Z"
      await page.route("**/api/auth/get-session**", (route) =>
        route.fulfill({
          json: {
            session: {
              id: "mock-session",
              token: "mock-session-token",
              userId: "mock-user",
              expiresAt: "2099-01-01T00:00:00.000Z",
              createdAt: timestamp,
              updatedAt: timestamp,
            },
            user: {
              id: "mock-user",
              name: "Browser Fixture",
              email: "browser@personai.test",
              emailVerified: false,
              image: null,
              createdAt: timestamp,
              updatedAt: timestamp,
            },
          },
        })
      )
      await page.route("**/api/auth/token", (route) =>
        route.fulfill({ json: { token: "mock-jwt-not-a-real-credential" } })
      )
      let reads = 0
      let profile = {
        state: "unknown",
        height_cm: null as number | null,
        weight_kg: null as number | null,
        bmi: null,
        updated_at: null as string | null,
      }
      await page.route(
        "http://localhost:8000/body-profile/me/measurements",
        (route) => route.fulfill({ json: [] })
      )
      await page.route(
        "http://localhost:8000/body-profile/me",
        async (route) => {
          expect(route.request().headers().authorization).toBe(
            "Bearer mock-jwt-not-a-real-credential"
          )
          if (route.request().method() === "PATCH") {
            expect(route.request().postDataJSON()).toEqual({
              height_cm: null,
              weight_kg: 68,
            })
            profile = {
              ...profile,
              state: "basic",
              weight_kg: 68,
              updated_at: timestamp,
            }
          } else if (++reads === 1) {
            await route.fulfill({
              status: 503,
              json: { detail: "synthetic outage" },
            })
            return
          }
          await route.fulfill({ json: profile })
        }
      )
      await page.goto("/inbody")
      await expect(page.getByRole("main").getByRole("alert")).toHaveText(
        "服務暫時無法使用，請稍後再試。"
      )
      await page.getByRole("button", { name: "重新載入" }).click()
      await page.getByRole("button", { name: "新增基本資料" }).click()
      const weight = page.getByLabel("體重（kg）")
      await weight.fill("501")
      await page.getByRole("button", { name: "儲存基本資料" }).click()
      expect(
        await weight.evaluate(
          (element: HTMLInputElement) => element.validity.rangeOverflow
        )
      ).toBe(true)
      await expect(weight).toBeFocused()
      await weight.fill("68")
      await page.getByRole("button", { name: "儲存基本資料" }).click()
      await expect(
        page.getByRole("heading", { name: "基本資料", exact: true })
      ).toBeVisible()
      await expect(
        page.getByRole("definition").filter({ hasText: /^68\s*kg$/ })
      ).toBeVisible()
      await expect(page.getByText("未提供", { exact: true })).toBeVisible()
      // Both breakpoints keep navigation and the save result usable without page overflow.
      const history = page
        .locator("nav:visible")
        .getByRole("link", { name: "訓練紀錄" })
      await history.scrollIntoViewIfNeeded()
      await expect(history).toBeVisible()
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth
        )
      ).toBe(true)
    })
  })
}

test("an unauthenticated browser preserves the protected destination in its sign-in link", async ({
  page,
}) => {
  await page.route("**/api/auth/get-session**", (route) =>
    route.fulfill({ json: null })
  )
  await page.route("http://localhost:8000/**", () => {
    throw new Error("Private API requested without a session")
  })
  await page.goto("/history")
  await expect(
    page.getByRole("heading", { name: "登入後檢視訓練紀錄" })
  ).toBeVisible()
  await page
    .getByRole("main")
    .getByRole("link", { name: "登入", exact: true })
    .click()
  await expect(page).toHaveURL(/\/login\?redirect=%2Fhistory$/)
})
