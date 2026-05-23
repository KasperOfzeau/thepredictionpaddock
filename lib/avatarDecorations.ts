/**
 * Catalog of avatar decorations and the rules that unlock them.
 *
 * Visuals (label, color, logo asset) live in code; per-user manual grants and
 * referential integrity live in the database (`avatar_decorations` +
 * `user_avatar_decorations` tables). Stat-based decorations stay derived in
 * code so we don't have to evaluate predicates server-side, while role/event
 * decorations rely purely on rows in `user_avatar_decorations`.
 *
 * Adding a new decoration is intentionally cheap: append an entry below with
 * a stable `id`, the asset path under /public, a fallback color, an unlock
 * label and the unlockrule. For role-based decorations use `unlockKind:
 * 'manual'` and rely on `stats.manualGrants` in `isUnlocked`.
 */

export type AvatarDecorationId =
  | 'ferrari-red'
  | 'mercedes-teal'
  | 'red-bull-navy'
  | 'alpine-pink'
  | 'williams-royal'
  | 'mclaren-papaya'
  | 'larslaars'

/** Stats used to evaluate which decorations a user has unlocked. */
export interface AvatarDecorationStats {
  predictionCount: number
  bestRacePoints: number | null
  globalRank: number | null
  /** IDs the user has been granted manually via `user_avatar_decorations`. */
  manualGrants: ReadonlySet<string>
}

/**
 * - `auto`: unlock criteria are evaluated against the user's stats in code.
 * - `manual`: only unlocked when an admin granted it via `user_avatar_decorations`.
 */
export type AvatarDecorationUnlockKind = 'auto' | 'manual'

export interface AvatarDecoration {
  id: AvatarDecorationId
  /** Display name used in the dropdown and as the badge tooltip. */
  label: string
  /** Hex teamcolor used as a fallback / circular backdrop behind the logo. */
  color: string
  /** Public path to the badge logo asset. */
  logoSrc: string
  /** Short reason string shown after the label in the settings dropdown. */
  unlockLabel: string
  unlockKind: AvatarDecorationUnlockKind
  /**
   * Padding inside the badge as a fraction of the badge size (0-1).
   * Defaults to ~0.05 (a hairline). Use a higher value when the logo asset
   * has no built-in margin and would otherwise touch the circle edge.
   */
  logoInset?: number
  isUnlocked: (stats: AvatarDecorationStats) => boolean
}

/** Static label for the "no decoration" option. */
export const NO_DECORATION_LABEL = 'No decoration'

export const AVATAR_DECORATIONS: readonly AvatarDecoration[] = [
  {
    id: 'ferrari-red',
    label: 'Ferrari Red',
    color: '#DC0000',
    logoSrc: '/avatar-decorations/ferrari-red.svg',
    unlockKind: 'auto',
    unlockLabel: 'after your first prediction',
    isUnlocked: (stats) =>
      stats.predictionCount >= 1 || stats.manualGrants.has('ferrari-red'),
  },
  {
    id: 'mercedes-teal',
    label: 'Mercedes Teal',
    color: '#00A19C',
    logoSrc: '/avatar-decorations/mercedes-teal.png',
    unlockKind: 'auto',
    unlockLabel: 'after your first prediction',
    logoInset: 0.12,
    isUnlocked: (stats) =>
      stats.predictionCount >= 1 || stats.manualGrants.has('mercedes-teal'),
  },
  {
    id: 'red-bull-navy',
    label: 'Red Bull Navy',
    color: '#002740',
    logoSrc: '/avatar-decorations/red-bull-navy.svg',
    unlockKind: 'auto',
    unlockLabel: 'after 2 predictions',
    logoInset: 0.12,
    isUnlocked: (stats) =>
      stats.predictionCount >= 2 || stats.manualGrants.has('red-bull-navy'),
  },
  {
    id: 'alpine-pink',
    label: 'Alpine Pink',
    color: '#EF95CF',
    logoSrc: '/avatar-decorations/alpine-pink.png',
    unlockKind: 'auto',
    unlockLabel: 'after 3 predictions',
    logoInset: 0.12,
    isUnlocked: (stats) =>
      stats.predictionCount >= 3 || stats.manualGrants.has('alpine-pink'),
  },
  {
    id: 'williams-royal',
    label: 'Williams Royal',
    color: '#041E42',
    logoSrc: '/avatar-decorations/williams-royal.png',
    unlockKind: 'auto',
    unlockLabel: 'after 5 predictions',
    logoInset: 0.12,
    isUnlocked: (stats) =>
      stats.predictionCount >= 5 || stats.manualGrants.has('williams-royal'),
  },
  {
    id: 'mclaren-papaya',
    label: 'McLaren Papaya',
    color: '#FF8000',
    logoSrc: '/avatar-decorations/mclaren-papaya.svg',
    unlockKind: 'auto',
    unlockLabel: 'after 10 predictions',
    isUnlocked: (stats) =>
      stats.predictionCount >= 10 || stats.manualGrants.has('mclaren-papaya'),
  },
  {
    id: 'larslaars',
    label: 'LarsLaars',
    color: '#ffdd57',
    logoSrc: '/avatar-decorations/laars.png',
    unlockKind: 'manual',
    unlockLabel: 'via LarsLaars referral',
    logoInset: 0.18,
    isUnlocked: (stats) => stats.manualGrants.has('larslaars'),
  },
]

/** Empty stats object. Use when only the catalog is needed (e.g. lookup-only). */
export const EMPTY_AVATAR_DECORATION_STATS: AvatarDecorationStats = {
  predictionCount: 0,
  bestRacePoints: null,
  globalRank: null,
  manualGrants: new Set<string>(),
}

export function getAvatarDecorationById(
  id: string | null | undefined,
): AvatarDecoration | null {
  if (!id) return null
  return AVATAR_DECORATIONS.find((decoration) => decoration.id === id) ?? null
}

/** Returns true if the given decoration id is currently unlocked for `stats`. */
export function isAvatarDecorationUnlocked(
  id: string | null | undefined,
  stats: AvatarDecorationStats,
): boolean {
  if (!id) return true
  const decoration = getAvatarDecorationById(id)
  if (!decoration) return false
  return decoration.isUnlocked(stats)
}

