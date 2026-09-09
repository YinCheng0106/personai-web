import { describe, expect, it } from "vitest"

import { safeInternalRedirect } from "@/lib/redirect"

describe("safeInternalRedirect", () => {
  it("keeps local paths including their query string", () => {
    expect(safeInternalRedirect("/history?range=week")).toBe(
      "/history?range=week"
    )
  })

  it.each([
    "https://attacker.test",
    "//attacker.test",
    "/\\attacker.test",
    "javascript:alert(1)",
  ])("rejects an external or ambiguous target: %s", (value) => {
    expect(safeInternalRedirect(value)).toBe("/")
  })
})
