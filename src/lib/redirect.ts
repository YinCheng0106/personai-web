export function safeInternalRedirect(
  value: string | null | undefined,
  fallback = "/"
) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return fallback
  }
  if (value.includes("\\") || /[\u0000-\u001f\u007f]/.test(value)) {
    return fallback
  }
  return value
}
