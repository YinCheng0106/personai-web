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
              total_calories: 0,
              total_duration_min: 0.1,
              avg_reps_per_set: 0,
              error_rate: 0,
              session_count: 1,
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
              total_calories: 0,
              total_duration_min: 0.1,
              workout_count: 1,
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
  await page.route("http://localhost:8000/inbody/me", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ status: 404, json: { detail: "not found" } })
      return
    }
    await route.fulfill({
      status: 201,
      json: {
        height_cm: 170,
        weight_kg: 65,
        bmi: 22.49,
        bmi_category: "正常",
        body_fat_pct: 20,
        skeletal_muscle_mass_kg: 30,
        age: 22,
        gender: "male",
        body_fat_mass_kg: 13,
        total_body_water_kg: null,
        visceral_fat_level: null,
        lean_body_mass_kg: 52,
        bmr_kcal_day: 1493.2,
        measured_at: new Date().toISOString(),
      },
    })
  })

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

  const [inbodyResponse] = await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url() === "http://localhost:8000/inbody/me" &&
        response.request().method() === "POST"
    ),
    page.getByRole("button", { name: "儲存身體資料" }).click(),
  ])
  expect(inbodyResponse.ok()).toBe(true)
  await expect(page.getByText("基礎代謝")).toBeVisible()

  await page.goto("/analyze")
  await page.getByRole("button", { name: "開始訓練" }).click()
  await page.waitForTimeout(1500)
  await page.getByRole("button", { name: "停止並儲存" }).click()
  await expect(page.getByText("本次訓練已儲存。")).toBeVisible()

  await page.goto("/history")
  await expect(page.getByText("累積場次")).toBeVisible()
  await expect(page.getByText("深蹲").first()).toBeVisible()
})
