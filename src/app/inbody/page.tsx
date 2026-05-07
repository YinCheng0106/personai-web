import { PageContainer } from "@/components/layout/page-container"
import { MetricCard } from "@/components/ui/metric-card"
import { BmiChart } from "@/components/inbody/bmi-chart"
import { BodyComposition } from "@/components/inbody/body-composition"
import { CalorieEstimator } from "@/components/inbody/calorie-estimator"
import { MOCK_BODY_COMPOSITION, MOCK_INBODY } from "@/lib/mock-data"
import { calcBmi } from "@/lib/format"

export default function InBodyPage() {
  const bmi = calcBmi(MOCK_INBODY.weightKg, MOCK_INBODY.heightCm)

  return (
    <PageContainer
      title="身體組成"
      description="量化身體變化，制定下一階段的訓練與飲食方向。"
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="身高" value={MOCK_INBODY.heightCm} unit="cm" />
        <MetricCard label="體重" value={MOCK_INBODY.weightKg.toFixed(1)} unit="kg" />
        <MetricCard
          label="體脂率"
          value={MOCK_INBODY.bodyFatPct.toFixed(1)}
          unit="%"
          delta={{ value: "較上次 -0.4%", tone: "down" }}
        />
        <MetricCard
          label="基礎代謝"
          value={MOCK_INBODY.bmr}
          unit="kcal"
          delta={{ value: "穩定", tone: "neutral" }}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <BmiChart bmi={bmi} />
          <BodyComposition items={MOCK_BODY_COMPOSITION} />
        </div>
        <CalorieEstimator defaultWeightKg={MOCK_INBODY.weightKg} />
      </div>
    </PageContainer>
  )
}
