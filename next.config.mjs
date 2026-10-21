/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    const headers = [
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "Cache-Control", value: "no-store" },
      { key: "X-Robots-Tag", value: "noindex, nofollow" },
    ]
    return [
      { source: "/reset-password", headers },
      { source: "/forgot-password", headers },
      { source: "/api/auth/:path*", headers },
    ]
  },
}

export default nextConfig
