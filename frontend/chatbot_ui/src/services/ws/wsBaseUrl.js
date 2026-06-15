function _normalizeBaseUrl(baseUrl) {
  if (!baseUrl) return ""
  return String(baseUrl).replace(/\/+$/, "")
}

export function getWsBaseUrl() {
  const env = _normalizeBaseUrl(import.meta.env.VITE_WS_URL)
  if (env) return env

  if (typeof window === "undefined" || !window.location) return ""

  const proto = window.location.protocol === "https:" ? "wss" : "ws"
  return `${proto}://${window.location.host}/ws`
}

