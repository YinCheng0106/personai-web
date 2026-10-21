import type { ReactNode } from "react"
import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { deferred } from "./helpers/fixtures"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { BodyMeasurement, BodyProfile } from "@/types/body-profile"

const mocks = vi.hoisted(() => ({
  getBodyProfile: vi.fn(),
  getBodyMeasurements: vi.fn(),
  updateBodyProfile: vi.fn(),
  createBodyMeasurement: vi.fn(),
}))

vi.mock("@/lib/api", () => ({ api: mocks }))
vi.mock("@/lib/auth-client", () => ({
  useSession: () => ({ data: { user: { id: "user" } }, isPending: false }),
}))
vi.mock("@/components/auth/require-auth", () => ({
  RequireAuth: ({ children }: { children: ReactNode }) => children,
}))
vi.mock("@/components/layout/page-container", () => ({
  PageContainer: ({
    title,
    children,
  }: {
    title: string
    children: ReactNode
  }) => (
    <main>
      <h1>{title}</h1>
      {children}
    </main>
  ),
}))

import InBodyPage from "@/app/inbody/page"

function profile(values: Partial<BodyProfile> = {}): BodyProfile {
  return {
    state: "unknown",
    heightCm: null,
    weightKg: null,
    bmi: null,
    updatedAt: null,
    ...values,
  }
}

function measurement(values: Partial<BodyMeasurement> = {}): BodyMeasurement {
  return {
    id: "measurement",
    source: "InBody",
    sourceLabel: null,
    measuredAt: "2026-09-10T00:00:00Z",
    createdAt: "2026-09-10T00:00:00Z",
    updatedAt: "2026-09-10T00:00:00Z",
    heightCm: null,
    weightKg: null,
    bodyFatPct: 18.5,
    skeletalMuscleMassKg: null,
    bodyFatMassKg: null,
    totalBodyWaterKg: null,
    visceralFatLevel: null,
    bmi: null,
    leanBodyMassKg: null,
    bmrKcalDay: null,
    bmrIsFormulaEstimate: false,
    ...values,
  }
}

describe("Body Profile page states", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getBodyMeasurements.mockResolvedValue([])
  })

  it("shows a real loading state without an editable profile", () => {
    mocks.getBodyProfile.mockReturnValue(new Promise(() => undefined))
    mocks.getBodyMeasurements.mockReturnValue(new Promise(() => undefined))

    render(<InBodyPage />)

    expect(screen.getByText("載入身體資料中…")).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "儲存基本資料" })
    ).not.toBeInTheDocument()
  })

  it("shows API failure separately from Unknown", async () => {
    mocks.getBodyProfile.mockRejectedValue(new Error("服務暫時無法使用"))
    render(<InBodyPage />)

    expect(await screen.findByText("無法載入身體資料")).toBeInTheDocument()
    expect(screen.getByRole("alert")).toHaveTextContent("服務暫時無法使用")
    expect(screen.queryByText("尚未提供身體資料")).not.toBeInTheDocument()
  })

  it("renders Unknown without opening or pre-populating a form", async () => {
    mocks.getBodyProfile.mockResolvedValue(profile())
    render(<InBodyPage />)

    expect(await screen.findByText("尚未提供身體資料")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "新增基本資料" })).toBeVisible()
    expect(
      screen.getByRole("button", { name: "新增身體組成量測" })
    ).toBeVisible()
    expect(screen.queryByLabelText("身高（cm）")).not.toBeInTheDocument()
  })

  it.each([
    ["height-only", 175, null, "175", "未提供"],
    ["weight-only", null, 68, "68", "未提供"],
  ])(
    "renders a %s Basic profile",
    async (_, heightCm, weightKg, known, unknown) => {
      mocks.getBodyProfile.mockResolvedValue(
        profile({ state: "basic", heightCm, weightKg })
      )
      render(<InBodyPage />)

      expect(await screen.findByText(known)).toBeInTheDocument()
      expect(screen.getByText(unknown)).toBeInTheDocument()
      expect(screen.getByText("尚無專業量測。")).toBeInTheDocument()
    }
  )

  it("renders a complete Basic profile and backend-provided BMI", async () => {
    mocks.getBodyProfile.mockResolvedValue(
      profile({ state: "basic", heightCm: 175, weightKg: 68, bmi: 22.2 })
    )
    render(<InBodyPage />)

    expect(await screen.findByText("175")).toBeInTheDocument()
    expect(screen.getByText("68")).toBeInTheDocument()
    expect(screen.getByText("公式估算")).toBeInTheDocument()
    expect(screen.getByText("22.2")).toBeInTheDocument()
  })

  it("renders a partial measurement without absent or derived values", async () => {
    mocks.getBodyProfile.mockResolvedValue(profile({ state: "measured" }))
    mocks.getBodyMeasurements.mockResolvedValue([measurement()])
    render(<InBodyPage />)

    expect(await screen.findByText("量測值")).toBeInTheDocument()
    expect(screen.getAllByText("體脂率 18.5%").length).toBeGreaterThan(0)
    expect(
      screen.queryByText("骨骼肌重", { exact: true })
    ).not.toBeInTheDocument()
    expect(screen.queryByText("依量測資料計算")).not.toBeInTheDocument()
  })

  it("separates complete measured values from derived values", async () => {
    mocks.getBodyProfile.mockResolvedValue(
      profile({ state: "measured", heightCm: 175, weightKg: 68, bmi: 22.2 })
    )
    mocks.getBodyMeasurements.mockResolvedValue([
      measurement({
        heightCm: 175,
        weightKg: 68,
        skeletalMuscleMassKg: 30,
        bodyFatMassKg: 12.6,
        totalBodyWaterKg: 40,
        visceralFatLevel: 7,
        bmi: 22.2,
        leanBodyMassKg: 55.4,
        bmrKcalDay: 1566.6,
        bmrIsFormulaEstimate: true,
      }),
    ])
    render(<InBodyPage />)

    expect(await screen.findByText("量測值")).toBeInTheDocument()
    expect(screen.getByText("依量測資料計算")).toBeInTheDocument()
    expect(screen.getByText("瘦體重")).toBeInTheDocument()
    expect(screen.getByText("基礎代謝率")).toBeInTheDocument()
  })
})

