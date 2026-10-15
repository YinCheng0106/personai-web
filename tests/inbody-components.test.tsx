import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { BasicProfileForm } from "@/components/inbody/basic-profile-form"
import { BodyMeasurementForm } from "@/components/inbody/body-measurement-form"
import { MeasurementHistory } from "@/components/inbody/measurement-history"
import type { BodyMeasurement } from "@/types/body-profile"

function measurement(
  id: string,
  measuredAt: string,
  source: string
): BodyMeasurement {
  return {
    id,
    source,
    sourceLabel: null,
    measuredAt,
    createdAt: measuredAt,
    updatedAt: measuredAt,
    heightCm: null,
    weightKg: null,
    bodyFatPct: 18,
    skeletalMuscleMassKg: null,
    bodyFatMassKg: null,
    totalBodyWaterKg: null,
    visceralFatLevel: null,
    bmi: null,
    leanBodyMassKg: null,
    bmrKcalDay: null,
    bmrIsFormulaEstimate: false,
  }
}

describe("body data forms", () => {
  it("sends explicit nulls when Basic fields are cleared", async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(
      <BasicProfileForm
        initial={{ heightCm: 175, weightKg: 68 }}
        saving={false}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />
    )

    await user.clear(screen.getByLabelText("身高（cm）"))
    await user.clear(screen.getByLabelText("體重（kg）"))
    await user.click(screen.getByRole("button", { name: "儲存基本資料" }))

    expect(onSubmit).toHaveBeenCalledWith({ heightCm: null, weightKg: null })
  })

  it("keeps empty optional measurement inputs null", async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(
      <BodyMeasurementForm
        saving={false}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />
    )

    await user.type(screen.getByLabelText("量測來源"), "InBody")
    await user.type(screen.getByLabelText("量測日期"), "2026-09-10")
    await user.type(screen.getByLabelText("體脂率（%）"), "18.5")
    await user.click(screen.getByRole("button", { name: "儲存量測" }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      source: "InBody",
      sourceLabel: null,
      heightCm: null,
      weightKg: null,
      bodyFatPct: 18.5,
      skeletalMuscleMassKg: null,
      bodyFatMassKg: null,
      totalBodyWaterKg: null,
      visceralFatLevel: null,
    })
  })
})

describe("measurement history", () => {
  it("renders measurements newest first", () => {
    render(
      <MeasurementHistory
        measurements={[
          measurement("older", "2026-01-01T00:00:00Z", "older-source"),
          measurement("newer", "2026-09-10T00:00:00Z", "newer-source"),
        ]}
      />
    )

    const items = screen.getAllByRole("listitem")
    expect(items[0]).toHaveTextContent("newer-source")
    expect(items[1]).toHaveTextContent("older-source")
  })
})
