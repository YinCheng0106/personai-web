"use client"

import { forwardRef, useCallback, useEffect, useRef, useState } from "react"
import { Camera } from "react-camera-pro"
import type { CameraType } from "react-camera-pro"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  CameraOffIcon,
  Camera01Icon,
  AlertCircleIcon,
  Loading03Icon,
} from "@hugeicons/core-free-icons"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type Props = {
  active: boolean
  className?: string
  children?: React.ReactNode
}

type PermissionStatus =
  | "idle"
  | "checking"
  | "prompt"
  | "granted"
  | "denied"
  | "no-device"
  | "unsupported"
  | "error"

export const CameraFrame = forwardRef<CameraType, Props>(function CameraFrame(
  { active, className, children },
  ref,
) {
  const fallbackRef = useRef<CameraType>(null)
  const cameraRef = (ref as React.RefObject<CameraType> | null) ?? fallbackRef
  const [ready, setReady] = useState(false)
  const [status, setStatus] = useState<PermissionStatus>("idle")
  const [errorMessage, setErrorMessage] = useState<string>("")

  const probePermission = useCallback(async () => {
    setReady(false)
    setErrorMessage("")
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setStatus("unsupported")
      setErrorMessage("此瀏覽器不支援相機 API，請改用最新版的 Chrome/Safari/Firefox。")
      return
    }
    if (
      typeof navigator.permissions !== "undefined" &&
      navigator.permissions.query
    ) {
      try {
        const result = await navigator.permissions.query({
          name: "camera" as PermissionName,
        })
        if (result.state === "granted") setStatus("granted")
        else if (result.state === "denied") setStatus("denied")
        else setStatus("prompt")
        return
      } catch {
        // Permissions API may not support "camera" in some browsers — fall
        // through to manual prompt.
      }
    }
    setStatus("prompt")
  }, [])

  useEffect(() => {
    if (!active) return
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      probePermission()
    })
    return () => {
      cancelled = true
    }
  }, [active, probePermission])

  async function requestPermission() {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setStatus("unsupported")
      setErrorMessage("此瀏覽器不支援相機 API，請改用最新版的 Chrome/Safari/Firefox。")
      return
    }
    setStatus("checking")
    setErrorMessage("")
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      })
      stream.getTracks().forEach((t) => t.stop())
      setStatus("granted")
    } catch (err) {
      const e = err as DOMException
      if (e.name === "NotAllowedError" || e.name === "PermissionDeniedError") {
        setStatus("denied")
        setErrorMessage(
          "瀏覽器已拒絕相機存取。請點選網址列旁的鎖頭圖示，將相機權限改為「允許」後重試。",
        )
      } else if (
        e.name === "NotFoundError" ||
        e.name === "DevicesNotFoundError"
      ) {
        setStatus("no-device")
        setErrorMessage("找不到可用的相機裝置，請確認硬體已連接。")
      } else if (
        e.name === "NotReadableError" ||
        e.name === "TrackStartError"
      ) {
        setStatus("error")
        setErrorMessage("相機被其他應用程式占用，請關閉後再試。")
      } else {
        setStatus("error")
        setErrorMessage(e.message || "啟用相機時發生未知錯誤，請重試。")
      }
    }
  }

  return (
    <div
      className={cn(
        "relative aspect-3/4 w-full overflow-hidden rounded-3xl bg-black md:aspect-video",
        className,
      )}
    >
      {active && status === "granted" ? (
        <Camera
          ref={cameraRef}
          aspectRatio="cover"
          facingMode="user"
          videoReadyCallback={() => setReady(true)}
          errorMessages={{
            noCameraAccessible: "找不到可用的相機裝置，請連接相機或更換瀏覽器。",
            permissionDenied: "相機權限被拒絕，請點擊下方按鈕重新授權。",
            switchCamera: "目前裝置只有一個相機，無法切換。",
            canvas: "瀏覽器不支援 Canvas。",
          }}
        />
      ) : null}

      {!active ? (
        <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-zinc-900 via-zinc-800 to-zinc-900 text-zinc-300">
          <div className="flex flex-col items-center gap-3 px-6 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10">
              <HugeiconsIcon icon={CameraOffIcon} size={22} strokeWidth={1.6} />
            </span>
            <p className="text-sm font-medium">相機尚未啟動</p>
            <p className="max-w-xs text-xs text-zinc-400">
              點擊下方「開始訓練」啟動相機，AI 教練會即時偵測你的姿勢並計算動作次數。
            </p>
          </div>
        </div>
      ) : null}

      {active && status !== "granted" ? (
        <PermissionPrompt
          status={status}
          message={errorMessage}
          onAllow={requestPermission}
        />
      ) : null}

      {active && status === "granted" && !ready ? (
        <div className="absolute inset-0 grid place-items-center bg-black/40 text-xs text-white/80">
          相機啟動中…
        </div>
      ) : null}

      {children}
    </div>
  )
})

type PromptProps = {
  status: PermissionStatus
  message: string
  onAllow: () => void
}

function PermissionPrompt({ status, message, onAllow }: PromptProps) {
  const isError =
    status === "denied" || status === "no-device" || status === "error"
  const isUnsupported = status === "unsupported"
  const checking = status === "checking"

  let title = "需要相機權限"
  let description =
    "點擊下方按鈕，瀏覽器會跳出相機授權視窗，授權後即可開始即時動作分析。"
  if (status === "denied") {
    title = "相機權限被拒絕"
    description =
      message ||
      "瀏覽器已封鎖此網站的相機權限。請點選網址列旁的鎖頭圖示重新允許，或點擊下方按鈕再試一次。"
  } else if (status === "no-device") {
    title = "找不到相機"
    description = message || "請確認電腦或手機已連接可用的相機裝置。"
  } else if (status === "error") {
    title = "相機啟用失敗"
    description = message || "啟用相機時發生未知錯誤。"
  } else if (status === "unsupported") {
    title = "瀏覽器不支援"
    description =
      message ||
      "此瀏覽器不支援 getUserMedia，請改用最新版的 Chrome、Safari 或 Firefox。"
  }

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-linear-to-br from-zinc-950/90 via-zinc-900/90 to-zinc-950/90 px-6 text-center text-zinc-100 backdrop-blur-sm">
      <div className="flex max-w-sm flex-col items-center gap-4">
        <span
          className={cn(
            "grid h-14 w-14 place-items-center rounded-3xl",
            isError ? "bg-destructive/20 text-destructive" : "bg-white/10 text-white",
          )}
        >
          <HugeiconsIcon
            icon={isError ? AlertCircleIcon : Camera01Icon}
            size={26}
            strokeWidth={1.6}
          />
        </span>
        <div className="space-y-1.5">
          <p className="text-base font-medium text-white">{title}</p>
          <p className="text-sm text-zinc-300">{description}</p>
        </div>
        {!isUnsupported ? (
          <Button
            type="button"
            size="lg"
            onClick={onAllow}
            disabled={checking}
            className="bg-white text-zinc-900 hover:bg-white/90"
          >
            {checking ? (
              <HugeiconsIcon
                icon={Loading03Icon}
                size={16}
                strokeWidth={2}
                className="animate-spin"
              />
            ) : (
              <HugeiconsIcon icon={Camera01Icon} size={16} strokeWidth={2} />
            )}
            {checking
              ? "授權中…"
              : status === "denied"
                ? "重新請求權限"
                : "授權使用相機"}
          </Button>
        ) : null}
      </div>
    </div>
  )
}
