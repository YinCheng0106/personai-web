import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Activity04Icon,
  FireIcon,
  TimerIcon,
  WorkoutSquatsIcon,
  PlayIcon,
} from "@hugeicons/core-free-icons"

import { PageContainer } from "@/components/layout/page-container"
import { MetricCard } from "@/components/ui/metric-card"
import { Button } from "@/components/ui/button"
import { WeeklyChart } from "@/components/dashboard/weekly-chart"
import { GoalProgressCard } from "@/components/dashboard/goal-progress"
import { TodayWorkoutList } from "@/components/dashboard/today-workout-list"
import { PostureQuality } from "@/components/dashboard/posture-quality"
import {
  MOCK_DAILY,
  MOCK_GOALS,
  MOCK_WORKOUTS,
} from "@/lib/mock-data"

function isToday(iso: string) {
  const d = new Date(iso)
  const t = new Date()
  return (
    d.getFullYear() === t.getFullYear() &&
    d.getMonth() === t.getMonth() &&
    d.getDate() === t.getDate()
  )
}

export default function DashboardPage() {
  const todayWorkouts = MOCK_WORKOUTS.filter((w) => isToday(w.performedAt))
  const todayCalories = todayWorkouts.reduce((s, w) => s + w.calories, 0)
  const todayReps = todayWorkouts.reduce((s, w) => s + w.reps, 0)
  const todayDuration = todayWorkouts.reduce((s, w) => s + w.durationSec, 0)
  const avgFormScore =
    todayWorkouts.length > 0
      ? Math.round(
          todayWorkouts.reduce((s, w) => s + w.formScore, 0) / todayWorkouts.length,
        )
      : 88

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
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="今日次數"
          value={todayReps}
          unit="下"
          icon={<HugeiconsIcon icon={WorkoutSquatsIcon} size={16} strokeWidth={2} />}
          delta={{ value: "較昨日 +8%", tone: "up" }}
        />
        <MetricCard
          label="今日燃燒"
          value={todayCalories}
          unit="kcal"
          icon={<HugeiconsIcon icon={FireIcon} size={16} strokeWidth={2} />}
          delta={{ value: "目標 600 kcal", tone: "neutral" }}
        />
        <MetricCard
          label="訓練時間"
          value={Math.round(todayDuration / 60)}
          unit="分鐘"
          icon={<HugeiconsIcon icon={TimerIcon} size={16} strokeWidth={2} />}
          delta={{ value: "本週累計 86 分", tone: "neutral" }}
        />
        <MetricCard
          label="姿勢平均"
          value={avgFormScore}
          unit="/ 100"
          icon={<HugeiconsIcon icon={Activity04Icon} size={16} strokeWidth={2} />}
          delta={{ value: "穩定提升中", tone: "up" }}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <WeeklyChart data={MOCK_DAILY} />
        </div>
        <PostureQuality score={avgFormScore} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <TodayWorkoutList records={todayWorkouts} />
        <GoalProgressCard goals={MOCK_GOALS} />
      </div>
    </PageContainer>
  )
}
