"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ShieldUserIcon,
  Login03Icon,
  UserAdd01Icon,
} from "@hugeicons/core-free-icons"

import { Button } from "@/components/ui/button"
import { useSession } from "@/lib/auth-client"

type Props = {
  children: React.ReactNode
  title?: string
  description?: string
}

export function RequireAuth({
  children,
  title = "此頁面包含個人資料",
  description = "登入或註冊以檢視你的訓練紀錄、身體組成與目標進度。",
}: Props) {
  const session = useSession()
  const pathname = usePathname()

  if (session.isPending) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <div className="h-12 w-12 animate-pulse rounded-full bg-muted" />
      </div>
    )
  }

  if (!session.data) {
    const redirect = encodeURIComponent(pathname)
    return (
      <div className="mx-auto flex min-h-[60vh] w-full max-w-md flex-col items-center justify-center px-4 py-12 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-3xl bg-primary/10 text-primary">
          <HugeiconsIcon icon={ShieldUserIcon} size={26} strokeWidth={1.8} />
        </div>
        <h2 className="mt-5 text-lg font-semibold tracking-tight md:text-xl">{title}</h2>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">{description}</p>
        <div className="mt-6 flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
          <Button asChild size="lg" className="sm:w-auto">
            <Link href={`/login?redirect=${redirect}`}>
              <HugeiconsIcon icon={Login03Icon} size={16} strokeWidth={2} />
              登入
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="sm:w-auto">
            <Link href={`/register?redirect=${redirect}`}>
              <HugeiconsIcon icon={UserAdd01Icon} size={16} strokeWidth={2} />
              註冊新帳號
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
