import 'server-only'

/**
 * Authenticated OpenF1 client. Logs in with premium username/password
 * (https://openf1.org/auth.html) and caches the bearer token in memory
 * until it's about to expire.
 */

const F1_API_URL = 'https://api.openf1.org/v1'
const F1_TOKEN_URL = 'https://api.openf1.org/token'
const TOKEN_EXPIRY_MARGIN_MS = 60_000

let cachedToken: { accessToken: string; expiresAt: number } | null = null

async function login(): Promise<{ accessToken: string; expiresAt: number }> {
  const username = process.env.OPENF1_USERNAME
  const password = process.env.OPENF1_PASSWORD
  if (!username || !password) {
    throw new Error('Missing OPENF1_USERNAME or OPENF1_PASSWORD')
  }

  const res = await fetch(F1_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ username, password }),
  })

  if (!res.ok) {
    throw new Error(`OpenF1 login failed: ${res.status} ${res.statusText}`)
  }

  const data = await res.json()
  return {
    accessToken: data.access_token,
    expiresAt: Date.now() + Number(data.expires_in) * 1000,
  }
}

async function getOpenF1Token(forceRefresh = false): Promise<string> {
  if (!forceRefresh && cachedToken && cachedToken.expiresAt - TOKEN_EXPIRY_MARGIN_MS > Date.now()) {
    return cachedToken.accessToken
  }

  cachedToken = await login()
  return cachedToken.accessToken
}

/**
 * Fetch from the OpenF1 API with the premium bearer token attached.
 * Retries once with a fresh token on a 401.
 */
export async function openf1Fetch(path: string, options?: RequestInit): Promise<Response> {
  const token = await getOpenF1Token()
  const res = await fetch(`${F1_API_URL}${path}`, {
    ...options,
    headers: { ...options?.headers, Authorization: `Bearer ${token}` },
  })

  if (res.status !== 401) return res

  const freshToken = await getOpenF1Token(true)
  return fetch(`${F1_API_URL}${path}`, {
    ...options,
    headers: { ...options?.headers, Authorization: `Bearer ${freshToken}` },
  })
}
