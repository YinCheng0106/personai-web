"use client"

import { useEffect, useRef, useState } from "react"
import type { ExerciseType, FsmState, PoseData } from "@/types/pose"

type Options = {
  exercise: ExerciseType
  active: boolean
}

const STATE_FLOW: FsmState[] = ["up", "descending", "bottom", "ascending"]

const POSSIBLE_ERRORS: Record<ExerciseType, string[]> = {
  squat: ["knee valgus detected", "insufficient depth"],
  pushup: ["elbow flare", "hip drop"],
}

const IDLE_DATA: PoseData = {
  reps: 0,
  state: "idle",
  angles: {
    leftKnee: 170,
    rightKnee: 170,
    leftHip: 170,
    rightHip: 170,
    leftElbow: 165,
    rightElbow: 165,
  },
  errors: [],
  confidence: 0.95,
  isVisible: true,
  calories: 0,
}

function angleFor(exercise: ExerciseType, phase: FsmState): number {
  const base = exercise === "squat" ? 170 : 165
  switch (phase) {
    case "descending":
      return base - 40 + Math.random() * 5
    case "bottom":
      return exercise === "squat" ? 90 + Math.random() * 5 : 75 + Math.random() * 5
    case "ascending":
      return base - 25 + Math.random() * 5
    default:
      return base + Math.random() * 3
  }
}

export function useMockPose({ exercise, active }: Options): PoseData {
  const phaseIdx = useRef(0)
  const reps = useRef(0)
  const errorsRef = useRef<string[]>([])
  const [data, setData] = useState<PoseData>(IDLE_DATA)

  useEffect(() => {
    if (!active) {
      phaseIdx.current = 0
      reps.current = 0
      errorsRef.current = []
      return
    }
    const tick = setInterval(() => {
      phaseIdx.current = (phaseIdx.current + 1) % STATE_FLOW.length
      const state = STATE_FLOW[phaseIdx.current]
      if (state === "up") reps.current += 1

      const knee = angleFor(exercise, state)
      const elbow = exercise === "pushup" ? angleFor(exercise, state) : 165
      const hip = exercise === "squat" ? knee + 5 : 170

      if (Math.random() < 0.18) {
        const pool = POSSIBLE_ERRORS[exercise]
        errorsRef.current = [pool[Math.floor(Math.random() * pool.length)]]
      } else {
        errorsRef.current = []
      }

      setData({
        reps: reps.current,
        state,
        angles: {
          leftKnee: knee,
          rightKnee: knee + (Math.random() - 0.5) * 4,
          leftHip: hip,
          rightHip: hip + (Math.random() - 0.5) * 4,
          leftElbow: elbow,
          rightElbow: elbow + (Math.random() - 0.5) * 4,
        },
        errors: errorsRef.current,
        confidence: 0.85 + Math.random() * 0.12,
        isVisible: true,
        calories: reps.current * (exercise === "squat" ? 0.32 : 0.28),
      })
    }, 650)
    return () => clearInterval(tick)
  }, [active, exercise])

  return active ? data : IDLE_DATA
}
