import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { BodyMeasurement } from "@/types/body-profile"

type Props = {
  measurements: BodyMeasurement[]
}

function sourceLabel(item: BodyMeasurement) {
  return item.sourceLabel ? `${item.source} · ${item.sourceLabel}` : item.source
}

function recordedValues(item: BodyMeasurement) {
  return [
    item.heightCm === null ? null : `身高 ${item.heightCm} cm`,
    item.weightKg === null ? null : `體重 ${item.weightKg} kg`,
    item.bodyFatPct === null ? null : `體脂率 ${item.bodyFatPct}%`,
    item.skeletalMuscleMassKg === null
      ? null
      : `骨骼肌重 ${item.skeletalMuscleMassKg} kg`,
    item.bodyFatMassKg === null ? null : `體脂肪重 ${item.bodyFatMassKg} kg`,
    item.totalBodyWaterKg === null
      ? null
      : `總體水分 ${item.totalBodyWaterKg} kg`,
    item.visceralFatLevel === null
      ? null
      : `內臟脂肪等級 ${item.visceralFatLevel}`,
  ].filter((value): value is string => value !== null)
}

export function MeasurementHistory({ measurements }: Props) {
  const newestFirst = measurements.toSorted(
    (a, b) =>
      new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime()
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>量測歷史</CardTitle>
      </CardHeader>
      <CardContent>
        {newestFirst.length === 0 ? (
          <p className="text-sm text-muted-foreground">尚無身體組成量測。</p>
        ) : (
          <ol className="divide-y divide-border/60">
            {newestFirst.map((item) => (
              <li key={item.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-sm font-medium">
                    {sourceLabel(item)}
                  </span>
                  <time
                    dateTime={item.measuredAt}
                    className="text-xs text-muted-foreground tabular-nums"
                  >
                    {new Date(item.measuredAt).toLocaleDateString("zh-TW")}
                  </time>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {recordedValues(item).join(" · ")}
                </p>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  )
}
