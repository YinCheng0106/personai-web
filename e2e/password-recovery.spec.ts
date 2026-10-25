import { expect, test } from "@playwright/test"

for (const viewport of [
  { width: 1280, height: 800 },
  { width: 390, height: 844 },
]) {
  test(`password recovery forms and privacy headers at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport)
    await page.emulateMedia({
      colorScheme: viewport.width === 390 ? "dark" : "light",
    })
    let requests = 0
    await page.route("**/api/auth/request-password-reset", async (route) => {
      requests++
      expect(route.request().postDataJSON().redirectTo).toBe(
        "http://localhost:3000/reset-password"
      )
      await route.fulfill({ json: { status: true } })
    })
    await page.route("**/api/auth/reset-password", async (route) => {
      expect(route.request().postDataJSON()).toEqual({
        token: "A".repeat(24),
        newPassword: "NewPassword123!",
      })
      await route.fulfill({ json: { status: true } })
    })
    await page.goto("/login")
    await page.getByRole("link", { name: "忘記密碼？" }).click()
    await page.getByLabel("電子郵件").fill("user@personai.test")
    await page.getByRole("button", { name: "寄送重設信件" }).click()
    await expect(page.getByRole("status")).toContainText("若此信箱已註冊")
    expect(requests).toBe(1)
    const response = await page.goto(`/reset-password?token=${"A".repeat(24)}`)
    expect(response?.headers()["referrer-policy"]).toBe("no-referrer")
    expect(response?.headers()["cache-control"]).toContain("no-store")
    await expect(page).toHaveURL(/\/reset-password$/)
    await page.getByRole("main").screenshot({
      path: `test-results/password-reset-form-${viewport.width}.png`,
    })
    await page.getByLabel("新密碼", { exact: true }).fill("NewPassword123!")
    await page.getByLabel("確認新密碼").fill("different-password")
    await page.getByRole("button", { name: "確認更新密碼" }).click()
    await expect(page.getByRole("main").getByRole("alert")).toContainText(
      "兩次輸入的密碼不一致"
    )
    await page.getByLabel("確認新密碼").fill("NewPassword123!")
    await page.getByRole("button", { name: "確認更新密碼" }).click()
    await expect(page.getByRole("status")).toContainText("密碼已重設")
    await page.screenshot({
      path: `test-results/password-recovery-${viewport.width}.png`,
      fullPage: true,
    })
    await page.getByRole("link", { name: "返回登入頁面" }).click()
    await expect(page).toHaveURL(/\/login$/)
  })
}

test("missing reset token offers a fresh request", async ({ page }) => {
  await page.goto("/reset-password")
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "重設連結無效"
  )
  await page.getByRole("link", { name: "重新申請重設連結" }).click()
  await expect(page).toHaveURL(/\/forgot-password$/)
})
