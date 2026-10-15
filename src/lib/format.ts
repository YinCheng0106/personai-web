export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, "0")}`
}

export function formatCalories(value: number | null): string {
  return value === null ? "未估算" : `${value.toFixed(1)} kcal`
}

export function formatAngle(value: number | null): string {
  return value === null ? "—" : `${Math.round(value)}°`
}

export function formatDateLabel(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString("zh-TW", {
    month: "long",
    day: "numeric",
    weekday: "short",
  })
}
