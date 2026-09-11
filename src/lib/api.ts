import type {
  DailySummary,
  ExerciseSummary,
  WorkoutRecord,
  WorkoutRecordInput,
} from "@/types/workout"
import type { CalorieEstimateInput, InBody, InBodyInput } from "@/types/inbody"
import type {
  BasicProfilePatch,
  BodyMeasurement,
  BodyMeasurementInput,
  BodyMeasurementPatch,
  BodyProfile,
  BodyProfileState,
} from "@/types/body-profile"
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
      detail?: unknown
    } | null
    const detail = typeof body?.detail === "string" ? body.detail : null
    let message = "請求失敗，請稍後再試。"
    if (res.status === 401) message = "登入已失效，請重新登入。"
    else if (res.status === 403) message = "你沒有權限執行這項操作。"
    else if (res.status === 404) message = detail ?? "找不到要求的資料。"
    else if (res.status === 409) message = "資料狀態已變更，請重新整理後再試。"
    else if (res.status === 422) message = "輸入資料格式不正確，請檢查後再試。"
    else if (res.status === 429) message = "操作過於頻繁，請稍後再試。"
    else if (res.status >= 500) message = "服務暫時無法使用，請稍後再試。"
    throw new ApiError(res.status, message)
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
  calories_burned: number | null
  avg_intensity: "light" | "moderate" | "vigorous"
  errors_count: number
  form_score: number
  timestamp: string
}

type DailySummaryWire = {
  date: string
  total_calories: number | null
  total_duration_min: number
  workout_count: number
  calorie_workout_count: number
  total_reps: number
}

type ExerciseSummaryWire = {
  exercise_type: "squat" | "pushup"
  total_reps: number
  total_calories: number | null
  session_count: number
  calorie_session_count: number
  avg_form_score: number
}

type BodyProfileWire = {
  state: BodyProfileState
  height_cm: number | null
  weight_kg: number | null
  bmi: number | null
  updated_at: string | null
}

type BodyMeasurementWire = {
  id: string
  source: string
  source_label: string | null
  measured_at: string
  created_at: string
  updated_at: string
  height_cm: number | null
  weight_kg: number | null
  body_fat_pct: number | null
  skeletal_muscle_mass_kg: number | null
  body_fat_mass_kg: number | null
  total_body_water_kg: number | null
  visceral_fat_level: number | null
  bmi: number | null
  lean_body_mass_kg: number | null
  bmr_kcal_day: number | null
  bmr_is_formula_estimate: boolean
}

type InBodyWire = {
  height_cm: number
  weight_kg: number
  bmi: number
  bmi_category: string
  body_fat_pct: number
  skeletal_muscle_mass_kg: number
  age: number
  gender: "male" | "female"
  body_fat_mass_kg: number
  total_body_water_kg: number | null
  visceral_fat_level: number | null
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
    age: item.age,
    gender: item.gender,
    bodyFatMassKg: item.body_fat_mass_kg,
    totalBodyWaterKg: item.total_body_water_kg ?? undefined,
    visceralFatLevel: item.visceral_fat_level ?? undefined,
    leanBodyMassKg: item.lean_body_mass_kg,
    bmr: item.bmr_kcal_day,
    measuredAt: item.measured_at,
  }
}

function normalizeBodyProfile(item: BodyProfileWire): BodyProfile {
  return {
    state: item.state,
    heightCm: item.height_cm,
    weightKg: item.weight_kg,
    bmi: item.bmi,
    updatedAt: item.updated_at,
  }
}

function normalizeBodyMeasurement(item: BodyMeasurementWire): BodyMeasurement {
  return {
    id: item.id,
    source: item.source,
    sourceLabel: item.source_label,
    measuredAt: item.measured_at,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
    heightCm: item.height_cm,
    weightKg: item.weight_kg,
    bodyFatPct: item.body_fat_pct,
    skeletalMuscleMassKg: item.skeletal_muscle_mass_kg,
    bodyFatMassKg: item.body_fat_mass_kg,
    totalBodyWaterKg: item.total_body_water_kg,
    visceralFatLevel: item.visceral_fat_level,
    bmi: item.bmi,
    leanBodyMassKg: item.lean_body_mass_kg,
    bmrKcalDay: item.bmr_kcal_day,
    bmrIsFormulaEstimate: item.bmr_is_formula_estimate,
  }
}

function measurementWire(payload: BodyMeasurementInput | BodyMeasurementPatch) {
  return {
    source: payload.source,
    source_label: payload.sourceLabel,
    measured_at: payload.measuredAt,
    height_cm: payload.heightCm,
    weight_kg: payload.weightKg,
    body_fat_pct: payload.bodyFatPct,
    skeletal_muscle_mass_kg: payload.skeletalMuscleMassKg,
    body_fat_mass_kg: payload.bodyFatMassKg,
    total_body_water_kg: payload.totalBodyWaterKg,
    visceral_fat_level: payload.visceralFatLevel,
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
        calorieSessions: item.calorie_session_count,
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
      calorieWorkoutCount: item.calorie_workout_count,
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

  async getBodyProfile() {
    return normalizeBodyProfile(
      await request<BodyProfileWire>("/body-profile/me")
    )
  },

  async updateBodyProfile(payload: BasicProfilePatch) {
    const item = await request<BodyProfileWire>("/body-profile/me", {
      method: "PATCH",
      body: JSON.stringify({
        height_cm: payload.heightCm,
        weight_kg: payload.weightKg,
      }),
    })
    return normalizeBodyProfile(item)
  },

  async createBodyMeasurement(payload: BodyMeasurementInput) {
    const item = await request<BodyMeasurementWire>(
      "/body-profile/me/measurements",
      {
        method: "POST",
        body: JSON.stringify(measurementWire(payload)),
      }
    )
    return normalizeBodyMeasurement(item)
  },

  async getBodyMeasurements() {
    return (
      await request<BodyMeasurementWire[]>("/body-profile/me/measurements")
    ).map(normalizeBodyMeasurement)
  },

  async getBodyMeasurement(measurementId: string) {
    return normalizeBodyMeasurement(
      await request<BodyMeasurementWire>(
        `/body-profile/me/measurements/${measurementId}`
      )
    )
  },

  async updateBodyMeasurement(
    measurementId: string,
    payload: BodyMeasurementPatch
  ) {
    const item = await request<BodyMeasurementWire>(
      `/body-profile/me/measurements/${measurementId}`,
      {
        method: "PATCH",
        body: JSON.stringify(measurementWire(payload)),
      }
    )
    return normalizeBodyMeasurement(item)
  },

  // Retained for compatibility with existing consumers during the migration.
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
