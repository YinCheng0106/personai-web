"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision"

import { connectAnalyzeSocket } from "@/lib/socket"
import { getAccessToken } from "@/lib/auth-client"
import type { ExerciseType, PoseData } from "@/types/pose"

const WASM_BASE =
  process.env.NEXT_PUBLIC_MEDIAPIPE_WASM_BASE ??
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm"
const MODEL_PATH =
  process.env.NEXT_PUBLIC_POSE_MODEL_PATH ??
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task"
const FRAME_INTERVAL_MS = 1000 / 12

export const EMPTY_POSE: PoseData = {
  frameId: 0,
  processingMs: 0,
  reps: 0,
  state: "idle",
  angles: {
    leftKnee: 0,
    rightKnee: 0,
    leftHip: 0,
    rightHip: 0,
    leftElbow: 0,
    rightElbow: 0,
  },
  errors: [],
  confidence: 0,
  isVisible: false,
  calories: 0,
}

export type PoseAnalysisStatus =
  | "idle"
  | "loading-model"
  | "connecting"
  | "live"
  | "error"

let landmarkerPromise: Promise<PoseLandmarker> | null = null

function getPoseLandmarker() {
  if (!landmarkerPromise) {
    landmarkerPromise = FilesetResolver.forVisionTasks(WASM_BASE)
      .then((vision) =>
        PoseLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL_PATH },
          runningMode: "VIDEO",
          numPoses: 1,
          minPoseDetectionConfidence: 0.5,
          minPosePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
          outputSegmentationMasks: false,
        })
      )
      .catch((error) => {
        landmarkerPromise = null
        throw error
      })
  }
  return landmarkerPromise
}

type Options = {
  active: boolean
  exercise: ExerciseType
  weightKg: number
  video: HTMLVideoElement | null
}

export function usePoseAnalysis({
  active,
  exercise,
  weightKg,
  video,
}: Options) {
  const [pose, setPose] = useState<PoseData>(EMPTY_POSE)
  const [status, setStatus] = useState<PoseAnalysisStatus>("idle")
  const [error, setError] = useState<string | null>(null)
  const socketRef = useRef<WebSocket | null>(null)
  const frameIdRef = useRef(0)

  const reset = useCallback(() => {
    setPose(EMPTY_POSE)
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ action: "reset" }))
    }
  }, [])

  useEffect(() => {
    if (!active || !video) {
      socketRef.current = null
      return
    }

    let cancelled = false
    let animationFrame = 0
    let lastVideoTime = -1
    let lastSentAt = 0
    queueMicrotask(() => {
      if (!cancelled) {
        setError(null)
        setStatus("loading-model")
      }
    })

    let socket: WebSocket | null = null

    void getAccessToken()
      .then((token) => {
        if (cancelled) return
        socket = connectAnalyzeSocket(exercise, weightKg, token, {
          onOpen: () => {
            if (!cancelled) setStatus("live")
          },
          onClose: () => {
            if (!cancelled) setStatus("error")
          },
          onError: () => {
            if (!cancelled) setError("無法連線至姿勢分析伺服器。")
          },
          onServerError: (message) => {
            if (!cancelled) setError(message)
          },
          onFrame: (frame) => {
            if (!cancelled) setPose(frame)
          },
        })
        socketRef.current = socket
      })
      .catch((cause) => {
        if (!cancelled) {
          setStatus("error")
          setError(
            cause instanceof Error ? cause.message : "無法取得登入憑證。"
          )
        }
      })
    queueMicrotask(() => {
      if (!cancelled) setStatus("connecting")
    })

    void getPoseLandmarker()
      .then((landmarker) => {
        const analyzeFrame = () => {
          if (cancelled) return
          const now = performance.now()
          const canAnalyze =
            video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
            video.currentTime !== lastVideoTime &&
            now - lastSentAt >= FRAME_INTERVAL_MS

          if (canAnalyze) {
            try {
              const result = landmarker.detectForVideo(video, now)
              const landmarks = result.landmarks[0]
              if (
                landmarks?.length === 33 &&
                socket?.readyState === WebSocket.OPEN
              ) {
                socket.send(
                  JSON.stringify({
                    frame_id: ++frameIdRef.current,
                    keypoints: landmarks.map((point) => ({
                      x: point.x,
                      y: point.y,
                      z: point.z,
                      visibility: point.visibility ?? 0,
                    })),
                    timestamp: now / 1000,
                  })
                )
              }
              lastVideoTime = video.currentTime
              lastSentAt = now
            } catch (cause) {
              setError(
                cause instanceof Error ? cause.message : "姿勢模型執行失敗。"
              )
            }
          }
          animationFrame = requestAnimationFrame(analyzeFrame)
        }
        animationFrame = requestAnimationFrame(analyzeFrame)
      })
      .catch((cause) => {
        if (!cancelled) {
          setStatus("error")
          setError(
            cause instanceof Error ? cause.message : "無法載入姿勢模型。"
          )
        }
      })

    return () => {
      cancelled = true
      cancelAnimationFrame(animationFrame)
      socket?.close()
      if (socketRef.current === socket) socketRef.current = null
    }
  }, [active, exercise, video, weightKg])

  return { pose, status: active ? status : "idle", error, reset }
}
