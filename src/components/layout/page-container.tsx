import * as React from "react"
import { cn } from "@/lib/utils"

type Props = {
  children: React.ReactNode
  className?: string
  title?: string
  description?: string
  action?: React.ReactNode
}

export function PageContainer({ children, className, title, description, action }: Props) {
  return (
    <main className={cn("mx-auto w-full max-w-7xl px-4 py-6 md:px-8 md:py-10", className)}>
      {title || description || action ? (
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4 md:mb-8">
          <div>
            {title ? (
              <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
            ) : null}
            {description ? (
              <p className="mt-1 text-sm text-muted-foreground md:text-base">{description}</p>
            ) : null}
          </div>
          {action}
        </div>
      ) : null}
      {children}
    </main>
  )
}