describe("Body Profile editing and recovery", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getBodyProfile.mockReset().mockResolvedValue(profile())
    mocks.getBodyMeasurements.mockReset().mockResolvedValue([])
    mocks.updateBodyProfile.mockReset()
    mocks.createBodyMeasurement.mockReset()
  })

  it("retries a load failure and returns to Unknown only after a successful response", async () => {
    mocks.getBodyProfile.mockRejectedValueOnce(new Error("Offline"))
    const user = userEvent.setup()
    render(<InBodyPage />)
    expect(await screen.findByRole("alert")).toHaveTextContent("Offline")
    await user.click(screen.getByRole("button", { name: "重新載入" }))
    expect(await screen.findByText("尚未提供身體資料")).toBeVisible()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  it("keeps failed edits for retry, disables duplicate saves, then reflects the saved profile", async () => {
    mocks.getBodyProfile.mockResolvedValue(
      profile({ state: "basic", heightCm: 175, weightKg: 68 })
    )
    mocks.updateBodyProfile.mockRejectedValueOnce(new Error("Save failed"))
    const user = userEvent.setup()
    render(<InBodyPage />)
    await user.click(await screen.findByRole("button", { name: "編輯" }))
    await user.clear(screen.getByLabelText("體重（kg）"))
    await user.click(screen.getByRole("button", { name: "儲存基本資料" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("Save failed")
    expect(screen.getByLabelText("身高（cm）")).toHaveValue(175)
    const pending = deferred<BodyProfile>()
    mocks.updateBodyProfile.mockReturnValueOnce(pending.promise)
    await user.click(screen.getByRole("button", { name: "儲存基本資料" }))
    expect(screen.getByRole("button", { name: "儲存中…" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "取消" })).toBeDisabled()
    await act(async () =>
      pending.resolve(profile({ state: "basic", heightCm: 175 }))
    )
    expect(await screen.findByRole("button", { name: "編輯" })).toBeVisible()
    expect(mocks.updateBodyProfile).toHaveBeenLastCalledWith({
      heightCm: 175,
      weightKg: null,
    })
    expect(screen.getByText("未提供")).toBeVisible()
  })

  it("creates a measured profile from Unknown without inventing body values", async () => {
    mocks.createBodyMeasurement
      .mockRejectedValueOnce(new Error("Measurement failed"))
      .mockResolvedValueOnce(measurement())
    const user = userEvent.setup()
    render(<InBodyPage />)
    await user.click(
      await screen.findByRole("button", { name: "新增身體組成量測" })
    )
    await user.type(screen.getByLabelText("量測來源"), "InBody")
    await user.type(screen.getByLabelText("量測日期"), "2026-10-15")
    await user.type(screen.getByLabelText("體脂率（%）"), "18.5")
    await user.click(screen.getByRole("button", { name: "儲存量測" }))
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Measurement failed"
    )
    expect(screen.getByLabelText("體脂率（%）")).toHaveValue(18.5)
    mocks.getBodyProfile.mockResolvedValue(profile({ state: "measured" }))
    mocks.getBodyMeasurements.mockResolvedValue([measurement()])
    await user.click(screen.getByRole("button", { name: "儲存量測" }))
    expect(await screen.findByText("量測值")).toBeVisible()
    expect(mocks.createBodyMeasurement).toHaveBeenLastCalledWith(
      expect.objectContaining({
        heightCm: null,
        weightKg: null,
        bodyFatPct: 18.5,
      })
    )
    expect(screen.queryByText("基礎代謝率")).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "新增量測" }))
    await user.click(screen.getByRole("button", { name: "取消" }))
    expect(screen.getByText("量測值")).toBeVisible()
  })

  it("cancels a new basic profile without saving", async () => {
    const user = userEvent.setup()
    render(<InBodyPage />)
    await user.click(
      await screen.findByRole("button", { name: "新增基本資料" })
    )
    await user.click(screen.getByRole("button", { name: "取消" }))
    expect(screen.getByText("尚未提供身體資料")).toBeVisible()
    expect(mocks.updateBodyProfile).not.toHaveBeenCalled()
  })
})
