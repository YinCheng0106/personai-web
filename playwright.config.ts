import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          args: [
            "--use-fake-device-for-media-stream",
            "--use-fake-ui-for-media-stream",
          ],
        },
      },
    },
  ],
  webServer: {
    command: "bun run dev",
    url: "http://localhost:3000",
    env: {
      ...process.env,
      NEXT_PUBLIC_API_BASE: "http://localhost:8000",
      NEXT_PUBLIC_WS_BASE: "ws://localhost:8000",

      BETTER_AUTH_URL: "http://localhost:3000",
      NEXT_PUBLIC_BETTER_AUTH_URL: "http://localhost:3000",
      BETTER_AUTH_TRUSTED_ORIGINS:
        "http://localhost:3000,http://127.0.0.1:3000",

      AUTH_ISSUER: "http://localhost:3000",
      AUTH_AUDIENCE: "personai-api",
    },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
