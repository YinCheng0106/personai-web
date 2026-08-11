import { betterAuth } from "better-auth"
import { jwt } from "better-auth/plugins"
import { Pool } from "pg"

const authIssuer = process.env.AUTH_ISSUER ?? "http://localhost:3000"
const authAudience = process.env.AUTH_AUDIENCE ?? "personai-api"
const trustedOrigins = (
  process.env.BETTER_AUTH_TRUSTED_ORIGINS ??
  "http://localhost:3000,http://127.0.0.1:3000"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean)

export const auth = betterAuth({
  appName: "PersonAI",
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  trustedOrigins,
  database: new Pool({
    connectionString: process.env.DATABASE_URL,
    options: "-c search_path=personai_auth",
    max: 5,
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  advanced: {
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
