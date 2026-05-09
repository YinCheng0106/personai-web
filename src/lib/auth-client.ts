"use client"

import * as React from "react"

import type { User } from "@/types/user"

/**
 * 此檔案模擬 better-auth 的 React client API（signIn / signUp / signOut /
 * useSession），讓 UI 層可以照著最終的 better-auth 介面寫，未來要切換到實
 * 際後端（better-auth + Postgres / Supabase）只需要把這個檔案換成
 * `createAuthClient` 產出的 client 即可，UI 程式碼不必改動。
 *
 * 切換指引（範例）：
 *   import { createAuthClient } from "better-auth/react"
 *   export const authClient = createAuthClient({
 *     baseURL: process.env.NEXT_PUBLIC_AUTH_BASE_URL,
 *   })
 *   export const { signIn, signUp, signOut, useSession } = authClient
 *
 * 連接 Supabase 時，把 better-auth 的 database adapter 換成 Supabase 的
 * Postgres connection string 即可，client 端程式碼維持不變。
 */

type AuthErrorCode =
  | "invalid_credentials"
  | "email_already_exists"
  | "weak_password"
  | "user_not_found"
  | "unknown"

export type AuthError = {
  code: AuthErrorCode
  message: string
}

export type Session = {
  user: User
  token: string
  expiresAt: string
}

type AuthResult<T> =
  | { data: T; error: null }
  | { data: null; error: AuthError }

const STORAGE_KEY = "personai.auth.session"
const ACCOUNTS_KEY = "personai.auth.accounts"

type StoredAccount = {
  id: string
  email: string
  name: string
  passwordHash: string
}

const SEED_ACCOUNTS: StoredAccount[] = [
  {
    id: "user_demo_yc",
    email: "demo@personai.app",
    name: "示範使用者",
    passwordHash: hashPassword("demo1234"),
  },
]

function isBrowser() {
  return typeof window !== "undefined"
}

function hashPassword(pw: string) {
  // 僅供 mock 用，實際後端改接 better-auth 後由伺服器以 argon2 雜湊。
  let h = 0
  for (let i = 0; i < pw.length; i++) {
    h = (h << 5) - h + pw.charCodeAt(i)
    h |= 0
  }
  return `mock$${h}`
}

function readAccounts(): StoredAccount[] {
  if (!isBrowser()) return SEED_ACCOUNTS
  try {
    const raw = window.localStorage.getItem(ACCOUNTS_KEY)
    if (!raw) {
      window.localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(SEED_ACCOUNTS))
      return SEED_ACCOUNTS
    }
    return JSON.parse(raw) as StoredAccount[]
  } catch {
    return SEED_ACCOUNTS
  }
}

function writeAccounts(accounts: StoredAccount[]) {
  if (!isBrowser()) return
  window.localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts))
}

function readSession(): Session | null {
  if (!isBrowser()) return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const session = JSON.parse(raw) as Session
    if (new Date(session.expiresAt).getTime() < Date.now()) {
      window.localStorage.removeItem(STORAGE_KEY)
      return null
    }
    return session
  } catch {
    return null
  }
}

function writeSession(session: Session | null) {
  if (!isBrowser()) return
  if (session) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  } else {
    window.localStorage.removeItem(STORAGE_KEY)
  }
  window.dispatchEvent(new Event("personai:auth-change"))
}

function makeSession(account: StoredAccount): Session {
  const expires = new Date()
  expires.setDate(expires.getDate() + 7)
  return {
    user: {
      id: account.id,
      email: account.email,
      name: account.name,
    },
    token: `mock.${account.id}.${Date.now()}`,
    expiresAt: expires.toISOString(),
  }
}

async function delay(ms = 350) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

type SignInEmailInput = {
  email: string
  password: string
}

type SignUpEmailInput = {
  email: string
  password: string
  name: string
}

async function signInEmail(
  input: SignInEmailInput,
): Promise<AuthResult<Session>> {
  await delay()
  const accounts = readAccounts()
  const account = accounts.find(
    (a) => a.email.toLowerCase() === input.email.trim().toLowerCase(),
  )
  if (!account) {
    return {
      data: null,
      error: {
        code: "user_not_found",
        message: "找不到此 Email 的帳號，請確認或註冊新帳號。",
      },
    }
  }
  if (account.passwordHash !== hashPassword(input.password)) {
    return {
      data: null,
      error: {
        code: "invalid_credentials",
        message: "Email 或密碼不正確。",
      },
    }
  }
  const session = makeSession(account)
  writeSession(session)
  return { data: session, error: null }
}

async function signUpEmail(
  input: SignUpEmailInput,
): Promise<AuthResult<Session>> {
  await delay()
  const email = input.email.trim().toLowerCase()
  if (input.password.length < 8) {
    return {
      data: null,
      error: {
        code: "weak_password",
        message: "密碼至少需要 8 個字元。",
      },
    }
  }
  const accounts = readAccounts()
  if (accounts.some((a) => a.email.toLowerCase() === email)) {
    return {
      data: null,
      error: {
        code: "email_already_exists",
        message: "此 Email 已被使用，請改用登入或更換 Email。",
      },
    }
  }
  const account: StoredAccount = {
    id: `user_${Math.random().toString(36).slice(2, 10)}`,
    email,
    name: input.name.trim() || email.split("@")[0],
    passwordHash: hashPassword(input.password),
  }
  writeAccounts([...accounts, account])
  const session = makeSession(account)
  writeSession(session)
  return { data: session, error: null }
}

async function signOut(): Promise<AuthResult<{ success: true }>> {
  await delay(150)
  writeSession(null)
  return { data: { success: true }, error: null }
}

function getSession(): Session | null {
  return readSession()
}

type UseSessionReturn = {
  data: Session | null
  isPending: boolean
  refetch: () => void
}

function useSession(): UseSessionReturn {
  const [hydrated, setHydrated] = React.useState(false)
  const [session, setSession] = React.useState<Session | null>(null)

  const sync = React.useCallback(() => {
    setSession(readSession())
  }, [])

  React.useEffect(() => {
    sync()
    setHydrated(true)
    function onChange() {
      sync()
    }
    window.addEventListener("personai:auth-change", onChange)
    window.addEventListener("storage", onChange)
    return () => {
      window.removeEventListener("personai:auth-change", onChange)
      window.removeEventListener("storage", onChange)
    }
  }, [sync])

  return {
    data: session,
    isPending: !hydrated,
    refetch: sync,
  }
}

export const authClient = {
  signIn: { email: signInEmail },
  signUp: { email: signUpEmail },
  signOut,
  getSession,
  useSession,
}

export const { signIn, signUp } = authClient
export { signOut, useSession, getSession }
