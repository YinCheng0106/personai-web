"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Mail01Icon,
  LockPasswordIcon,
  ViewIcon,
  ViewOffSlashIcon,
  Loading03Icon,
  AlertCircleIcon,
} from "@hugeicons/core-free-icons"

import { AuthCard } from "@/components/auth/auth-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { authClient, useSession } from "@/lib/auth-client"

function LoginForm() {
  const router = useRouter()
  const search = useSearchParams()
  const session = useSession()
  const redirectTo = search.get("redirect") || "/"

  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [showPassword, setShowPassword] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!session.isPending && session.data) {
      router.replace(redirectTo)
    }
  }, [session.data, session.isPending, redirectTo, router])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    const result = await authClient.signIn.email({ email, password })
    setSubmitting(false)
    if (result.error) {
      setError(result.error.message)
      return
    }
    router.replace(redirectTo)
  }

  function fillDemo() {
    setEmail("demo@personai.app")
    setPassword("demo1234")
    setError(null)
  }

  return (
    <AuthCard
      title="登入 PersonAI"
      description="繼續使用 AI 健身教練，掌握你的訓練進度。"
      footer={
        <>
          還沒有帳號？{" "}
          <Link
            href={`/register${redirectTo !== "/" ? `?redirect=${encodeURIComponent(redirectTo)}` : ""}`}
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            立即註冊
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <HugeiconsIcon
              icon={Mail01Icon}
              size={16}
              strokeWidth={2}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-9"
              disabled={submitting}
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">密碼</Label>
            <button
              type="button"
              className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              onClick={() => setError("此功能尚未啟用，請聯絡管理員或重新註冊。")}
            >
              忘記密碼？
            </button>
          </div>
          <div className="relative">
            <HugeiconsIcon
              icon={LockPasswordIcon}
              size={16}
              strokeWidth={2}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              minLength={8}
              placeholder="至少 8 個字元"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-9 pr-10"
              disabled={submitting}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-2 top-1/2 grid -translate-y-1/2 place-items-center rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label={showPassword ? "隱藏密碼" : "顯示密碼"}
              tabIndex={-1}
            >
              <HugeiconsIcon
                icon={showPassword ? ViewOffSlashIcon : ViewIcon}
                size={16}
                strokeWidth={2}
              />
            </button>
          </div>
        </div>

        {error ? (
          <div className="flex items-start gap-2 rounded-2xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <HugeiconsIcon
              icon={AlertCircleIcon}
              size={16}
              strokeWidth={2}
              className="mt-0.5 shrink-0"
            />
            <span>{error}</span>
          </div>
        ) : null}

        <Button type="submit" size="lg" className="w-full" disabled={submitting}>
          {submitting ? (
            <HugeiconsIcon
              icon={Loading03Icon}
              size={16}
              strokeWidth={2}
              className="animate-spin"
            />
          ) : null}
          {submitting ? "登入中…" : "登入"}
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full"
          onClick={fillDemo}
          disabled={submitting}
        >
          填入示範帳號（demo@personai.app）
        </Button>
      </form>
    </AuthCard>
  )
}

export default function LoginPage() {
  return (
    <React.Suspense fallback={null}>
      <LoginForm />
    </React.Suspense>
  )
}
