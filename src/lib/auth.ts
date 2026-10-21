import { betterAuth } from "better-auth"
import { APIError, isAPIError } from "better-auth/api"
import { jwt } from "better-auth/plugins"
import { Pool } from "pg"
import { after } from "next/server"
import { createHmac } from "node:crypto"

import { createAuthDatabase } from "./auth-database"
import { sendResetEmail, type ResetEmail } from "./reset-email"

const authIssuer = process.env.AUTH_ISSUER ?? "http://localhost:3000"
const authAudience = process.env.AUTH_AUDIENCE ?? "personai-api"
const trustedOrigins = (
  process.env.BETTER_AUTH_TRUSTED_ORIGINS ??
  "http://localhost:3000,http://127.0.0.1:3000"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean)

export function createPersonaiAuth({
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    options: "-c search_path=personai_auth",
    max: 5,
  }),
  deliver = sendResetEmail,
  background = (promise: Promise<unknown>) =>
    after(() => promise.then(() => {})),
}: {
  pool?: Pool
  deliver?: (email: ResetEmail) => Promise<void>
  background?: (promise: Promise<unknown>) => void
} = {}) {
  const db = createAuthDatabase(pool)
  const instance = betterAuth({
    appName: "PersonAI",
    baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
    trustedOrigins,
    database: db.database,
    logger: { disabled: true },
    onAPIError: {
      onError: (error) => {
        if (isAPIError(error)) return
        console.error("Authentication request failed")
        throw new APIError("INTERNAL_SERVER_ERROR", {
          message: "Authentication unavailable",
        })
      },
    },
    rateLimit: {
      enabled: true,
      storage: "database",
      customRules: {
        "/request-password-reset": { window: 60, max: 5 },
        "/reset-password": { window: 60, max: 10 },
      },
    },
    verification: { storeIdentifier: "hashed" },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      resetPasswordTokenExpiresIn: 15 * 60,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async (email) => {
        await deliver(email).catch(() => {
          console.error("Password reset email delivery failed")
        })
      },
    },
    advanced: {
      disableOriginCheck: false,
      disableCSRFCheck: false,
      backgroundTasks: { handler: background },
      database: {
        generateId: "uuid",
      },
    },
    plugins: [
      jwt({
        jwt: {
          issuer: authIssuer,
          audience: authAudience,
          expirationTime: "15m",
          getSubject: (session) => session.user.id,
          definePayload: ({ user }) => ({
            email: user.email,
            name: user.name,
          }),
        },
        jwks: {
          rotationInterval: 60 * 60 * 24 * 30,
          gracePeriod: 60 * 60 * 24 * 30,
        },
      }),
    ],
  })

  const generic = () =>
    Response.json({
      status: true,
      message: "若此信箱已註冊，您將收到重設密碼信件。",
    })
  const unavailable = () =>
    Response.json({ message: "目前無法處理，請稍後再試。" }, { status: 503 })
  const handler = async (request: Request): Promise<Response> => {
    const started = Date.now()
    const path = new URL(request.url).pathname.replace(/\/+$/, "")
    const isRequest =
      request.method === "POST" && path === "/api/auth/request-password-reset"
    const isReset =
      request.method === "POST" && path === "/api/auth/reset-password"
    try {
      // Reject encoded route aliases so every reset reaches the same guard.
      if (
        request.method === "POST" &&
        (path.includes("%") || path.includes("//"))
      )
        return Response.json({ message: "無效的請求。" }, { status: 400 })
      if (isRequest || isReset) {
        const reader = request.clone().body?.getReader()
        const chunks: Uint8Array[] = []
        let size = 0
        if (reader) {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            size += value.byteLength
            if (size > 4096) {
              void reader.cancel()
              return Response.json({ message: "無效的請求。" }, { status: 413 })
            }
            chunks.push(value)
          }
        }
        let body
        try {
          body = JSON.parse(Buffer.concat(chunks).toString("utf8"))
        } catch {
          return Response.json({ message: "無效的請求。" }, { status: 400 })
        }
        if (!body || typeof body !== "object")
          return Response.json({ message: "無效的請求。" }, { status: 400 })
        // A database-wide budget cannot be bypassed with forged proxy headers.
        if (
          !(await db.allow(
            isRequest ? "reset-request-global" : "reset-submit-global",
            isRequest ? 30 : 60,
            60_000
          ))
        ) {
          return Response.json(
            { message: "請求過於頻繁，請稍後再試。" },
            { status: 429, headers: { "Retry-After": "60" } }
          )
        }
        if (isRequest) {
          const expected = new URL(
            "/reset-password",
            process.env.BETTER_AUTH_URL ?? "http://localhost:3000"
          ).href
          if (body.redirectTo !== expected)
            return Response.json(
              { message: "無效的重設目的地。" },
              { status: 400 }
            )
          if (
            typeof body.email !== "string" ||
            body.email.length > 254 ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)
          ) {
            return Response.json(
              { message: "請輸入有效的電子郵件。" },
              { status: 400 }
            )
          }
          const secret = process.env.BETTER_AUTH_SECRET
          if (!secret) return unavailable()
          const key = createHmac("sha256", secret)
            .update(body.email.trim().toLowerCase())
            .digest("hex")
          if (
            !(await db.allow(`reset-email:${key}`, 1, 60_000)) ||
            !(await db.allow(`reset-hour:${key}`, 3, 3_600_000))
          )
            return generic()
          const response = await instance.handler(request)
          return response.ok
            ? generic()
            : response.status === 429
              ? response
              : unavailable()
        }
        if (
          typeof body.token !== "string" ||
          !/^[A-Za-z0-9]{24}$/.test(body.token)
        )
          return Response.json(
            { message: "重設連結無效或已失效。" },
            { status: 400 }
          )
        return await db.reset(
          body.token,
          () => instance.handler(request),
          (response) => response.ok
        )
      }
      return await instance.handler(request)
    } catch {
      return unavailable()
    } finally {
      if (isRequest)
        await new Promise((resolve) =>
          setTimeout(resolve, Math.max(0, 300 - (Date.now() - started)))
        )
    }
  }

  // Direct server resets share the transaction boundary and endpoint contract.
  const resetPassword = new Proxy(instance.api.resetPassword, {
    apply(target, thisArg, args) {
      const input = args[0]
      return db.reset(
        input?.body?.token || input?.query?.token || "",
        () => Reflect.apply(target, thisArg, args) as Promise<unknown>,
        (result) => !(result instanceof Response) || result.ok
      )
    },
  })
  return { ...instance, handler, api: { ...instance.api, resetPassword } }
}

export const auth = createPersonaiAuth()
