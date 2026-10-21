"use client"

import { useEffect, useMemo, useState } from "react"

import { RequireAuth } from "@/components/auth/require-auth"
import { Heatmap } from "@/components/history/heatmap"
import { SummaryStats } from "@/components/history/summary-stats"
import { WorkoutList } from "@/components/history/workout-list"
import { PageContainer } from "@/components/layout/page-container"
import { MetricCard } from "@/components/ui/metric-card"
import { api } from "@/lib/api"
import { useSession } from "@/lib/auth-client"
import { summaryCalorieCoverage } from "@/lib/calorie-coverage"
import type {
  DailySummary,
  ExerciseSummary,
  WorkoutRecord,
} from "@/types/workout"

function intensity(reps: number) {
  if (reps <= 0) return 0
  if (reps <= 10) return 1
  if (reps <= 25) return 2
  if (reps <= 50) return 3
  return 4
}

export default function HistoryPage() {
  const session = useSession()
  const [workouts, setWorkouts] = useState<WorkoutRecord[]>([])
  const [summary, setSummary] = useState<ExerciseSummary[]>([])
  const [daily, setDaily] = useState<DailySummary[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!session.data) return
    let cancelled = false
    queueMicrotask(() => {
      if (!cancelled) {
        setLoading(true)
        setError(null)
      }
    })
    Promise.all([
      api.getWorkouts(),
      api.getWorkoutSummary(),
      api.getDailySummary(),
    ])
      .then(([nextWorkouts, nextSummary, nextDaily]) => {
        if (cancelled) return
        setWorkouts(nextWorkouts)
        setSummary(nextSummary)
        setDaily(nextDaily)
      })
      .catch((cause) => {
        if (!cancelled)
          setError(cause instanceof Error ? cause.message : "資料載入失敗。")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [session.data])

  const heatmap = useMemo(() => {
    const byDate = new Map(daily.map((item) => [item.date, item.totalReps]))
    return Array.from({ length: 84 }, (_, index) => {
      const date = new Date()
      date.setDate(date.getDate() - (83 - index))
      const key = date.toISOString().slice(0, 10)
      return { date: key, intensity: intensity(byDate.get(key) ?? 0) }
    })
  }, [daily])

  const totalSessions = summary.reduce((sum, row) => sum + row.sessions, 0)
  const totalReps = summary.reduce((sum, row) => sum + row.totalReps, 0)
  const calorieCoverage = summaryCalorieCoverage(summary)
  const activeDays = daily.filter((item) => item.totalReps > 0).length

  return (
    <PageContainer
      title="訓練紀錄"
      description="檢視過去的訓練成果與長期趨勢。"
    >
      <RequireAuth
        title="登入後檢視訓練紀錄"
        description="訓練歷史屬於個人資料，請先登入或註冊帳號。"
      >
        {loading ? (
          <p className="mb-4 text-sm text-muted-foreground">載入訓練紀錄中…</p>
        ) : null}
        {error ? (
          <p className="mb-4 text-sm text-destructive">{error}</p>
        ) : null}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="累積場次" value={totalSessions} unit="場" />
          <MetricCard label="累積次數" value={totalReps} unit="下" />
          <MetricCard
            label="累積熱量估算"
            value={
              calorieCoverage.calories === null
                ? "—"
                : Math.round(calorieCoverage.calories)
            }
            unit={calorieCoverage.calories === null ? undefined : "kcal"}
            delta={
              calorieCoverage.calories === null
                ? { value: "部分訓練缺少體重資料", tone: "neutral" }
                : undefined
            }
          />
          <MetricCard label="活躍天數" value={activeDays} unit="天" />
        </div>
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <div className="min-w-0 lg:col-span-2">
            <Heatmap cells={heatmap} />
          </div>
          <SummaryStats summary={summary} />
        </div>
        <div className="mt-6">
          <WorkoutList records={workouts} />
        </div>
      </RequireAuth>
    </PageContainer>
  )
}
