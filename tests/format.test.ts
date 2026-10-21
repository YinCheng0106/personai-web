import { describe, expect, it } from "vitest"

import { formatAngle, formatCalories } from "@/lib/format"

describe("angle formatting", () => {
  it("renders unavailable angles as a dash instead of zero degrees", () => {
    expect(formatAngle(null)).toBe("—")
    expect(formatAngle(0)).toBe("0°")
  })
})

describe("calorie formatting", () => {
  it("keeps unavailable calories distinct from a stored zero", () => {
    expect(formatCalories(null)).toBe("未估算")
    expect(formatCalories(0)).toBe("0.0 kcal")
  })
})
