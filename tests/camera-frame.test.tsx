import { useEffect } from "react"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("react-camera-pro", () => ({
  Camera: function Camera({
    videoReadyCallback,
  }: {
    videoReadyCallback: () => void
  }) {
    useEffect(() => {
      videoReadyCallback()
    }, [videoReadyCallback])
    return <video data-testid="camera-video" />
  },
}))
import { CameraFrame } from "@/components/fitness/camera-frame"

let getUserMedia: ReturnType<typeof vi.fn>
let query: ReturnType<typeof vi.fn>
beforeEach(() => {
  getUserMedia = vi.fn()
  query = vi.fn().mockResolvedValue({ state: "prompt" })
  vi.stubGlobal("navigator", {
    userAgent: "test",
    mediaDevices: { getUserMedia },
    permissions: { query },
  })
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callback(0)
    return 1
  })
})
afterEach(() => vi.unstubAllGlobals())

describe("camera permission UI with browser APIs replaced", () => {
  it("does not request camera access while inactive", () => {
    const ready = vi.fn()
    render(<CameraFrame active={false} onVideoReady={ready} />)
    expect(screen.getByText("相機尚未啟動")).toBeVisible()
    expect(ready).toHaveBeenCalledWith(null)
    expect(getUserMedia).not.toHaveBeenCalled()
  })

  it("explains unsupported browsers without offering an unusable permission button", async () => {
    vi.stubGlobal("navigator", { userAgent: "test" })
    render(<CameraFrame active />)
    expect(await screen.findByText("瀏覽器不支援")).toBeVisible()
    expect(
      screen.queryByRole("button", { name: "授權使用相機" })
    ).not.toBeInTheDocument()
  })

  it("requests video only, stops probe tracks, and reports the mounted video", async () => {
    const user = userEvent.setup()
    const stop = vi.fn()
    getUserMedia.mockResolvedValue({ getTracks: () => [{ stop }] })
    const ready = vi.fn()
    render(<CameraFrame active onVideoReady={ready} />)
    await user.click(
      await screen.findByRole("button", { name: "授權使用相機" })
    )
    expect(getUserMedia).toHaveBeenCalledExactlyOnceWith({
      video: { facingMode: "user" },
      audio: false,
    })
    expect(stop).toHaveBeenCalledOnce()
    await waitFor(() =>
      expect(ready).toHaveBeenCalledWith(screen.getByTestId("camera-video"))
    )
    expect(screen.queryByText("相機啟動中…")).not.toBeInTheDocument()
  })

  it.each([
    ["NotAllowedError", "相機權限被拒絕"],
    ["NotFoundError", "找不到相機"],
    ["NotReadableError", "相機啟用失敗"],
    ["UnknownError", "相機啟用失敗"],
  ])("explains %s and permits a retry", async (name, title) => {
    getUserMedia
      .mockRejectedValueOnce(new DOMException("Device failure", name))
      .mockResolvedValueOnce({ getTracks: () => [] })
    const user = userEvent.setup()
    render(<CameraFrame active />)
    await user.click(
      await screen.findByRole("button", { name: "授權使用相機" })
    )
    expect(await screen.findByText(title)).toBeVisible()
    await user.click(
      screen.getByRole("button", {
        name: name === "NotAllowedError" ? "重新請求權限" : "授權使用相機",
      })
    )
    expect(await screen.findByTestId("camera-video")).toBeVisible()
  })

  it("falls back to an explicit prompt when the Permissions API cannot query cameras", async () => {
    query.mockRejectedValue(new Error("Unsupported permission"))
    render(<CameraFrame active />)
    expect(
      await screen.findByRole("button", { name: "授權使用相機" })
    ).toBeEnabled()
    expect(getUserMedia).not.toHaveBeenCalled()
  })
})
