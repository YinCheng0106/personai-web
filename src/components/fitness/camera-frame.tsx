"use client"

import { forwardRef, useRef, useState } from "react"
import { Camera } from "react-camera-pro"
import type { CameraType } from "react-camera-pro"
import { HugeiconsIcon } from "@hugeicons/react"
import { CameraOffIcon } from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"

type Props = {
  active: boolean
  className?: string
  children?: React.ReactNode
}

export const CameraFrame = forwardRef<CameraType, Props>(function CameraFrame(
  { active, className, children },
  ref,
) {
  const fallbackRef = useRef<CameraType>(null)
  const cameraRef = (ref as React.RefObject<CameraType> | null) ?? fallbackRef
  const [ready, setReady] = useState(false)

  return (
    <div
      className={cn(
        "relative aspect-3/4 w-full overflow-hidden rounded-3xl bg-black md:aspect-video",
        className,
      )}
    >
      {active ? (
        <Camera
          ref={cameraRef}
          aspectRatio="cover"
          facingMode="user"
          videoReadyCallback={() => setReady(true)}
          errorMessages={{
            noCameraAccessible: "找不到可用的相機裝置，請連接相機或更換瀏覽器。",
            permissionDenied: "相機權限被拒絕，請重新整理並授權相機權限。",
            switchCamera: "目前裝置只有一個相機，無法切換。",
            canvas: "瀏覽器不支援 Canvas。",
          }}
        />
      ) : (
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
      )}
      {active && !ready ? (
        <div className="absolute inset-0 grid place-items-center bg-black/40 text-xs text-white/80">
          相機啟動中…
        </div>
      ) : null}
      {children}
    </div>
  )
})
