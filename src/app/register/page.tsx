"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  UserIcon,
  Mail01Icon,
  LockPasswordIcon,
  ViewIcon,
  ViewOffSlashIcon,
  Loading03Icon,
  AlertCircleIcon,
  CheckmarkCircle02Icon,
} from "@hugeicons/core-free-icons"

import { AuthCard } from "@/components/auth/auth-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { authClient, useSession } from "@/lib/auth-client"
import { cn } from "@/lib/utils"

function passwordStrength(pw: string) {
  let score = 0
  if (pw.length >= 8) score++
  if (/[A-Z]/.test(pw) || /[一-鿿]/.test(pw)) score++
  if (/[0-9]/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  return score
}

const STRENGTH_LABEL = ["請輸入密碼", "弱", "普通", "良好", "強"]
const STRENGTH_COLOR = [
  "bg-muted",
  "bg-destructive/70",
  "bg-warning/80",
  "bg-info/80",
  "bg-success/80",
]

function RegisterForm() {
  const router = useRouter()
  const search = useSearchParams()
  const session = useSession()
  const redirectTo = search.get("redirect") || "/"

  const [name, setName] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [confirm, setConfirm] = React.useState("")
  const [showPassword, setShowPassword] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const strength = passwordStrength(password)
  const passwordMismatch = confirm.length > 0 && confirm !== password

  React.useEffect(() => {
    if (!session.isPending && session.data) {
      router.replace(redirectTo)
    }
  }, [session.data, session.isPending, redirectTo, router])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    if (passwordMismatch) {
      setError("兩次輸入的密碼不一致。")
      return
    }
    if (password.length < 8) {
      setError("密碼至少需要 8 個字元。")
      return
    }
    setSubmitting(true)
    const result = await authClient.signUp.email({ name, email, password })
    setSubmitting(false)
    if (result.error) {
      setError(result.error.message)
      return
    }
    router.replace(redirectTo)
  }

  return (
    <AuthCard
      title="建立 PersonAI 帳號"
      description="開始追蹤你的訓練進度與身體變化。"
      footer={
        <>
          已經有帳號？{" "}
          <Link
            href={`/login${redirectTo !== "/" ? `?redirect=${encodeURIComponent(redirectTo)}` : ""}`}
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            前往登入
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="space-y-2">
          <Label htmlFor="name">顯示名稱</Label>
          <div className="relative">
            <HugeiconsIcon
              icon={UserIcon}
              size={16}
              strokeWidth={2}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              id="name"
              type="text"
              autoComplete="name"
              required
              placeholder="例如：陳小美"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="pl-9"
              disabled={submitting}
            />
          </div>
        </div>

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
          <Label htmlFor="password">密碼</Label>
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
              autoComplete="new-password"
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
          <div className="flex items-center gap-2">
            <div className="flex h-1 flex-1 gap-1">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className={cn(
                    "h-full flex-1 rounded-full transition-colors",
                    i <= strength ? STRENGTH_COLOR[strength] : "bg-muted",
                  )}
                />
              ))}
            </div>
            <span className="w-12 text-right text-xs text-muted-foreground">
              {STRENGTH_LABEL[strength]}
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirm">再次輸入密碼</Label>
          <div className="relative">
            <HugeiconsIcon
              icon={LockPasswordIcon}
              size={16}
              strokeWidth={2}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              id="confirm"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              placeholder="再次輸入相同密碼"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="pl-9 pr-9"
              disabled={submitting}
              aria-invalid={passwordMismatch || undefined}
            />
            {confirm.length > 0 && !passwordMismatch ? (
              <HugeiconsIcon
                icon={CheckmarkCircle02Icon}
                size={16}
                strokeWidth={2}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-success"
              />
            ) : null}
          </div>
          {passwordMismatch ? (
            <p className="text-xs text-destructive">兩次輸入的密碼不一致。</p>
          ) : null}
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

        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={submitting || passwordMismatch || password.length < 8}
        >
          {submitting ? (
            <HugeiconsIcon
              icon={Loading03Icon}
              size={16}
              strokeWidth={2}
              className="animate-spin"
            />
          ) : null}
          {submitting ? "建立中…" : "建立帳號"}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          建立帳號代表你同意 PersonAI 的服務條款與隱私權政策。
        </p>
      </form>
    </AuthCard>
  )
}

export default function RegisterPage() {
  return (
    <React.Suspense fallback={null}>
      <RegisterForm />
    </React.Suspense>
  )
}
