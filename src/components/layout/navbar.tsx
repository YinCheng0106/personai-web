"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  DashboardSquare01Icon,
  WorkoutWarmUpIcon,
  Calendar03Icon,
  BodyPartLegIcon,
} from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"

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

export function Navbar() {
  const pathname = usePathname()
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-6 px-4 md:px-8">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/./logo.png" alt="PersonAI" width={36} height={36} />
          <span className="text-sm font-semibold tracking-tight">PersonAI</span>
        </Link>
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
        <div className="flex items-center gap-3">
          <div className="hidden h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-semibold sm:flex">
            YC
          </div>
        </div>
      </div>
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
    </header>
  )
}
