import { betterAuth } from "better-auth"
import { APIError, isAPIError } from "better-auth/api"
import { verifyPassword } from "better-auth/crypto"
import { jwt } from "better-auth/plugins"
import { Pool } from "pg"
import { after } from "next/server"
import { createHmac } from "node:crypto"

import { createAuthDatabase } from "./auth-database"
import {
  clientAddress,
  recoveryEmail,
  recoveryOriginAllowed,
  withClientAddress,
} from "./auth-request"
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
  clientIpHeader = process.env.PERSONAI_TRUSTED_CLIENT_IP_HEADER,
  rateLimitPool = new Pool({
    ...pool.options,
    max: 2,
    connectionTimeoutMillis: 5000,
    allowExitOnIdle: true,
  }),
}: {
  pool?: Pool
  deliver?: (email: ResetEmail) => Promise<void>
  background?: (promise: Promise<unknown>) => void
  clientIpHeader?: string
  rateLimitPool?: Pool
} = {}) {
  const db = createAuthDatabase(pool, rateLimitPool)
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
      window: 10,
      customStorage: db.rateLimitStorage,
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
      password: {
        verify: async (input) => {
          const valid = await verifyPassword(input)
          if (valid) db.rememberVerifiedHash(input.hash)
          return valid
        },
      },
      sendResetPassword: async (email) => {
        await deliver(email).catch(() => {
          console.error("Password reset email delivery failed")
        })
      },
    },
    databaseHooks: {
      session: {
        create: {
          before: async (session, context) => {
            if (
              context?.path === "/sign-in/email" &&
              !(await db.credentialIsCurrent(session.userId))
            )
              throw new APIError("UNAUTHORIZED", {
                message: "Invalid email or password",
              })
          },
        },
      },
    },
    advanced: {
      disableOriginCheck: false,
      disableCSRFCheck: false,
      backgroundTasks: { handler: background },
      ipAddress: { ipAddressHeaders: ["x-personai-client-ip"] },
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
        if (!body || typeof body !== "object" || Array.isArray(body))
          return Response.json({ message: "無效的請求。" }, { status: 400 })
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
          if (!recoveryEmail.safeParse(body.email).success) {
            return Response.json(
              { message: "請輸入有效的電子郵件。" },
              { status: 400 }
            )
          }
        } else if (
          typeof body.token !== "string" ||
          !/^[A-Za-z0-9]{24}$/.test(body.token) ||
          typeof body.newPassword !== "string" ||
          body.newPassword.length < 8 ||
          body.newPassword.length > 128
        )
          return Response.json(
            { message: "重設連結無效或已失效。" },
            { status: 400 }
          )
        if (
          request.headers
            .get("content-type")
            ?.split(";")[0]
            .trim()
            .toLowerCase() !== "application/json"
        )
          return Response.json({ message: "無效的內容類型。" }, { status: 415 })
        if (!recoveryOriginAllowed(request, trustedOrigins))
          return Response.json({ message: "無效的來源。" }, { status: 403 })
        const address = clientAddress(request, clientIpHeader)
        const secret = process.env.BETTER_AUTH_SECRET
        if (!address || !secret) return unavailable()
        const sourceKey = createHmac("sha256", secret)
          .update(address)
          .digest("hex")
        const limited = () =>
          Response.json(
            { message: "請求過於頻繁，請稍後再試。" },
            { status: 429, headers: { "Retry-After": "60" } }
          )
        // A single source can consume at most 5/30 requests or 10/60 submits.
        // Refused and per-email-suppressed traffic never debits shared capacity.
        if (
          !(await db.allow(
            `reset-source:${isRequest ? "request" : "submit"}:${sourceKey}`,
            isRequest ? 5 : 10,
            60_000
          ))
        )
          return limited()
        if (isRequest) {
          const key = createHmac("sha256", secret)
            .update(body.email.toLowerCase())
            .digest("hex")
          if (
            !(await db.allow(`reset-email:${key}`, 1, 60_000)) ||
            !(await db.allow(`reset-hour:${key}`, 3, 3_600_000))
          )
            return generic()
        }
        if (
          !(await db.allow(
            isRequest ? "reset-request-global" : "reset-submit-global",
            isRequest ? 30 : 60,
            60_000
          ))
        )
          return limited()
        request = withClientAddress(request, address)
        if (isRequest) {
          const response = await instance.handler(request)
          return response.ok
            ? generic()
            : response.status === 429
              ? response
              : unavailable()
        }
        return await db.reset(
          body.token,
          () => instance.handler(request),
          (response) => response.ok
        )
      }
      const address = clientAddress(request, clientIpHeader)
      const publicJwks = request.method === "GET" && path === "/api/auth/jwks"
      if (!address && !publicJwks) return unavailable()
      request = withClientAddress(request, address)
      if (request.method === "POST" && path === "/api/auth/sign-in/email")
        return await db.login(
          () => instance.handler(request),
          (response) => response.ok
        )
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
        apiSucceeded
      )
    },
  })
  const signInEmail = new Proxy(instance.api.signInEmail, {
    apply(target, thisArg, args) {
      return db.login(
        () => Reflect.apply(target, thisArg, args) as Promise<unknown>,
        apiSucceeded
      )
    },
  })
  return {
    ...instance,
    handler,
    close: () => rateLimitPool.end(),
    api: { ...instance.api, resetPassword, signInEmail },
  }
}

function apiSucceeded(result: unknown): boolean {
  if (result instanceof Response) return result.ok
  if (
    result &&
    typeof result === "object" &&
    "status" in result &&
    typeof result.status === "number"
  )
    return result.status < 400
  if (result && typeof result === "object" && "response" in result)
    return !isAPIError(result.response)
  return !isAPIError(result)
}

export const auth = createPersonaiAuth()
