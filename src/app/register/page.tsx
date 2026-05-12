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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validateName(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return "請輸入顯示名稱。"
  if (trimmed.length < 2) return "顯示名稱至少需要 2 個字元。"
  if (trimmed.length > 50) return "顯示名稱不可超過 50 個字元。"
  return null
}

function validateEmail(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return "請輸入 Email。"
  if (!EMAIL_RE.test(trimmed)) return "Email 格式不正確，請確認後重新輸入。"
  return null
}

function validatePassword(value: string): string | null {
  if (!value) return "請輸入密碼。"
  if (value.length < 8) return "密碼至少需要 8 個字元。"
  if (!/[A-Za-z]/.test(value)) return "密碼需包含至少一個英文字母。"
  if (!/[0-9]/.test(value)) return "密碼需包含至少一個數字。"
  return null
}

function validateConfirm(password: string, confirm: string): string | null {
  if (!confirm) return "請再次輸入密碼。"
  if (confirm !== password) return "兩次輸入的密碼不一致。"
  return null
}

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

type FieldName = "name" | "email" | "password" | "confirm"

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
  const [touched, setTouched] = React.useState<Record<FieldName, boolean>>({
    name: false,
    email: false,
    password: false,
    confirm: false,
  })

  const errors: Record<FieldName, string | null> = {
    name: validateName(name),
    email: validateEmail(email),
    password: validatePassword(password),
    confirm: validateConfirm(password, confirm),
  }
  const hasAnyError = Object.values(errors).some((e) => e !== null)
  const strength = passwordStrength(password)

  React.useEffect(() => {
    if (!session.isPending && session.data) {
      router.replace(redirectTo)
    }
  }, [session.data, session.isPending, redirectTo, router])

  function markTouched(field: FieldName) {
    setTouched((prev) => (prev[field] ? prev : { ...prev, [field]: true }))
  }

  function shownError(field: FieldName): string | null {
    return touched[field] ? errors[field] : null
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setTouched({ name: true, email: true, password: true, confirm: true })
    if (hasAnyError) return
    setSubmitting(true)
    const result = await authClient.signUp.email({
      name: name.trim(),
      email: email.trim(),
      password,
    })
    setSubmitting(false)
    if (result.error) {
      setError(result.error.message)
      return
    }
    router.replace(redirectTo)
  }

  const nameError = shownError("name")
  const emailError = shownError("email")
  const passwordError = shownError("password")
  const confirmError = shownError("confirm")
  const confirmValid = confirm.length > 0 && !errors.confirm

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
              placeholder="例如：王小明"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => markTouched("name")}
              className="pl-9"
              disabled={submitting}
              aria-invalid={nameError ? true : undefined}
              aria-describedby={nameError ? "name-error" : undefined}
            />
          </div>
          {nameError ? (
            <p id="name-error" className="text-xs text-destructive">
              {nameError}
            </p>
          ) : null}
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
              onBlur={() => markTouched("email")}
              className="pl-9"
              disabled={submitting}
              aria-invalid={emailError ? true : undefined}
              aria-describedby={emailError ? "email-error" : undefined}
            />
          </div>
          {emailError ? (
            <p id="email-error" className="text-xs text-destructive">
              {emailError}
            </p>
          ) : null}
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
              placeholder="至少 8 個字元，含英數字"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={() => markTouched("password")}
              className="pl-9 pr-10"
              disabled={submitting}
              aria-invalid={passwordError ? true : undefined}
              aria-describedby={
                passwordError ? "password-error" : "password-hint"
              }
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
          {passwordError ? (
            <p id="password-error" className="text-xs text-destructive">
              {passwordError}
            </p>
          ) : (
            <p id="password-hint" className="text-xs text-muted-foreground">
              密碼至少 8 個字元，且需包含英文字母與數字。
            </p>
          )}
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
              onBlur={() => markTouched("confirm")}
              className="pl-9 pr-9"
              disabled={submitting}
              aria-invalid={confirmError ? true : undefined}
              aria-describedby={confirmError ? "confirm-error" : undefined}
            />
            {confirmValid ? (
              <HugeiconsIcon
                icon={CheckmarkCircle02Icon}
                size={16}
                strokeWidth={2}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-success"
              />
            ) : null}
          </div>
          {confirmError ? (
            <p id="confirm-error" className="text-xs text-destructive">
              {confirmError}
            </p>
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
          disabled={submitting}
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
