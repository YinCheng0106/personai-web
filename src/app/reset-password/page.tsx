"use client"

import { Suspense, useEffect, useRef, useState, type FormEvent } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { AuthCard } from "@/components/auth/auth-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { authClient } from "@/lib/auth-client"

function ResetForm() {
  const search = useSearchParams()
  const [token] = useState(() => search.get("token"))
  const [valid] = useState(
    () => !!token && /^[A-Za-z0-9]{24}$/.test(token) && !search.get("error")
  )
  const [password, setPassword] = useState("")
  const [confirmation, setConfirmation] = useState("")
  const [pending, setPending] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState("")
  const busy = useRef(false)

  useEffect(() => {
    // Retain the token only in component memory after the initial navigation.
    window.history.replaceState(window.history.state, "", "/reset-password")
  }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy.current || done || !valid || !token) return
    setError("")
    if (password.length < 8 || password.length > 128) {
      setError("密碼需為 8 至 128 個字元。")
      return
    }
    if (password !== confirmation) {
      setError("兩次輸入的密碼不一致。")
      return
    }
    busy.current = true
    setPending(true)
    try {
      const result = await authClient.resetPassword({
        token,
        newPassword: password,
      })
      if (result.error) {
        setError("重設連結無效、已過期或已使用，請重新申請。")
      } else {
        setPassword("")
        setConfirmation("")
        setDone(true)
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
      title="設定新密碼"
      description="請設定 8 至 128 個字元的密碼。"
      footer={
        <Link href="/login" className="underline underline-offset-4">
          返回登入頁面
        </Link>
      }
    >
      {done ? (
        <p role="status">密碼已重設，請使用新密碼重新登入。</p>
      ) : !valid ? (
        <p role="alert" className="text-sm text-destructive">
          重設連結無效或已失效，請重新申請。
        </p>
      ) : (
        <form onSubmit={submit} className="space-y-4" aria-busy={pending}>
          <div className="space-y-2">
            <Label htmlFor="new-password">新密碼</Label>
            <Input
              id="new-password"
              name="new-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={128}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={pending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">確認新密碼</Label>
            <Input
              id="confirm-password"
              name="confirm-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={128}
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              disabled={pending}
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "更新中…" : "確認更新密碼"}
          </Button>
        </form>
      )}
      {!done && (
        <Link
          href="/forgot-password"
          className="mt-4 block text-sm underline underline-offset-4"
        >
          重新申請重設連結
        </Link>
      )}
    </AuthCard>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <p role="status" className="p-8 text-center">
          載入中…
        </p>
      }
    >
      <ResetForm />
    </Suspense>
  )
}
