export type InBody = {
  heightCm: number
  weightKg: number
  bodyFatPct: number
  skeletalMuscleKg: number
  bmr: number
  measuredAt: string
}

export type BmiCategory = "underweight" | "normal" | "overweight" | "obese"

export type BodyComposition = {
  label: string
  current: number
  target: number
  unit: string
  tone: "neutral" | "good" | "warning" | "danger"
}
