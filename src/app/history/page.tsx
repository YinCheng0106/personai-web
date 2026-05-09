import { PageContainer } from "@/components/layout/page-container"
import { MetricCard } from "@/components/ui/metric-card"
import { WorkoutList } from "@/components/history/workout-list"
import { SummaryStats } from "@/components/history/summary-stats"
import { Heatmap } from "@/components/history/heatmap"
import { RequireAuth } from "@/components/auth/require-auth"
import {
  MOCK_EXERCISE_SUMMARY,
  MOCK_HEATMAP,
  MOCK_WORKOUTS,
} from "@/lib/mock-data"

export default function HistoryPage() {
  const totalSessions = MOCK_EXERCISE_SUMMARY.reduce((s, r) => s + r.sessions, 0)
  const totalReps = MOCK_EXERCISE_SUMMARY.reduce((s, r) => s + r.totalReps, 0)
  const totalCalories = MOCK_EXERCISE_SUMMARY.reduce((s, r) => s + r.totalCalories, 0)
  const activeDays = MOCK_HEATMAP.filter((c) => c.intensity > 0).length

  return (
    <PageContainer
      title="訓練紀錄"
      description="檢視過去的訓練成果與長期趨勢。"
    >
      <RequireAuth
        title="登入後檢視訓練紀錄"
        description="訓練歷史屬於個人資料，請先登入或註冊帳號。"
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="累積場次" value={totalSessions} unit="場" />
          <MetricCard label="累積下數" value={totalReps} unit="下" />
          <MetricCard label="累積卡路里" value={totalCalories} unit="kcal" />
          <MetricCard label="活躍天數" value={activeDays} unit="天" />
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <div className="min-w-0 lg:col-span-2">
            <Heatmap cells={MOCK_HEATMAP} />
          </div>
          <SummaryStats summary={MOCK_EXERCISE_SUMMARY} />
        </div>

        <div className="mt-6">
          <WorkoutList records={MOCK_WORKOUTS} />
        </div>
      </RequireAuth>
    </PageContainer>
  )
}
