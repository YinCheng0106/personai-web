"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { BasicProfileInput } from "@/types/body-profile"

type Props = {
  initial: BasicProfileInput
  saving: boolean
  onSubmit: (values: BasicProfileInput) => Promise<void>
  onCancel: () => void
}

function initialValue(value: number | null) {
  return value === null ? "" : String(value)
}

function optionalNumber(value: string, label: string, max: number) {
  if (value.trim() === "") return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > max) {
    throw new Error(`${label}必須大於 0 且不超過 ${max}。`)
  }
  return parsed
}

export function BasicProfileForm({
  initial,
  saving,
  onSubmit,
  onCancel,
}: Props) {
  const [height, setHeight] = useState(() => initialValue(initial.heightCm))
  const [weight, setWeight] = useState(() => initialValue(initial.weightKg))
  const [validationError, setValidationError] = useState<string | null>(null)

  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader>
        <CardTitle>基本資料</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault()
            setValidationError(null)
            try {
              void onSubmit({
                heightCm: optionalNumber(height, "身高", 300),
                weightKg: optionalNumber(weight, "體重", 500),
              })
            } catch (cause) {
              setValidationError(
                cause instanceof Error ? cause.message : "請檢查輸入內容。"
              )
            }
          }}
        >
          <p className="text-sm text-muted-foreground">
            身高與體重可分別填寫；留白的欄位會保持未知。
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <OptionalNumberField
              label="身高（cm）"
              value={height}
              max={300}
              onChange={setHeight}
            />
            <OptionalNumberField
              label="體重（kg）"
              value={weight}
              max={500}
              onChange={setWeight}
            />
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
              {saving ? "儲存中…" : "儲存基本資料"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function OptionalNumberField({
  label,
  value,
  max,
  onChange,
}: {
  label: string
  value: string
  max: number
  onChange: (value: string) => void
}) {
  return (
    <label className="space-y-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <input
        type="number"
        min="0.1"
        max={max}
        step="0.1"
        value={value}
        placeholder="未提供"
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-xl border border-border bg-background px-3 tabular-nums"
      />
    </label>
  )
}
