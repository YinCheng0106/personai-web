"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { InBodyInput } from "@/types/inbody"

const DEFAULT_VALUES: InBodyInput = {
  heightCm: 170,
  weightKg: 65,
  age: 22,
  gender: "male",
  bodyFatPct: 20,
  skeletalMuscleKg: 30,
  bodyFatMassKg: 13,
}

type Props = {
  initial?: Partial<InBodyInput>
  saving: boolean
  onSubmit: (values: InBodyInput) => Promise<void>
  onCancel?: () => void
}

export function InBodyProfileForm({
  initial,
  saving,
  onSubmit,
  onCancel,
}: Props) {
  const [values, setValues] = useState<InBodyInput>({
    ...DEFAULT_VALUES,
    ...initial,
  })

  function numberField(key: keyof InBodyInput, value: number) {
    setValues((current) => ({ ...current, [key]: value }))
  }

  return (
    <Card className="mx-auto max-w-3xl">
      <CardHeader>
        <CardTitle>建立身體組成資料</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault()
            void onSubmit(values)
          }}
        >
          <NumberField
            label="身高（cm）"
            value={values.heightCm}
            min={50}
            max={250}
            step={0.1}
            onChange={(value) => numberField("heightCm", value)}
          />
          <NumberField
            label="體重（kg）"
            value={values.weightKg}
            min={20}
            max={300}
            step={0.1}
            onChange={(value) => numberField("weightKg", value)}
          />
          <NumberField
            label="年齡"
            value={values.age}
            min={10}
            max={120}
            step={1}
            onChange={(value) => numberField("age", value)}
          />
          <label className="space-y-1.5 text-sm">
            <span className="text-muted-foreground">生理性別</span>
            <select
              value={values.gender}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  gender: event.target.value as "male" | "female",
                }))
              }
              className="h-10 w-full rounded-xl border border-border bg-background px-3"
            >
              <option value="male">男性</option>
              <option value="female">女性</option>
            </select>
          </label>
          <NumberField
            label="體脂率（%）"
            value={values.bodyFatPct}
            min={0}
            max={80}
            step={0.1}
            onChange={(value) => numberField("bodyFatPct", value)}
          />
          <NumberField
            label="骨骼肌重（kg）"
            value={values.skeletalMuscleKg}
            min={0}
            max={200}
            step={0.1}
            onChange={(value) => numberField("skeletalMuscleKg", value)}
          />
          <NumberField
            label="體脂肪重（kg）"
            value={values.bodyFatMassKg}
            min={0}
            max={300}
            step={0.1}
            onChange={(value) => numberField("bodyFatMassKg", value)}
          />
          <div className="flex items-end justify-end gap-2 sm:col-span-2">
            {onCancel ? (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={saving}
              >
                取消
              </Button>
            ) : null}
            <Button type="submit" disabled={saving}>
              {saving ? "儲存中…" : "儲存身體資料"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function NumberField({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
}) {
  return (
    <label className="space-y-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <input
        required
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-10 w-full rounded-xl border border-border bg-background px-3 tabular-nums"
      />
    </label>
  )
}
