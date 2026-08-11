"use client"

import { createAuthClient } from "better-auth/react"
import { jwtClient } from "better-auth/client/plugins"

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL,
  plugins: [jwtClient()],
})

export const { signIn, signUp, signOut, useSession, getSession } = authClient

export async function getAccessToken(): Promise<string> {
  const { data, error } = await authClient.token()
  if (error || !data?.token) {
    throw new Error(error?.message ?? "無法取得 API 登入憑證，請重新登入。")
  }
  return data.token
}
