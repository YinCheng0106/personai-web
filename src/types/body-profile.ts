export type BodyProfileState = "unknown" | "basic" | "measured"

export type BodyProfile = {
  state: BodyProfileState
  heightCm: number | null
  weightKg: number | null
  bmi: number | null
  updatedAt: string | null
}

export type BasicProfileInput = {
  heightCm: number | null
  weightKg: number | null
}

export type BasicProfilePatch = Partial<BasicProfileInput>

export type BodyMeasurementValues = {
  heightCm: number | null
  weightKg: number | null
  bodyFatPct: number | null
  skeletalMuscleMassKg: number | null
  bodyFatMassKg: number | null
  totalBodyWaterKg: number | null
  visceralFatLevel: number | null
}

export type BodyMeasurement = BodyMeasurementValues & {
  id: string
  source: string
  sourceLabel: string | null
  measuredAt: string
  createdAt: string
  updatedAt: string
  bmi: number | null
  leanBodyMassKg: number | null
  bmrKcalDay: number | null
  bmrIsFormulaEstimate: boolean
}

export type BodyMeasurementInput = BodyMeasurementValues & {
  source: string
  sourceLabel: string | null
  measuredAt: string
}

export type BodyMeasurementPatch = Partial<BodyMeasurementInput>
