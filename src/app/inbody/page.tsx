"use client"

import { useEffect, useMemo, useState } from "react"

import { RequireAuth } from "@/components/auth/require-auth"
import { BasicProfileForm } from "@/components/inbody/basic-profile-form"
import { BodyMeasurementForm } from "@/components/inbody/body-measurement-form"
import { MeasurementHistory } from "@/components/inbody/measurement-history"
import { PageContainer } from "@/components/layout/page-container"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { api } from "@/lib/api"
import { useSession } from "@/lib/auth-client"
import type {
  BasicProfileInput,
  BodyMeasurement,
  BodyMeasurementInput,
  BodyProfile,
} from "@/types/body-profile"

type Editor = "basic" | "measurement" | null

export default function InBodyPage() {
  const session = useSession()
  const userId = session.data?.user.id
  const [profile, setProfile] = useState<BodyProfile | null>(null)
  const [measurements, setMeasurements] = useState<BodyMeasurement[]>([])
  const [editor, setEditor] = useState<Editor>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    queueMicrotask(() => {
      if (!cancelled) {
        setLoading(true)
        setError(null)
      }
    })
    Promise.all([api.getBodyProfile(), api.getBodyMeasurements()])
      .then(([nextProfile, nextMeasurements]) => {
        if (cancelled) return
        setProfile(nextProfile)
        setMeasurements(nextMeasurements)
      })
      .catch((cause) => {
        if (!cancelled) {
          setError(
            cause instanceof Error ? cause.message : "身體資料載入失敗。"
          )
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [reloadKey, userId])

  async function saveBasic(values: BasicProfileInput) {
    setSaving(true)
    setError(null)
    try {
      setProfile(await api.updateBodyProfile(values))
      setEditor(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "基本資料儲存失敗。")
    } finally {
      setSaving(false)
    }
  }

  async function saveMeasurement(values: BodyMeasurementInput) {
    setSaving(true)
    setError(null)
    try {
      await api.createBodyMeasurement(values)
      const [nextProfile, nextMeasurements] = await Promise.all([
        api.getBodyProfile(),
        api.getBodyMeasurements(),
      ])
      setProfile(nextProfile)
      setMeasurements(nextMeasurements)
      setEditor(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "量測資料儲存失敗。")
    } finally {
      setSaving(false)
    }
  }

  const latestMeasurement = useMemo(
    () =>
      measurements.toSorted(
        (a, b) =>
          new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime()
      )[0] ?? null,
    [measurements]
  )

  return (
    <PageContainer
      title="身體資料"
      description="基本資料與實際身體組成量測可分別提供，未填寫的資料會保持未知。"
    >
      <RequireAuth
        title="登入後檢視身體資料"
        description="身體資料屬於個人資料，請先登入或註冊帳號。"
      >
        {loading ? (
          <BodyProfileLoading />
        ) : error && !profile ? (
          <BodyProfileError
            message={error}
            onRetry={() => setReloadKey((value) => value + 1)}
          />
        ) : profile ? (
          <div className="space-y-5">
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
            {editor === "basic" ? (
              <BasicProfileForm
                key={`${profile.heightCm}-${profile.weightKg}`}
                initial={{
                  heightCm: profile.heightCm,
                  weightKg: profile.weightKg,
                }}
                saving={saving}
                onSubmit={saveBasic}
                onCancel={() => setEditor(null)}
              />
            ) : editor === "measurement" ? (
              <BodyMeasurementForm
                saving={saving}
                onSubmit={saveMeasurement}
                onCancel={() => setEditor(null)}
              />
            ) : profile.state === "unknown" ? (
              <UnknownState
                onAddBasic={() => setEditor("basic")}
                onAddMeasurement={() => setEditor("measurement")}
              />
            ) : (
              <>
                <BasicProfileCard
                  profile={profile}
                  onEdit={() => setEditor("basic")}
                />
                <MeasurementSection
                  latest={latestMeasurement}
                  onAdd={() => setEditor("measurement")}
                />
                <MeasurementHistory measurements={measurements} />
              </>
            )}
          </div>
        ) : null}
      </RequireAuth>
    </PageContainer>
  )
}

function BodyProfileLoading() {
  return (
    <Card aria-busy="true" aria-label="載入身體資料中">
      <CardContent className="space-y-3 p-6">
        <div className="h-5 w-32 animate-pulse rounded bg-muted" />
        <div className="h-4 w-full max-w-lg animate-pulse rounded bg-muted" />
        <p className="text-sm text-muted-foreground">載入身體資料中…</p>
      </CardContent>
    </Card>
  )
}

function BodyProfileError({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>無法載入身體資料</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p role="alert" className="text-sm text-destructive">
          {message}
        </p>
        <Button variant="outline" onClick={onRetry}>
          重新載入
        </Button>
      </CardContent>
    </Card>
  )
}

function UnknownState({
  onAddBasic,
  onAddMeasurement,
}: {
  onAddBasic: () => void
  onAddMeasurement: () => void
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>尚未提供身體資料</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          即使沒有 InBody
          或身體組成量測，你仍然可以使用姿勢分析、動作計次、訓練紀錄與 PK。
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={onAddBasic}>新增基本資料</Button>
          <Button variant="outline" onClick={onAddMeasurement}>
            新增身體組成量測
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function BasicProfileCard({
  profile,
  onEdit,
}: {
  profile: BodyProfile
  onEdit: () => void
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>基本資料</CardTitle>
          <Button size="sm" variant="outline" onClick={onEdit}>
            編輯
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-4 sm:grid-cols-2">
          <DataValue label="身高" value={profile.heightCm} unit="cm" />
          <DataValue label="體重" value={profile.weightKg} unit="kg" />
        </dl>
        {profile.bmi !== null ? (
          <div className="mt-5 border-t border-border/60 pt-4">
            <p className="text-xs font-medium text-muted-foreground">
              公式估算
            </p>
            <dl>
              <DataValue label="BMI" value={profile.bmi} unit="kg/m²" />
            </dl>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

function MeasurementSection({
  latest,
  onAdd,
}: {
  latest: BodyMeasurement | null
  onAdd: () => void
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>身體組成量測</CardTitle>
          <Button size="sm" onClick={onAdd}>
            新增量測
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {latest ? (
          <MeasurementDetails measurement={latest} />
        ) : (
          <p className="text-sm text-muted-foreground">尚無專業量測。</p>
        )}
      </CardContent>
    </Card>
  )
}

function MeasurementDetails({ measurement }: { measurement: BodyMeasurement }) {
  const measured = [
    ["量測身高", measurement.heightCm, "cm"],
    ["量測體重", measurement.weightKg, "kg"],
    ["體脂率", measurement.bodyFatPct, "%"],
    ["骨骼肌重", measurement.skeletalMuscleMassKg, "kg"],
    ["體脂肪重", measurement.bodyFatMassKg, "kg"],
    ["總體水分", measurement.totalBodyWaterKg, "kg"],
    ["內臟脂肪等級", measurement.visceralFatLevel, ""],
  ] as const
  const derived = [
    ["BMI", measurement.bmi, "kg/m²"],
    ["瘦體重", measurement.leanBodyMassKg, "kg"],
    ["基礎代謝率", measurement.bmrKcalDay, "kcal／日"],
  ] as const
  const availableMeasured = measured.filter(([, value]) => value !== null)
  const availableDerived = derived.filter(([, value]) => value !== null)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <p>
          <span className="text-muted-foreground">來源：</span>
          {measurement.sourceLabel
            ? `${measurement.source} · ${measurement.sourceLabel}`
            : measurement.source}
        </p>
        <p>
          <span className="text-muted-foreground">量測日期：</span>
          <time dateTime={measurement.measuredAt}>
            {new Date(measurement.measuredAt).toLocaleDateString("zh-TW")}
          </time>
        </p>
      </div>
      <div>
        <h3 className="mb-3 text-sm font-semibold">量測值</h3>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {availableMeasured.map(([label, value, unit]) => (
            <DataValue key={label} label={label} value={value} unit={unit} />
          ))}
        </dl>
      </div>
      {availableDerived.length > 0 ? (
        <div className="border-t border-border/60 pt-4">
          <h3 className="mb-3 text-sm font-semibold">依量測資料計算</h3>
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {availableDerived.map(([label, value, unit]) => (
              <DataValue key={label} label={label} value={value} unit={unit} />
            ))}
          </dl>
        </div>
      ) : null}
    </div>
  )
}

function DataValue({
  label,
  value,
  unit,
}: {
  label: string
  value: number | null
  unit: string
}) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-lg font-semibold tabular-nums">
        {value === null ? "未提供" : value}
        {value !== null && unit ? (
          <span className="ml-1 text-xs font-normal text-muted-foreground">
            {unit}
          </span>
        ) : null}
      </dd>
    </div>
  )
}
