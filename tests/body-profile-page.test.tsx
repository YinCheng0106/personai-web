import type { ReactNode } from "react"
import { render, screen } from "@testing-library/react"
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
