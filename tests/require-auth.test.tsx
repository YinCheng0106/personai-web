import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

const { useSession } = vi.hoisted(() => ({ useSession: vi.fn() }))
vi.mock("@/lib/auth-client", () => ({ useSession }))
vi.mock("next/navigation", () => ({ usePathname: () => "/history" }))

import { RequireAuth } from "@/components/auth/require-auth"

describe("RequireAuth", () => {
  it("shows sign-in actions when there is no HttpOnly session", () => {
    useSession.mockReturnValue({ data: null, isPending: false })
    render(<RequireAuth>private</RequireAuth>)
    expect(screen.getByRole("link", { name: "登入" })).toHaveAttribute(
      "href",
      "/login?redirect=%2Fhistory"
    )
    expect(screen.queryByText("private")).not.toBeInTheDocument()
  })

  it("renders protected content for an authenticated session", () => {
    useSession.mockReturnValue({
      data: { user: { id: "uuid" } },
      isPending: false,
    })
    render(<RequireAuth>private</RequireAuth>)
    expect(screen.getByText("private")).toBeInTheDocument()
  })
})
