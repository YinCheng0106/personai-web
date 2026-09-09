"use client"

import { useEffect, useState } from "react"

import { RequireAuth } from "@/components/auth/require-auth"
import { BmiChart } from "@/components/inbody/bmi-chart"
import { BodyComposition } from "@/components/inbody/body-composition"
import { CalorieEstimator } from "@/components/inbody/calorie-estimator"
import { InBodyProfileForm } from "@/components/inbody/inbody-profile-form"
import { PageContainer } from "@/components/layout/page-container"
import { Button } from "@/components/ui/button"
import { MetricCard } from "@/components/ui/metric-card"
import { api, ApiError } from "@/lib/api"
import { useSession } from "@/lib/auth-client"
import type {
  BodyComposition as BodyCompositionItem,
  InBody,
  InBodyInput,
} from "@/types/inbody"

export default function InBodyPage() {
  const session = useSession()
  const [profile, setProfile] = useState<InBody | null>(null)
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!session.data) return
    let cancelled = false
    queueMicrotask(() => {
      if (!cancelled) setLoading(true)
    })
    api
      .getInBody()
      .then((value) => {
        if (!cancelled) setProfile(value)
      })
      .catch((cause) => {
        if (cancelled) return
        if (cause instanceof ApiError && cause.status === 404) {
          setEditing(true)
          return
        }
        setError(cause instanceof Error ? cause.message : "身體資料載入失敗。")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [session.data])

  async function save(values: InBodyInput) {
    if (!session.data) return
    setSaving(true)
    setError(null)
    try {
      setProfile(await api.postInBody(values))
      setEditing(false)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "身體資料儲存失敗。")
    } finally {
      setSaving(false)
    }
  }

  const composition: BodyCompositionItem[] = profile
    ? [
        {
          label: "體脂率",
          current: profile.bodyFatPct,
          target: 15,
          unit: "%",
          tone: "warning",
        },
        {
          label: "骨骼肌",
          current: profile.skeletalMuscleKg,
          target: Math.round(profile.skeletalMuscleKg + 2),
          unit: "kg",
          tone: "good",
        },
        {
          label: "瘦體重",
          current: profile.leanBodyMassKg,
          target: Math.round(profile.leanBodyMassKg),
          unit: "kg",
          tone: "neutral",
        },
      ]
    : []

  return (
    <PageContainer
      title="身體組成"
      description="量化身體變化，制定下一階段的訓練與飲食方向。"
      action={
        profile && !editing ? (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            更新資料
          </Button>
        ) : undefined
      }
    >
      <RequireAuth
        title="登入後檢視身體組成"
        description="身體數據屬於個人資料，請先登入或註冊帳號。"
      >
        {loading ? (
          <p className="mb-4 text-sm text-muted-foreground">載入身體資料中…</p>
        ) : null}
        {error ? (
          <p className="mb-4 text-sm text-destructive">{error}</p>
        ) : null}
        {editing || !profile ? (
          <InBodyProfileForm
            saving={saving}
            initial={
              profile
                ? {
                    heightCm: profile.heightCm,
                    weightKg: profile.weightKg,
                    age: profile.age,
                    gender: profile.gender,
                    bodyFatPct: profile.bodyFatPct,
                    skeletalMuscleKg: profile.skeletalMuscleKg,
                    bodyFatMassKg: profile.bodyFatMassKg,
                    totalBodyWaterKg: profile.totalBodyWaterKg,
                    visceralFatLevel: profile.visceralFatLevel,
                  }
                : undefined
            }
            onSubmit={save}
            onCancel={profile ? () => setEditing(false) : undefined}
          />
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="身高" value={profile.heightCm} unit="cm" />
              <MetricCard
                label="體重"
                value={profile.weightKg.toFixed(1)}
                unit="kg"
              />
              <MetricCard
                label="體脂率"
                value={profile.bodyFatPct.toFixed(1)}
                unit="%"
              />
              <MetricCard
                label="基礎代謝"
                value={Math.round(profile.bmr)}
                unit="kcal"
              />
            </div>
            <div className="mt-6 grid gap-4 lg:grid-cols-3">
              <div className="space-y-4 lg:col-span-2">
                <BmiChart bmi={profile.bmi} />
                <BodyComposition items={composition} />
              </div>
              <CalorieEstimator />
            </div>
          </>
        )}
      </RequireAuth>
    </PageContainer>
  )
}
