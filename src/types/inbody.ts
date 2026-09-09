export type InBody = {
  heightCm: number
  weightKg: number
  bodyFatPct: number
  skeletalMuscleKg: number
  age: number
  gender: "male" | "female"
  bodyFatMassKg: number
  totalBodyWaterKg?: number
  visceralFatLevel?: number
  bmr: number
  bmi: number
  bmiCategory: string
  leanBodyMassKg: number
  measuredAt: string
}

export type InBodyInput = {
  heightCm: number
  weightKg: number
  age: number
  gender: "male" | "female"
  bodyFatPct: number
  skeletalMuscleKg: number
  bodyFatMassKg: number
  totalBodyWaterKg?: number
  visceralFatLevel?: number
}

export type CalorieEstimateInput = {
  exercise: "squat" | "pushup"
  durationMin: number
  intensity?: "light" | "moderate" | "vigorous"
}

export type BmiCategory = "underweight" | "normal" | "overweight" | "obese"

export type BodyComposition = {
  label: string
  current: number
  target: number
  unit: string
  tone: "neutral" | "good" | "warning" | "danger"
}
