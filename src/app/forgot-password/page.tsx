"use client"

import { useRef, useState, type FormEvent } from "react"
import Link from "next/link"
import { AuthCard } from "@/components/auth/auth-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { authClient } from "@/lib/auth-client"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const busy = useRef(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy.current) return
    busy.current = true
    setPending(true)
    setError("")
    setMessage("")
    try {
      const result = await authClient.requestPasswordReset({
        email: email.trim(),
        redirectTo: new URL(
          "/reset-password",
          process.env.NEXT_PUBLIC_BETTER_AUTH_URL ?? "http://localhost:3000"
        ).href,
      })
      if (result.error) {
        setError(
          result.error.status === 429
            ? "請求過於頻繁，請稍後再試。"
            : "目前無法寄送，請稍後再試。"
        )
      } else {
        setMessage(
          "若此信箱已註冊，您將收到重設密碼信件。請檢查收件匣與垃圾郵件。"
        )
      }
    } catch {
      setError("目前無法連線，請稍後再試。")
    } finally {
      busy.current = false
      setPending(false)
    }
  }

  return (
    <AuthCard
      title="忘記密碼"
      description="輸入註冊信箱，取得 15 分鐘內有效的重設連結。"
      footer={
        <Link href="/login" className="underline underline-offset-4">
          返回登入頁面
        </Link>
      }
    >
      <form onSubmit={submit} className="space-y-4" aria-busy={pending}>
        <div className="space-y-2">
          <Label htmlFor="reset-email">電子郵件</Label>
          <Input
            id="reset-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={pending}
          />
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="text-sm text-muted-foreground">
            {message}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "處理中…" : "寄送重設信件"}
        </Button>
      </form>
    </AuthCard>
  )
}
