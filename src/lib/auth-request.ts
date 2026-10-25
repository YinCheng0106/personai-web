import { isValidIP, normalizeIP } from "@better-auth/core/utils/ip"
import { z } from "zod"

export const recoveryEmail = z.email().max(254)

// Header provenance is enforced at the ingress, never inferred from XFF.
// Only a configured, overwritten single-value header is accepted in production.
export function clientAddress(
  request: Request,
  header?: string
): string | null {
  if (header) {
    const value = request.headers.get(header)?.trim()
    return value && isValidIP(value)
      ? normalizeIP(value, { ipv6Subnet: 64 })
      : null
  }
  const hostname = new URL(request.url).hostname
  if (
    process.env.NODE_ENV !== "production" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(hostname)
  )
    return "127.0.0.1"
  return null
}

export function withClientAddress(
  request: Request,
  address: string | null
): Request {
  const headers = new Headers(request.headers)
  headers.delete("x-personai-client-ip")
  if (address) headers.set("x-personai-client-ip", address)
  // NextRequest can originate from another fetch implementation/realm. Passing
  // it as the constructor input fails branding checks in the runtime Request.
  const init: RequestInit & { duplex: "half" } = {
    method: request.method,
    headers,
    body: request.body,
    signal: request.signal,
    duplex: "half",
  }
  return new Request(request.url, init)
}

export function recoveryOriginAllowed(request: Request, origins: string[]) {
  const origin = request.headers.get("origin")
  const fetchSite = request.headers.get("sec-fetch-site")
  return !!origin && origins.includes(origin) && fetchSite !== "cross-site"
}
