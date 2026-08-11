"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Activity04Icon,
  FireIcon,
  PlayIcon,
  TimerIcon,
  WorkoutSquatsIcon,
} from "@hugeicons/core-free-icons"

import { RequireAuth } from "@/components/auth/require-auth"
import { GoalProgressCard } from "@/components/dashboard/goal-progress"
import { PostureQuality } from "@/components/dashboard/posture-quality"
import { TodayWorkoutList } from "@/components/dashboard/today-workout-list"
import { WeeklyChart } from "@/components/dashboard/weekly-chart"
import { PageContainer } from "@/components/layout/page-container"
import { Button } from "@/components/ui/button"
import { MetricCard } from "@/components/ui/metric-card"
import { api } from "@/lib/api"
import { useSession } from "@/lib/auth-client"
import type { DailySummary, GoalProgress, WorkoutRecord } from "@/types/workout"

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10)
}

function isToday(iso: string) {
  return dateKey(new Date(iso)) === dateKey(new Date())
}

export default function DashboardPage() {
  const session = useSession()
  const [workouts, setWorkouts] = useState<WorkoutRecord[]>([])
  const [daily, setDaily] = useState<DailySummary[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!session.data) return
    let cancelled = false
    queueMicrotask(() => {
      if (!cancelled) setLoading(true)
    })
    Promise.all([api.getWorkouts(), api.getDailySummary()])
      .then(([nextWorkouts, nextDaily]) => {
        if (!cancelled) {
          setWorkouts(nextWorkouts)
          setDaily(nextDaily)
          setError(null)
        }
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

  const weekly = useMemo(() => {
    const byDate = new Map(daily.map((item) => [item.date, item]))
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date()
      date.setDate(date.getDate() - (6 - index))
      const key = dateKey(date)
      return (
        byDate.get(key) ?? {
          date: key,
          totalReps: 0,
          totalCalories: 0,
          durationMin: 0,
          workoutCount: 0,
        }
      )
    })
  }, [daily])

  const todayWorkouts = workouts.filter((item) => isToday(item.performedAt))
  const todayCalories = todayWorkouts.reduce(
    (sum, item) => sum + item.calories,
    0
  )
  const todayReps = todayWorkouts.reduce((sum, item) => sum + item.reps, 0)
  const todayDuration = todayWorkouts.reduce(
    (sum, item) => sum + item.durationSec,
    0
  )
  const avgFormScore = workouts.length
    ? Math.round(
        workouts.reduce((sum, item) => sum + item.formScore, 0) /
          workouts.length
      )
    : 0
  const weeklyTotals = weekly.reduce(
    (totals, item) => ({
      reps: totals.reps + item.totalReps,
      duration: totals.duration + item.durationMin,
      calories: totals.calories + item.totalCalories,
    }),
    { reps: 0, duration: 0, calories: 0 }
  )
  const goals: GoalProgress[] = [
    {
      label: "本週訓練次數",
      current: weeklyTotals.reps,
      target: 200,
      unit: "下",
    },
    {
      label: "本週訓練時間",
      current: Math.round(weeklyTotals.duration),
      target: 150,
      unit: "分",
    },
    {
      label: "本週燃燒卡路里",
      current: Math.round(weeklyTotals.calories),
      target: 1200,
      unit: "kcal",
    },
  ]

  return (
    <PageContainer
      title="嗨，今天也來訓練吧"
      description="掌握每日進度、即時調整訓練計畫。"
      action={
        <Button asChild size="sm">
          <Link href="/analyze">
            <HugeiconsIcon icon={PlayIcon} size={14} strokeWidth={2} />
            開始訓練
          </Link>
        </Button>
      }
    >
      <RequireAuth
        title="登入後檢視今日訓練"
        description="今日進度、目標與訓練紀錄屬於個人資料，請先登入或註冊帳號。"
      >
        {loading ? (
          <p className="mb-4 text-sm text-muted-foreground">載入訓練資料中…</p>
        ) : null}
        {error ? (
          <p className="mb-4 text-sm text-destructive">{error}</p>
        ) : null}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="今日次數"
            value={todayReps}
            unit="下"
            icon={
              <HugeiconsIcon
                icon={WorkoutSquatsIcon}
                size={16}
                strokeWidth={2}
              />
            }
          />
          <MetricCard
            label="今日燃燒"
            value={Math.round(todayCalories)}
            unit="kcal"
            icon={<HugeiconsIcon icon={FireIcon} size={16} strokeWidth={2} />}
          />
          <MetricCard
            label="訓練時間"
            value={Math.round(todayDuration / 60)}
            unit="分鐘"
            icon={<HugeiconsIcon icon={TimerIcon} size={16} strokeWidth={2} />}
          />
          <MetricCard
            label="姿勢平均"
            value={avgFormScore}
            unit="/ 100"
            icon={
              <HugeiconsIcon icon={Activity04Icon} size={16} strokeWidth={2} />
            }
          />
        </div>
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <WeeklyChart data={weekly} />
          </div>
          <PostureQuality score={avgFormScore} />
        </div>
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <TodayWorkoutList records={todayWorkouts} />
          <GoalProgressCard goals={goals} />
        </div>
      </RequireAuth>
    </PageContainer>
  )
}
