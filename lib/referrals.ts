import type { AvatarDecorationId } from '@/lib/avatarDecorations'

/**
 * Maps a public referral code (used in `?ref=...` links) to the avatar
 * decoration it unlocks. Adding a new referrer is as cheap as appending an
 * entry here with a stable lowercase code.
 */
export const REFERRAL_DECORATIONS: Readonly<Record<string, AvatarDecorationId>> = {
  larslaars: 'larslaars',
}

/**
 * Resolves a raw referral code (e.g. from a URL query param) to the decoration
 * id it grants, or `null` when the code is unknown/invalid.
 */
export function resolveReferralDecorationId(
  code: string | null | undefined,
): AvatarDecorationId | null {
  if (typeof code !== 'string') return null
  const normalized = code.trim().toLowerCase()
  if (!normalized) return null
  return REFERRAL_DECORATIONS[normalized] ?? null
}
