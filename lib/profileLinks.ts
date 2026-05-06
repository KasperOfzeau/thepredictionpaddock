/**
 * Helpers for the optional public profile link (Instagram, YouTube, personal site, …).
 *
 * The URL is stored on `profiles.website_url`. We accept either a full URL
 * (`https://instagram.com/foo`) or a bare hostname/path (`instagram.com/foo`)
 * and always normalize to `https://…` before saving.
 */

export const MAX_PROFILE_URL_LENGTH = 200

export type ProfileLinkPlatform =
  | 'instagram'
  | 'youtube'
  | 'x'
  | 'tiktok'
  | 'github'
  | 'linkedin'
  | 'twitch'
  | 'website'

export interface ProfileLinkInfo {
  platform: ProfileLinkPlatform
  /** Short human label, e.g. "Instagram" or "Website". */
  label: string
  /** Compact display text shown to the user (e.g. "@kasperofzeau" or "kasper.dev"). */
  display: string
  /** Fully qualified URL safe to put in an `href`. */
  href: string
}

/** Trim, prepend https:// if missing, and ensure there is at least one dot in the hostname. */
function buildUrl(rawInput: string): URL | null {
  const raw = rawInput.trim()
  if (!raw) return null

  // Reject obvious junk early so `new URL` does not happily parse "javascript:..".
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`

  let parsed: URL
  try {
    parsed = new URL(withScheme)
  } catch {
    return null
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
  if (!parsed.hostname.includes('.')) return null

  // Always store as https – we never want to embed http into someone's profile.
  parsed.protocol = 'https:'
  return parsed
}

export function validateProfileUrl(
  rawInput: string,
): { ok: true; url: string } | { ok: false; error: string } {
  const trimmed = rawInput.trim()
  if (trimmed.length > MAX_PROFILE_URL_LENGTH) {
    return { ok: false, error: `Link must be at most ${MAX_PROFILE_URL_LENGTH} characters` }
  }
  const url = buildUrl(trimmed)
  if (!url) {
    return {
      ok: false,
      error: 'Please enter a valid link (e.g. https://instagram.com/yourhandle)',
    }
  }
  if (url.toString().length > MAX_PROFILE_URL_LENGTH) {
    return { ok: false, error: `Link must be at most ${MAX_PROFILE_URL_LENGTH} characters` }
  }
  return { ok: true, url: url.toString() }
}

const PLATFORM_HOSTS: Array<{ match: RegExp; platform: ProfileLinkPlatform; label: string }> = [
  { match: /(^|\.)instagram\.com$/i, platform: 'instagram', label: 'Instagram' },
  { match: /(^|\.)(youtube\.com|youtu\.be)$/i, platform: 'youtube', label: 'YouTube' },
  { match: /(^|\.)(x\.com|twitter\.com)$/i, platform: 'x', label: 'X' },
  { match: /(^|\.)tiktok\.com$/i, platform: 'tiktok', label: 'TikTok' },
  { match: /(^|\.)github\.com$/i, platform: 'github', label: 'GitHub' },
  { match: /(^|\.)linkedin\.com$/i, platform: 'linkedin', label: 'LinkedIn' },
  { match: /(^|\.)twitch\.tv$/i, platform: 'twitch', label: 'Twitch' },
]

/** Build user-facing display text. For social platforms we prefer @handle. */
function buildDisplay(url: URL, platform: ProfileLinkPlatform): string {
  const path = url.pathname.replace(/^\/+|\/+$/g, '')
  const firstSegment = path.split('/')[0] ?? ''
  const handle = firstSegment.replace(/^@+/, '')

  switch (platform) {
    case 'instagram':
    case 'tiktok':
    case 'x':
    case 'github':
    case 'twitch':
      if (handle) return `@${handle}`
      return url.hostname.replace(/^www\./i, '')
    case 'youtube': {
      // youtu.be/<id> and youtube.com/@handle both look fine as @handle when a path is present.
      if (firstSegment.startsWith('@')) return firstSegment
      if (handle) return `@${handle}`
      return 'YouTube'
    }
    case 'linkedin': {
      // linkedin.com/in/<slug>
      const slug = path.split('/')[1]
      if (slug) return slug
      return 'LinkedIn'
    }
    case 'website':
    default: {
      const host = url.hostname.replace(/^www\./i, '')
      return path ? `${host}/${path}`.replace(/\/+$/, '') : host
    }
  }
}

/**
 * Parse a stored URL and return display info. Returns `null` if the value is
 * not a valid URL (e.g. legacy/garbage data) – callers should hide the link.
 */
export function getProfileLinkInfo(rawUrl: string | null | undefined): ProfileLinkInfo | null {
  if (!rawUrl) return null
  const url = buildUrl(rawUrl)
  if (!url) return null

  const host = url.hostname.toLowerCase()
  const match = PLATFORM_HOSTS.find((p) => p.match.test(host))
  const platform = match?.platform ?? 'website'
  const label = match?.label ?? 'Website'

  return {
    platform,
    label,
    display: buildDisplay(url, platform),
    href: url.toString(),
  }
}
