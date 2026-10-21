"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { BodyMeasurementInput } from "@/types/body-profile"

type NumericKey =
  | "heightCm"
  | "weightKg"
  | "bodyFatPct"
  | "skeletalMuscleMassKg"
  | "bodyFatMassKg"
  | "totalBodyWaterKg"
  | "visceralFatLevel"

type NumericValues = Record<NumericKey, string>

const EMPTY_VALUES: NumericValues = {
  heightCm: "",
  weightKg: "",
  bodyFatPct: "",
  skeletalMuscleMassKg: "",
  bodyFatMassKg: "",
  totalBodyWaterKg: "",
  visceralFatLevel: "",
}

const FIELDS: Array<{
  key: NumericKey
  label: string
  max: number
  min?: number
  step: string
  composition?: boolean
}> = [
  { key: "heightCm", label: "量測身高（cm）", max: 300, step: "0.1" },
  { key: "weightKg", label: "量測體重（kg）", max: 500, step: "0.1" },
  {
    key: "bodyFatPct",
    label: "體脂率（%）",
    max: 80,
    min: 0,
    step: "0.1",
    composition: true,
  },
  {
    key: "skeletalMuscleMassKg",
    label: "骨骼肌重（kg）",
    max: 200,
    min: 0,
    step: "0.1",
    composition: true,
  },
  {
    key: "bodyFatMassKg",
    label: "體脂肪重（kg）",
    max: 300,
    min: 0,
    step: "0.1",
    composition: true,
  },
  {
    key: "totalBodyWaterKg",
    label: "總體水分（kg）",
    max: 200,
    min: 0,
    step: "0.1",
    composition: true,
  },
  {
    key: "visceralFatLevel",
    label: "內臟脂肪等級",
    max: 20,
    min: 1,
    step: "1",
    composition: true,
  },
]

type Props = {
  saving: boolean
  onSubmit: (values: BodyMeasurementInput) => Promise<void>
  onCancel: () => void
}

function optionalNumber(value: string, field: (typeof FIELDS)[number]) {
  if (value.trim() === "") return null
  const parsed = Number(value)
  const min = field.min ?? Number.MIN_VALUE
  if (!Number.isFinite(parsed) || parsed < min || parsed > field.max) {
    throw new Error(
      `${field.label}必須介於 ${field.min ?? "大於 0"} 到 ${field.max}。`
    )
  }
  return parsed
}

export function BodyMeasurementForm({ saving, onSubmit, onCancel }: Props) {
  const [source, setSource] = useState("")
  const [sourceLabel, setSourceLabel] = useState("")
  const [measuredDate, setMeasuredDate] = useState("")
  const [values, setValues] = useState<NumericValues>(EMPTY_VALUES)
  const [validationError, setValidationError] = useState<string | null>(null)

  return (
    <Card className="mx-auto max-w-3xl">
      <CardHeader>
        <CardTitle>新增身體組成量測</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault()
            setValidationError(null)
            try {
              const parsed = Object.fromEntries(
                FIELDS.map((field) => [
                  field.key,
                  optionalNumber(values[field.key], field),
                ])
              ) as Pick<BodyMeasurementInput, NumericKey>
              const hasComposition = FIELDS.some(
                (field) => field.composition && parsed[field.key] !== null
              )
              if (!source.trim()) throw new Error("請填寫量測來源。")
              if (!measuredDate) throw new Error("請選擇量測日期。")
              if (!hasComposition) {
                throw new Error("請至少填寫一項實際身體組成量測值。")
              }
              if (parsed.weightKg !== null) {
                for (const key of [
                  "skeletalMuscleMassKg",
                  "bodyFatMassKg",
                  "totalBodyWaterKg",
                ] as const) {
                  if (parsed[key] !== null && parsed[key] > parsed.weightKg) {
                    throw new Error("身體組成重量不可高於量測體重。")
                  }
                }
              }
              void onSubmit({
                source: source.trim(),
                sourceLabel: sourceLabel.trim() || null,
                measuredAt: new Date(`${measuredDate}T00:00:00`).toISOString(),
                ...parsed,
              })
            } catch (cause) {
              setValidationError(
                cause instanceof Error ? cause.message : "請檢查輸入內容。"
              )
            }
          }}
        >
          <p className="text-sm text-muted-foreground">
            請依實際量測報告填入；未提供的欄位會保持未知。
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5 text-sm">
              <span className="text-muted-foreground">量測來源</span>
              <input
                required
                maxLength={64}
                value={source}
                placeholder="例如 InBody"
                onChange={(event) => setSource(event.target.value)}
                className="h-10 w-full rounded-xl border border-border bg-background px-3"
              />
            </label>
            <label className="space-y-1.5 text-sm">
              <span className="text-muted-foreground">來源補充（選填）</span>
              <input
                maxLength={128}
                value={sourceLabel}
                placeholder="例如健身房或裝置名稱"
                onChange={(event) => setSourceLabel(event.target.value)}
                className="h-10 w-full rounded-xl border border-border bg-background px-3"
              />
            </label>
            <label className="space-y-1.5 text-sm">
              <span className="text-muted-foreground">量測日期</span>
              <input
                required
                type="date"
                value={measuredDate}
                onChange={(event) => setMeasuredDate(event.target.value)}
                className="h-10 w-full rounded-xl border border-border bg-background px-3"
              />
            </label>
            {FIELDS.map((field) => (
              <label key={field.key} className="space-y-1.5 text-sm">
                <span className="text-muted-foreground">{field.label}</span>
                <input
                  type="number"
                  min={field.min ?? "0.1"}
                  max={field.max}
                  step={field.step}
                  value={values[field.key]}
                  placeholder="未提供"
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      [field.key]: event.target.value,
                    }))
                  }
                  className="h-10 w-full rounded-xl border border-border bg-background px-3 tabular-nums"
                />
              </label>
            ))}
          </div>
          {validationError ? (
            <p role="alert" className="text-sm text-destructive">
              {validationError}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={onCancel}
            >
              取消
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "儲存中…" : "儲存量測"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
