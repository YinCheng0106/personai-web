export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, "0")}`
}

export function formatCalories(value: number): string {
  return `${value.toFixed(1)} kcal`
}

export function formatAngle(value: number): string {
  return `${Math.round(value)}°`
}

export function formatDateLabel(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString("zh-TW", { month: "long", day: "numeric", weekday: "short" })
}

export function bmiCategory(bmi: number): "underweight" | "normal" | "overweight" | "obese" {
  if (bmi < 18.5) return "underweight"
  if (bmi < 24) return "normal"
  if (bmi < 27) return "overweight"
  return "obese"
}

export function calcBmi(weightKg: number, heightCm: number): number {
  const m = heightCm / 100
  return weightKg / (m * m)
}
