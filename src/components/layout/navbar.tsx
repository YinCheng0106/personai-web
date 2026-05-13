"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  DashboardSquare01Icon,
  WorkoutWarmUpIcon,
  Calendar03Icon,
  BodyPartLegIcon,
  Login03Icon,
  Logout01Icon,
  UserAdd01Icon,
} from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { authClient, useSession } from "@/lib/auth-client"

type NavItem = {
  href: string
  label: string
  icon: typeof DashboardSquare01Icon
}

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "總覽", icon: DashboardSquare01Icon },
  { href: "/analyze", label: "即時分析", icon: WorkoutWarmUpIcon },
  { href: "/history", label: "訓練紀錄", icon: Calendar03Icon },
  { href: "/inbody", label: "身體組成", icon: BodyPartLegIcon },
]

function getInitials(name: string) {
  const trimmed = name.trim()
  if (!trimmed) return "?"
  const parts = trimmed.split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0]).toUpperCase()
  }
  return trimmed.slice(0, 1).toUpperCase()
}

function UserMenu() {
  const session = useSession()
  const router = useRouter()

  if (session.isPending) {
    return <div className="h-8 w-20 animate-pulse rounded-full bg-muted" />
  }

  if (!session.data) {
    return (
      <div className="flex items-center gap-1.5">
        <Button asChild size="sm" variant="ghost" className="hidden sm:inline-flex">
          <Link href="/login">
            <HugeiconsIcon icon={Login03Icon} size={14} strokeWidth={2} />
            登入
          </Link>
        </Button>
        <Button asChild size="sm">
          <Link href="/register">
            <HugeiconsIcon icon={UserAdd01Icon} size={14} strokeWidth={2} />
            <span className="hidden sm:inline">註冊</span>
            <span className="sm:hidden">登入 / 註冊</span>
          </Link>
        </Button>
      </div>
    )
  }

  const user = session.data.user

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex h-8 items-center gap-2 rounded-full border border-border/60 bg-background pl-1 pr-1 sm:pr-2.5 text-xs font-medium transition-colors hover:bg-muted"
        >
          <span className="grid h-6 w-6 place-items-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
            {getInitials(user.name)}
          </span>
          <span className="hidden max-w-32 truncate sm:inline">{user.name}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="px-3 py-2">
          <p className="truncate text-sm font-medium text-foreground">{user.name}</p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={async (e) => {
            e.preventDefault()
            await authClient.signOut()
            router.replace("/")
          }}
        >
          <HugeiconsIcon icon={Logout01Icon} size={16} strokeWidth={2} />
          登出
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function Navbar() {
  const pathname = usePathname()
  const isAuthRoute = pathname === "/login" || pathname === "/register"

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-6 px-4 md:px-8">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/./logo.png" alt="PersonAI" width={36} height={36} />
          <span className="text-sm font-semibold tracking-tight">PersonAI</span>
        </Link>
        {!isAuthRoute ? (
          <nav className="hidden items-center gap-1 md:flex">
            {NAV_ITEMS.map((item) => {
              const active =
                item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <HugeiconsIcon icon={item.icon} size={16} strokeWidth={2} />
                  {item.label}
                </Link>
              )
            })}
          </nav>
        ) : (
          <div className="hidden md:block" />
        )}
        <div className="flex items-center gap-3">
          <UserMenu />
        </div>
      </div>
      {!isAuthRoute ? (
        <nav className="flex gap-1 overflow-x-auto px-3 pb-2 md:hidden">
          {NAV_ITEMS.map((item) => {
            const active =
              item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium",
                  active
                    ? "bg-foreground text-background"
                    : "bg-muted text-muted-foreground",
                )}
              >
                <HugeiconsIcon icon={item.icon} size={14} strokeWidth={2} />
                {item.label}
              </Link>
            )
          })}
        </nav>
      ) : null}
    </header>
  )
}
