// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest"
import { clientAddress, withClientAddress } from "@/lib/auth-request"

afterEach(() => vi.unstubAllEnvs())
describe("trusted ingress source extraction", () => {
  it("rebuilds a foreign-runtime request without losing its body or trusting its internal IP", async () => {
    const native = new Request(
      "http://localhost:3000/api/auth/sign-in/email?x=1",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-personai-client-ip": "203.0.113.99",
        },
        body: '{"email":"synthetic@personai.test"}',
      }
    )
    // Structural request with no native Request brand, like a foreign NextRequest.
    const foreign = {
      url: native.url,
      method: native.method,
      headers: native.headers,
      body: native.body,
      signal: native.signal,
    } as Request
    const result = withClientAddress(foreign, "192.0.2.1")
    expect(result.url).toBe(native.url)
    expect(result.method).toBe("POST")
    expect(result.headers.get("x-personai-client-ip")).toBe("192.0.2.1")
    expect(await result.json()).toEqual({ email: "synthetic@personai.test" })
    expect(
      withClientAddress(
        new Request("http://localhost:3000/api/auth/jwks", {
          headers: native.headers,
        }),
        null
      ).headers.has("x-personai-client-ip")
    ).toBe(false)
  })
  it.each([undefined, "", "not-an-ip", "192.0.2.1, 192.0.2.2"])(
    "rejects missing or invalid configured address %s",
    (value) => {
      const headers = new Headers({ "x-forwarded-for": "192.0.2.99" })
      if (value !== undefined) headers.set("x-ingress-ip", value)
      expect(
        clientAddress(
          new Request("https://personai.test", { headers }),
          "x-ingress-ip"
        )
      ).toBeNull()
    }
  )
  it("fails closed in production without explicit trusted ingress configuration", () => {
    vi.stubEnv("NODE_ENV", "production")
    expect(
      clientAddress(
        new Request("http://localhost:3000", {
          headers: {
            "x-forwarded-for": "192.0.2.99",
            "x-personai-client-ip": "192.0.2.10",
          },
        })
      )
    ).toBeNull()
  })
  it("ignores spoofed headers during local development", () => {
    vi.stubEnv("NODE_ENV", "development")
    expect(
      clientAddress(
        new Request("http://localhost:3000", {
          headers: { "x-forwarded-for": "192.0.2.99" },
        })
      )
    ).toBe("127.0.0.1")
    expect(clientAddress(new Request("https://personai.test"))).toBeNull()
  })
  it("normalizes IPv6 aliases, /64 addresses, and mapped IPv4", () => {
    const address = (value: string) =>
      clientAddress(
        new Request("https://personai.test", {
          headers: { "x-ingress-ip": value },
        }),
        "x-ingress-ip"
      )
    expect(address("2001:DB8::1")).toBe(address("2001:db8:0:0::2"))
    expect(address("::ffff:192.0.2.1")).toBe(address("192.0.2.1"))
  })
})
