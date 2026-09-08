"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import {
  LayoutGrid,
  CalendarDays,
  Dumbbell,
  BicepsFlexed,
  LogIn,
  LogOut,
  Swords,
  UserPlus,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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
  icon: typeof LayoutGrid
}

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "總覽", icon: LayoutGrid },
  { href: "/analyze", label: "即時分析", icon: Dumbbell },
  { href: "/pk", label: "1v1 對戰", icon: Swords },
  { href: "/history", label: "訓練紀錄", icon: CalendarDays },
  { href: "/inbody", label: "身體組成", icon: BicepsFlexed },
]

function getInitials(name: string) {
  const trimmed = name.trim()
  if (!trimmed) return "?"
  const parts = trimmed.split(/\s+/)
  if (parts.length >= 2) {
    return parts[0][0].toUpperCase()
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
        <Button
          asChild
          size="sm"
          variant="ghost"
          className="hidden sm:inline-flex"
        >
          <Link href="/login">
            <LogIn size={14} />
            登入
          </Link>
        </Button>
        <Button asChild size="sm">
          <Link href="/register">
            <UserPlus size={14} />
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
          className="flex h-8 items-center gap-2 rounded-full border border-border/60 bg-background pr-1 pl-1 text-xs font-medium transition-colors hover:bg-muted sm:pr-2.5"
        >
          <Avatar className="size-6">
            <AvatarImage src={user.image ?? undefined} alt={user.name} />
            <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
          </Avatar>
          <span className="hidden max-w-32 truncate sm:inline">
            {user.name}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 rounded-xl">
        <DropdownMenuLabel className="flex items-center gap-2 px-3 py-2">
          <Avatar className="size-6">
            <AvatarImage src={user.image ?? undefined} alt={user.name} />
            <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
          </Avatar>
          <div>
            <p className="truncate text-sm font-medium text-foreground">
              {user.name}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {user.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={async (e) => {
            e.preventDefault()
            await authClient.signOut()
            router.replace("/")
          }}
        >
          <LogOut size={16} />
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
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl select-none">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-6 px-4 md:px-8">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/./logo.png" alt="PersonAI" width={36} height={36} />
          <span className="text-sm font-semibold tracking-tight">PersonAI</span>
        </Link>
        {!isAuthRoute ? (
          <nav className="hidden items-center gap-1 md:flex">
            {NAV_ITEMS.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <item.icon size={16} />
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
        <nav className="flex gap-1 overflow-x-auto px-3 pb-2 [scrollbar-width:none] md:hidden [&::-webkit-scrollbar]:hidden">
          {NAV_ITEMS.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium",
                  active
                    ? "bg-foreground text-background"
                    : "bg-muted text-muted-foreground"
                )}
              >
                <item.icon size={14} />
                {item.label}
              </Link>
            )
          })}
        </nav>
      ) : null}
    </header>
  )
}
