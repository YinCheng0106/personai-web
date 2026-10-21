import { createHmac } from "node:crypto"

export type ResetEmail = { user: { email: string }; url: string; token: string }

// This module is only imported by the server auth configuration. Never import
// it from a client component or expose these settings through NEXT_PUBLIC_*.
export async function sendResetEmail({ user, url, token }: ResetEmail) {
  const key = process.env.RESEND_API_KEY
  const sender = process.env.RESEND_FROM_EMAIL
  if (
    !key ||
    !sender ||
    /[\r\n]/.test(sender) ||
    /@resend\.dev\b/i.test(sender)
  ) {
    console.error("Password reset email configuration unavailable")
    return
  }
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "Idempotency-Key": createHmac("sha256", key)
          .update(token)
          .digest("hex"),
      },
      body: JSON.stringify({
        from: sender,
        to: [user.email],
        subject: "重設 PersonAI 密碼",
        text: `請開啟以下連結重設密碼（15 分鐘內有效）：\n${url}\n\n若非本人申請，請忽略這封信。`,
      }),
      signal: AbortSignal.timeout(8000),
    })
    if (!response.ok) console.error("Password reset email delivery failed")
  } catch {
    console.error("Password reset email delivery failed")
  }
}
