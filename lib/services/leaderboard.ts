import { unstable_cache } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOrComputeSeasonPointsForUsers } from '@/lib/services/seasonScores'

export interface LeaderboardEntry {
  user_id: string
  username: string
  avatar_url: string | null
  avatar_decoration_id: string | null
  total_points: number
  rank: number
}

export interface PaginatedLeaderboardResult {
  entries: LeaderboardEntry[]
  page: number
  pageSize: number
  totalEntries: number
  totalPages: number
  hasPreviousPage: boolean
  hasNextPage: boolean
}

const CURRENT_YEAR = new Date().getFullYear()

function normalizePositiveInteger(value: number, fallback: number) {
  if (!Number.isFinite(value) || value < 1) return fallback

  return Math.floor(value)
}

async function getRankedLeaderboardEntries(): Promise<Omit<LeaderboardEntry, 'rank'>[]> {
  const supabase = createAdminClient()

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, username, avatar_url, avatar_decoration_id')
    .not('username', 'is', null)

  if (error || !profiles?.length) {
    if (error) console.error('Error fetching leaderboard:', error)
    return []
  }

  const userIds = profiles.map((profile) => profile.id)
  const seasonPointsByUser = await getOrComputeSeasonPointsForUsers(userIds, CURRENT_YEAR)

  const withPoints = profiles.map((profile) => ({
    user_id: profile.id,
    username: profile.username || 'Unknown',
    avatar_url: profile.avatar_url,
    avatar_decoration_id: profile.avatar_decoration_id ?? null,
    total_points: seasonPointsByUser[profile.id] ?? 0,
  }))

  withPoints.sort((a, b) => {
    if (b.total_points !== a.total_points) {
      return b.total_points - a.total_points
    }

    return a.username.localeCompare(b.username)
  })

  return withPoints
}

/**
 * Cached ranking used by every leaderboard consumer (home top-N, the full
 * `/leaderboard` page, and per-profile rank lookups).
 *
 * `getRankedLeaderboardEntries` is expensive: it recomputes season points for
 * every user, which refreshes race results from OpenF1 and writes back to the
 * database. Without this cache each profile/leaderboard request would repeat
 * that full pass. Sharing a single 60s cache caps it to one recompute per
 * minute across the whole app.
 */
const getCachedRankedLeaderboardEntries = unstable_cache(
  getRankedLeaderboardEntries,
  ['ranked-leaderboard-entries', String(CURRENT_YEAR)],
  { revalidate: 60, tags: ['global-leaderboard'] }
)

/**
 * Global rank and season points for a single user (current year leaderboard ordering).
 * Returns null if the user has no username on their profile (excluded from ranking).
 */
export async function getGlobalLeaderboardRankForUser(
  userId: string
): Promise<{ rank: number; total_points: number } | null> {
  const rankedEntries = await getCachedRankedLeaderboardEntries()
  const idx = rankedEntries.findIndex((e) => e.user_id === userId)
  if (idx === -1) return null
  return { rank: idx + 1, total_points: rankedEntries[idx].total_points }
}

/**
 * Get global leaderboard - top players by season score (current year).
 * Uses admin client so the leaderboard can be shown on the public home page (no RLS block).
 * @param limit - Number of top players to return (default 5)
 */
export async function getGlobalLeaderboard(limit: number = 5): Promise<LeaderboardEntry[]> {
  const pageSize = normalizePositiveInteger(limit, 5)
  const { entries } = await getPaginatedGlobalLeaderboard({ page: 1, pageSize })
  return entries
}

export interface TopPredictor {
  user_id: string
  username: string
  avatar_url: string | null
  avatar_decoration_id: string | null
  points: number
}

export interface SessionPredictionResult {
  user_id: string
  username: string
  avatar_url: string | null
  avatar_decoration_id: string | null
  points: number | null
  rank: number
}

/**
 * Top predictors for a single race session, ranked by the points earned on that
 * race's prediction (highest first, earliest submission wins ties).
 *
 * Trusts the `points` column on `predictions`, which is kept fresh by the cached
 * global leaderboard's periodic recompute (same source the home page already
 * uses for its "previous event" points), so this stays a cheap read.
 * Uses the admin client so it can be shown on the public home page (no RLS block).
 */
