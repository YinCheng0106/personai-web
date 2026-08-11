import { describe, expect, it } from "vitest"

import {
  validateConfirm,
  validateEmail,
  validateName,
  validatePassword,
} from "@/app/register/page"

describe("registration validation", () => {
  it("rejects invalid fields and accepts a valid account", () => {
    expect(validateName("a")).not.toBeNull()
    expect(validateEmail("not-an-email")).not.toBeNull()
    expect(validatePassword("password")).not.toBeNull()
    expect(validateConfirm("Personai123", "different")).not.toBeNull()

    expect(validateName("王小明")).toBeNull()
    expect(validateEmail("user@personai.test")).toBeNull()
    expect(validatePassword("Personai123")).toBeNull()
    expect(validateConfirm("Personai123", "Personai123")).toBeNull()
  })
})
