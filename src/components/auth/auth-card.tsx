import * as React from "react"
import Link from "next/link"
import Image from "next/image"

import { cn } from "@/lib/utils"

type Props = {
  title: string
  description?: string
  footer?: React.ReactNode
  children: React.ReactNode
  className?: string
}

export function AuthCard({ title, description, footer, children, className }: Props) {
  return (
    <main className="mx-auto flex min-h-[calc(100svh-3.5rem)] w-full max-w-md flex-col items-stretch justify-center px-4 py-10 md:py-16">
      <Link
        href="/"
        className="mb-8 flex items-center justify-center gap-2 text-sm font-semibold tracking-tight"
      >
        <Image src="/logo.png" alt="PersonAI" width={36} height={36} />
        <span>PersonAI</span>
      </Link>
      <div
        className={cn(
          "rounded-3xl border border-border/70 bg-card p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.08)] md:p-8",
          className,
        )}
      >
        <div className="mb-6 space-y-1.5">
          <h1 className="text-xl font-semibold tracking-tight md:text-2xl">{title}</h1>
          {description ? (
            <p className="text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {children}
      </div>
      {footer ? (
        <p className="mt-6 text-center text-sm text-muted-foreground">{footer}</p>
      ) : null}
    </main>
  )
}
