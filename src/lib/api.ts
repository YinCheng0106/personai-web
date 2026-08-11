import type {
  DailySummary,
  ExerciseSummary,
  WorkoutRecord,
  WorkoutRecordInput,
} from "@/types/workout"
import type { CalorieEstimateInput, InBody, InBodyInput } from "@/types/inbody"
import { getAccessToken } from "@/lib/auth-client"

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000"

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message)
    this.name = "ApiError"
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getAccessToken()
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      detail?: string
    } | null
    throw new ApiError(res.status, body?.detail ?? `API ${path} failed`)
  }
  return (await res.json()) as T
}

type WorkoutWire = {
  id: string
  user_id: string
  exercise_type: "squat" | "pushup"
  reps: number
  sets: number
  duration_sec: number
  calories_burned: number
  avg_intensity: "light" | "moderate" | "vigorous"
  errors_count: number
  form_score: number
  timestamp: string
}

type DailySummaryWire = {
  date: string
  total_calories: number
  total_duration_min: number
  workout_count: number
  total_reps: number
}

type ExerciseSummaryWire = {
  exercise_type: "squat" | "pushup"
  total_reps: number
  total_calories: number
  session_count: number
  avg_form_score: number
}

type InBodyWire = {
  height_cm: number
  weight_kg: number
  bmi: number
  bmi_category: string
  body_fat_pct: number
  skeletal_muscle_mass_kg: number
  lean_body_mass_kg: number
  bmr_kcal_day: number
  measured_at: string
}

function normalizeWorkout(item: WorkoutWire): WorkoutRecord {
  return {
    id: item.id,
    exercise: item.exercise_type,
    reps: item.reps,
    durationSec: item.duration_sec,
    calories: item.calories_burned,
    formScore: item.form_score,
    performedAt: item.timestamp,
  }
}

function normalizeInBody(item: InBodyWire): InBody {
  return {
    heightCm: item.height_cm,
    weightKg: item.weight_kg,
    bmi: item.bmi,
    bmiCategory: item.bmi_category,
    bodyFatPct: item.body_fat_pct,
    skeletalMuscleKg: item.skeletal_muscle_mass_kg,
    leanBodyMassKg: item.lean_body_mass_kg,
    bmr: item.bmr_kcal_day,
    measuredAt: item.measured_at,
  }
}

export const api = {
  serverHealth: () => request<{ status: string; detail: string }>("/server"),

  async getWorkouts() {
    return (await request<WorkoutWire[]>("/wk/me")).map(normalizeWorkout)
  },

  async getWorkoutSummary(): Promise<ExerciseSummary[]> {
    return (await request<ExerciseSummaryWire[]>("/wk/me/summary")).map(
      (item) => ({
        exercise: item.exercise_type,
        totalReps: item.total_reps,
        totalCalories: item.total_calories,
        sessions: item.session_count,
        avgFormScore: item.avg_form_score,
      })
    )
  },

  async getDailySummary(): Promise<DailySummary[]> {
    return (await request<DailySummaryWire[]>("/wk/me/daily")).map((item) => ({
      date: item.date,
      totalReps: item.total_reps,
      totalCalories: item.total_calories,
      durationMin: item.total_duration_min,
      workoutCount: item.workout_count,
    }))
  },

  async postWorkoutRecord(payload: WorkoutRecordInput) {
    const item = await request<WorkoutWire>("/wk/me/record", {
      method: "POST",
      body: JSON.stringify({
        exercise_type: payload.exercise,
        reps: payload.reps,
        sets: payload.sets ?? 1,
        duration_sec: payload.durationSec,
        calories_burned: payload.calories,
        avg_intensity: payload.averageIntensity ?? "moderate",
        errors_count: payload.errorsCount,
      }),
    })
    return normalizeWorkout(item)
  },

  async getInBody() {
    return normalizeInBody(await request<InBodyWire>("/inbody/me"))
  },

  async postInBody(payload: InBodyInput) {
    const item = await request<InBodyWire>("/inbody/me", {
      method: "POST",
      body: JSON.stringify({
        height_cm: payload.heightCm,
        weight_kg: payload.weightKg,
        age: payload.age,
        gender: payload.gender,
        body_fat_pct: payload.bodyFatPct,
        skeletal_muscle_mass_kg: payload.skeletalMuscleKg,
        body_fat_mass_kg: payload.bodyFatMassKg,
        total_body_water_kg: payload.totalBodyWaterKg,
        visceral_fat_level: payload.visceralFatLevel,
      }),
    })
    return normalizeInBody(item)
  },

  estimateCalories(payload: CalorieEstimateInput) {
    return request<{
      exercise_type: string
      duration_min: number
      intensity: string
      mets: number
      calories_burned: number
    }>("/inbody/me/calories", {
      method: "POST",
      body: JSON.stringify({
        exercise_type: payload.exercise,
        duration_min: payload.durationMin,
        intensity: payload.intensity ?? "moderate",
      }),
    }).then((item) => ({ calories: item.calories_burned, mets: item.mets }))
  },
}
