import type { WorkoutRecord, DailySummary, ExerciseSummary } from "@/types/workout"
import type { InBody } from "@/types/inbody"

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000"

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) {
    throw new Error(`API ${path} failed: ${res.status}`)
  }
  return (await res.json()) as T
}

export const api = {
  serverHealth: () => request<{ status: string }>("/server"),
  getWorkouts: (userId: string) => request<WorkoutRecord[]>(`/wk/${userId}`),
  getWorkoutSummary: (userId: string) => request<ExerciseSummary[]>(`/wk/${userId}/summary`),
  getDailySummary: (userId: string) => request<DailySummary[]>(`/wk/${userId}/daily`),
  postWorkoutRecord: (userId: string, payload: Omit<WorkoutRecord, "id" | "performedAt">) =>
    request<WorkoutRecord>(`/wk/${userId}/record`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  getInBody: (userId: string) => request<InBody[]>(`/inbody/${userId}`),
  postInBody: (userId: string, payload: Omit<InBody, "measuredAt">) =>
    request<InBody>(`/inbody/${userId}`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  estimateCalories: (
    userId: string,
    payload: { exercise: string; reps: number; durationSec: number },
  ) =>
    request<{ calories: number }>(`/inbody/${userId}/calories`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
}