export async function getTopPredictionsForSession(
  sessionKey: number,
  limit: number = 3
): Promise<TopPredictor[]> {
  const normalizedLimit = normalizePositiveInteger(limit, 3)
  const supabase = createAdminClient()

  // Over-fetch a little so profiles without a username can be filtered out
  // while still returning a full podium.
  const { data: predictions, error } = await supabase
    .from('predictions')
    .select('user_id, points, updated_at')
    .eq('session_key', sessionKey)
    .not('points', 'is', null)
    .order('points', { ascending: false })
    .order('updated_at', { ascending: true })
    .limit(normalizedLimit + 5)

  if (error || !predictions?.length) {
    if (error) console.error('Error fetching top predictions:', error)
    return []
  }

  const userIds = predictions.map((prediction) => prediction.user_id)
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, avatar_url, avatar_decoration_id')
    .in('id', userIds)

  const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]))

  const ranked: TopPredictor[] = []
  for (const prediction of predictions) {
    const profile = profileById.get(prediction.user_id)
    if (!profile?.username) continue

    ranked.push({
      user_id: prediction.user_id,
      username: profile.username,
      avatar_url: profile.avatar_url ?? null,
      avatar_decoration_id: profile.avatar_decoration_id ?? null,
      points: prediction.points as number,
    })

    if (ranked.length >= normalizedLimit) break
  }

  return ranked
}

/**
 * All public prediction results for a single session, ranked by points.
 * Uses the persisted `points` column, kept fresh by the same scoring flow as the
 * home page podium and global leaderboard.
 */
export async function getPredictionResultsForSession(
  sessionKey: number
): Promise<SessionPredictionResult[]> {
  const supabase = createAdminClient()

  const { data: predictions, error } = await supabase
    .from('predictions')
    .select('user_id, points, updated_at')
    .eq('session_key', sessionKey)
    .order('points', { ascending: false, nullsFirst: false })
    .order('updated_at', { ascending: true })

  if (error || !predictions?.length) {
    if (error) console.error('Error fetching session prediction results:', error)
    return []
  }

  const userIds = predictions.map((prediction) => prediction.user_id)
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, avatar_url, avatar_decoration_id')
    .in('id', userIds)

  const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]))
  const results: Omit<SessionPredictionResult, 'rank'>[] = []

  for (const prediction of predictions) {
    const profile = profileById.get(prediction.user_id)
    if (!profile?.username) continue

    results.push({
      user_id: prediction.user_id,
      username: profile.username,
      avatar_url: profile.avatar_url ?? null,
      avatar_decoration_id: profile.avatar_decoration_id ?? null,
      points: prediction.points as number | null,
    })
  }

  return results.map((result, index) => ({
    ...result,
    rank: index + 1,
  }))
}

export async function getPaginatedGlobalLeaderboard({
  page = 1,
  pageSize = 25,
}: {
  page?: number
  pageSize?: number
} = {}): Promise<PaginatedLeaderboardResult> {
  const normalizedPageSize = normalizePositiveInteger(pageSize, 25)
  const normalizedRequestedPage = normalizePositiveInteger(page, 1)
  const rankedEntries = await getCachedRankedLeaderboardEntries()
  const totalEntries = rankedEntries.length
  const totalPages = Math.max(1, Math.ceil(totalEntries / normalizedPageSize))
  const currentPage = Math.min(normalizedRequestedPage, totalPages)
  const startIndex = (currentPage - 1) * normalizedPageSize

  const entries = rankedEntries
    .slice(startIndex, startIndex + normalizedPageSize)
    .map((entry, index) => ({
      ...entry,
      rank: startIndex + index + 1,
    }))

  return {
    entries,
    page: currentPage,
    pageSize: normalizedPageSize,
    totalEntries,
    totalPages,
    hasPreviousPage: currentPage > 1,
    hasNextPage: currentPage < totalPages,
  }
}
