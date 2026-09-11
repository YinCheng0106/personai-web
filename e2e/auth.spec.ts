import { expect, test } from "@playwright/test"

test("register, access protected content, and sign out", async ({ page }) => {
  const email = `e2e-${Date.now()}@personai.test`
  let workouts: unknown[] = []

  await page.route("http://localhost:8000/wk/me", (route) =>
    route.fulfill({ json: workouts })
  )
  await page.route("http://localhost:8000/wk/me/summary", (route) =>
    route.fulfill({
      json: workouts.length
        ? [
            {
              exercise_type: "squat",
              total_reps: 0,
              total_sets: 1,
              total_calories: null,
              total_duration_min: 0.1,
              avg_reps_per_set: 0,
              error_rate: 0,
              session_count: 1,
              calorie_session_count: 0,
              avg_form_score: 100,
            },
          ]
        : [],
    })
  )
  await page.route("http://localhost:8000/wk/me/daily", (route) =>
    route.fulfill({
      json: workouts.length
        ? [
            {
              date: new Date().toISOString().slice(0, 10),
              total_calories: null,
              total_duration_min: 0.1,
              workout_count: 1,
              calorie_workout_count: 0,
              total_reps: 0,
            },
          ]
        : [],
    })
  )
  await page.route("http://localhost:8000/wk/me/record", async (route) => {
    const body = route.request().postDataJSON()
    const record = {
      id: "e2e-record",
      user_id: "private-user",
      ...body,
      form_score: 100,
      timestamp: new Date().toISOString(),
    }
    workouts = [record]
    await route.fulfill({ status: 201, json: record })
  })
  let bodyProfile = {
    state: "unknown",
    height_cm: null as number | null,
    weight_kg: null as number | null,
    bmi: null,
    updated_at: null as string | null,
  }
  await page.route("http://localhost:8000/body-profile/me", async (route) => {
    if (route.request().method() === "PATCH") {
      const body = route.request().postDataJSON() as {
        height_cm: number | null
        weight_kg: number | null
      }
      bodyProfile = {
        state:
          body.height_cm === null && body.weight_kg === null
            ? "unknown"
            : "basic",
        ...body,
        bmi: null,
        updated_at: new Date().toISOString(),
      }
    }
    await route.fulfill({ json: bodyProfile })
  })
  await page.route(
    "http://localhost:8000/body-profile/me/measurements",
    (route) => route.fulfill({ json: [] })
  )

  await page.goto("/register?redirect=%2Fhistory")
  await page.getByLabel("顯示名稱").fill("測試使用者")
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("密碼", { exact: true }).fill("Personai123!")
  await page.getByLabel("再次輸入密碼").fill("Personai123!")
  await page.getByRole("button", { name: "建立帳號" }).click()

  await expect(page).toHaveURL(/\/history$/)
  await expect(page.getByText("登入後檢視訓練紀錄")).not.toBeVisible()

  await page.getByRole("button", { name: /測試使用者/ }).click()
  await page.getByText("登出", { exact: true }).click()
  await expect(page.getByRole("link", { name: "登入" }).first()).toBeVisible()

  await page.goto("/login?redirect=%2Finbody")
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("密碼", { exact: true }).fill("Personai123!")
  await page.getByRole("button", { name: "登入", exact: true }).click()
  await expect(page).toHaveURL(/\/inbody$/)

  await expect(page.getByText("尚未提供身體資料")).toBeVisible()
  await page.getByRole("button", { name: "新增基本資料" }).click()
  await page.getByLabel("身高（cm）").fill("175")
  const [bodyProfileResponse] = await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url() === "http://localhost:8000/body-profile/me" &&
        response.request().method() === "PATCH"
    ),
    page.getByRole("button", { name: "儲存基本資料" }).click(),
  ])
  expect(bodyProfileResponse.ok()).toBe(true)
  await expect(
    page.getByRole("heading", { name: "基本資料", exact: true })
  ).toBeVisible()
  await expect(page.getByText("未提供")).toBeVisible()

  await page.goto("/analyze")
  await page.getByRole("button", { name: "開始訓練" }).click()
  await page.waitForTimeout(1500)
  await page.getByRole("button", { name: "停止並儲存" }).click()
  await expect(page.getByText("本次訓練已儲存。")).toBeVisible()

  await page.goto("/history")
  await expect(page.getByText("累積場次")).toBeVisible()
  await expect(page.getByText("深蹲").first()).toBeVisible()
})
