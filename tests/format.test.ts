import { describe, expect, it } from "vitest"

import { formatAngle } from "@/lib/format"

describe("angle formatting", () => {
  it("renders unavailable angles as a dash instead of zero degrees", () => {
    expect(formatAngle(null)).toBe("—")
    expect(formatAngle(0)).toBe("0°")
  })
})
