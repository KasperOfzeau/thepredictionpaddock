import { createAdminClient } from '@/lib/supabase/admin'
import { getLastEvent } from '@/lib/services/meetings'
import { refreshPointsForSession } from '@/lib/services/scoring'
import type { SupabaseClient } from '@supabase/supabase-js'

const CURRENT_YEAR = new Date().getFullYear()

/**
 * Returns the end time of the last finished race/sprint (ISO string).
 * Used to decide if cached season scores are still valid.
 * Returns null on error (e.g. RLS when not logged in) so callers can still proceed.
 */
export async function getLastFinishedRaceEnd(): Promise<string | null> {
  try {
    const last = await getLastEvent()
    return last?.session?.date_end ?? null
  } catch {
    return null
  }
}

type MeetingRelation = { year: number } | { year: number }[] | null

function getMeetingYear(meetings: MeetingRelation): number | null {
  const meeting = Array.isArray(meetings) ? meetings[0] : meetings
  return meeting?.year ?? null
}

/**
 * Refresh points for finished sessions that affect the requested users.
 * Results are fetched from OpenF1 once per session; if a result is unavailable,
 * existing stored points are left untouched.
 */
async function refreshAvailablePredictionPointsForUsers(
  admin: ReturnType<typeof createAdminClient>,
  userIds: string[],
  year: number
): Promise<Set<string>> {
  const updatedUserIds = new Set<string>()
  if (userIds.length === 0) return updatedUserIds

  const { data: predictionSessions, error } = await admin
    .from('predictions')
    .select('session_key, meetings!inner(year)')
    .in('user_id', userIds)
    .not('session_key', 'is', null)

  if (error || !predictionSessions?.length) {
    if (error) console.error('Error fetching prediction sessions:', error)
    return updatedUserIds
  }

  const sessionKeys = Array.from(
    new Set(
      predictionSessions
        .filter((row: { meetings?: MeetingRelation }) => getMeetingYear(row.meetings ?? null) === year)
        .map((row: { session_key: number | null }) => row.session_key)
        .filter((sessionKey): sessionKey is number => typeof sessionKey === 'number')
    )
  )

  for (const sessionKey of sessionKeys) {
    const updatedForSession = await refreshPointsForSession(sessionKey, admin)
    updatedForSession.forEach((userId) => updatedUserIds.add(userId))
  }

  return updatedUserIds
}

/**
 * Compute total prediction points for a user in a given season (sum over races in that year).
 */
async function computeSeasonPointsForUsers(
  supabase: SupabaseClient,
  userIds: string[],
  year: number
): Promise<Record<string, number>> {
  const totals = Object.fromEntries(userIds.map((userId) => [userId, 0]))
  if (userIds.length === 0) return totals

  const { data: rows, error } = await supabase
    .from('predictions')
    .select('user_id, points, meetings!inner(year)')
    .in('user_id', userIds)

  if (error) {
    console.error('Error computing season points:', error)
    return totals
  }

  for (const row of rows ?? []) {
    const typedRow = row as { user_id: string; points?: number | null; meetings?: MeetingRelation }
    if (getMeetingYear(typedRow.meetings ?? null) !== year) continue
    totals[typedRow.user_id] = (totals[typedRow.user_id] ?? 0) + (typedRow.points ?? 0)
  }

  return totals
}

async function upsertSeasonPointsForUsers(
  supabase: SupabaseClient,
  totals: Record<string, number>,
  year: number
): Promise<void> {
  const now = new Date().toISOString()
  const rows = Object.entries(totals).map(([userId, points]) => ({
    user_id: userId,
    season_year: year,
    points,
    updated_at: now,
  }))

  if (rows.length === 0) return

  const { error } = await supabase
    .from('user_season_scores')
    .upsert(rows, { onConflict: 'user_id,season_year' })

  if (error) {
    console.error('Error saving season points:', error)
  }
}

export async function refreshUserSeasonPoints(
  userId: string,
  year: number = CURRENT_YEAR,
  client?: SupabaseClient
): Promise<number> {
  const supabase = client ?? createAdminClient()
  const totals = await computeSeasonPointsForUsers(supabase, [userId], year)
  await upsertSeasonPointsForUsers(supabase, totals, year)
  return totals[userId] ?? 0
}

/**
 * Refresh available race points, then recompute and save season points for one user.
 */
export async function getOrComputeUserSeasonPoints(
  userId: string,
  year: number = CURRENT_YEAR
): Promise<number> {
  const result = await getOrComputeSeasonPointsForUsers([userId], year)
  return result[userId] ?? 0
}

/**
 * Refresh available race points, then recompute and save season points for multiple users.
 * Returns a map of user_id -> points.
 */
export async function getOrComputeSeasonPointsForUsers(
  userIds: string[],
  year: number = CURRENT_YEAR
): Promise<Record<string, number>> {
  if (userIds.length === 0) return {}

  const admin = createAdminClient()

  await refreshAvailablePredictionPointsForUsers(admin, userIds, year)
  const result = await computeSeasonPointsForUsers(admin, userIds, year)
  await upsertSeasonPointsForUsers(admin, result, year)
  return result
}
