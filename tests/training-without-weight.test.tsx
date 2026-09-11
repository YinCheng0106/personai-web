import { forwardRef, type ReactNode } from "react"
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

const pose = {
  frameId: 0,
  processingMs: 0,
  reps: 0,
  state: "idle" as const,
  angles: {
    leftKnee: null,
    rightKnee: null,
    leftHip: null,
    rightHip: null,
    leftElbow: null,
    rightElbow: null,
  },
  formErrors: [],
  trackingHints: [],
  trackingState: "ACQUIRING" as const,
  confidence: 0,
  isVisible: false,
  calories: null,
}

vi.mock("@/hooks/use-pose-analysis", () => ({
  usePoseAnalysis: () => ({
    pose,
    status: "idle",
    error: null,
    reset: vi.fn(),
  }),
}))
vi.mock("@/lib/auth-client", () => ({
  useSession: () => ({ data: { user: { id: "user" } }, isPending: false }),
  getAccessToken: vi.fn().mockResolvedValue("token"),
}))
vi.mock("@/lib/api", () => ({
  api: { postWorkoutRecord: vi.fn().mockResolvedValue({}) },
}))
vi.mock("@/lib/socket", () => ({
  connectPKSocket: vi.fn(),
}))
vi.mock("@/components/auth/require-auth", () => ({
  RequireAuth: ({ children }: { children: ReactNode }) => children,
}))
vi.mock("@/components/layout/page-container", () => ({
  PageContainer: ({
    action,
    children,
  }: {
    action?: ReactNode
    children: ReactNode
  }) => (
    <main>
      {action}
      {children}
    </main>
  ),
}))
vi.mock("@/components/fitness/camera-frame", () => ({
  CameraFrame: forwardRef(function MockCameraFrame({
    children,
  }: {
    children?: ReactNode
  }) {
    return <div>{children}</div>
  }),
}))

import AnalyzePage from "@/app/analyze/page"
import GamePKPage from "@/app/pk/page"

describe("training without body weight", () => {
  it("keeps Analyze available and shows calories as unavailable", () => {
    render(<AnalyzePage />)

    expect(screen.getByRole("button", { name: "開始訓練" })).toBeEnabled()
    expect(screen.queryByLabelText("體重（kg）")).not.toBeInTheDocument()
    expect(screen.getAllByText("未估算").length).toBeGreaterThan(0)
  })

  it("keeps PK room creation available without a weight field", () => {
    render(<GamePKPage />)

    expect(screen.getByRole("button", { name: "建立對戰房間" })).toBeEnabled()
    expect(screen.queryByLabelText("體重（kg）")).not.toBeInTheDocument()
    expect(screen.getByText(/未提供體重仍可正常對戰/)).toBeInTheDocument()
  })
})
