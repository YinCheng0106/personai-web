import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { HugeiconsIcon } from "@hugeicons/react"
import { AlertCircleIcon, CheckmarkCircle02Icon } from "@hugeicons/core-free-icons"
import { FORM_ERROR_LABEL } from "@/lib/constants"

type Props = {
  errors: string[]
}

export function ErrorList({ errors }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>姿勢提醒</CardTitle>
      </CardHeader>
      <CardContent>
        {errors.length === 0 ? (
          <div className="flex items-center gap-2 rounded-xl bg-success/10 px-3 py-2 text-success">
            <HugeiconsIcon icon={CheckmarkCircle02Icon} size={16} strokeWidth={2} />
            <span className="text-sm font-medium">姿勢標準，繼續保持！</span>
          </div>
        ) : (
          <ul className="space-y-2">
            {errors.map((err) => (
              <li
                key={err}
                className="flex items-start gap-2 rounded-xl bg-warning/10 px-3 py-2 text-warning-foreground"
              >
                <HugeiconsIcon
                  icon={AlertCircleIcon}
                  size={16}
                  strokeWidth={2}
                  className="mt-0.5 shrink-0 text-warning"
                />
                <span className="text-sm font-medium">
                  {FORM_ERROR_LABEL[err] ?? err}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
