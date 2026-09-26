import type { SupabaseClient } from '@supabase/supabase-js'
import { sendPushToUser } from '@/lib/services/pushNotifications'
import { getAchievement, tierForValue, type Achievement } from '@/lib/achievements/catalog'
import type { Prediction, Session, UserAchievementProgress } from '@/lib/types'
import type { MatchedAchievements } from '@/lib/services/scoring'

/**
 * All of a user's achievement progress rows, keyed by achievement id. Used
 * to render both the full achievements page and the public profile's
 * "trophy cabinet" — the caller decides which client to pass (the regular
 * server client for a user reading their own rows, the admin client for
 * rendering someone else's public profile, since user_achievement_progress
 * only grants self-select via RLS).
 */
export async function getAchievementProgressMapForUser(
  client: SupabaseClient,
  userId: string
): Promise<Map<string, UserAchievementProgress>> {
  const { data } = await client
    .from('user_achievement_progress')
    .select('*')
    .eq('user_id', userId)

  return new Map((data ?? []).map((row: UserAchievementProgress) => [row.achievement_id, row]))
}

interface ProgressRow {
  user_id: string
  achievement_id: string
  current_value: number
  current_tier: number
}

export interface AwardResult {
  currentValue: number
  currentTier: number
  tierJustUnlocked: number | null
}

/**
 * Single choke point for "did this cross a new tier". Always call with the
 * admin/service-role client: user_achievement_progress has no insert/update
 * policy for the authenticated role, by design (see the migration).
 *
 * Pass exactly one of `incrementBy` (running counters, e.g. total points) or
 * `setValue` (authoritative absolute values, e.g. "predictions made so far",
 * a live streak length that can also go down). Either way the underlying
 * write is a single atomic upsert (see the two SQL functions in the
 * migration) — never a read-then-write from here.
 */
export async function awardProgress(
  admin: SupabaseClient,
  userId: string,
  achievementId: string,
  opts: { incrementBy?: number; setValue?: number }
): Promise<AwardResult | null> {
  const achievement = getAchievement(achievementId)
  if (!achievement) return null

  const usingSetValue = opts.setValue !== undefined
  const rpcName = usingSetValue ? 'set_achievement_progress' : 'increment_achievement_progress'
  const params = usingSetValue
    ? { p_user_id: userId, p_achievement_id: achievementId, p_value: opts.setValue }
    : { p_user_id: userId, p_achievement_id: achievementId, p_delta: opts.incrementBy ?? 1 }

  const { data: row, error } = await admin.rpc(rpcName, params).single<ProgressRow>()

  if (error || !row) {
    console.error(`Error updating achievement progress for "${achievementId}":`, error)
    return null
  }

  const newTier = tierForValue(achievement, row.current_value)
  let tierJustUnlocked: number | null = null

  if (newTier > row.current_tier) {
    const { data: updated } = await admin
      .from('user_achievement_progress')
      .update({ current_tier: newTier, unlocked_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('achievement_id', achievementId)
      .lt('current_tier', newTier)
      .select('current_tier')
      .maybeSingle()

    if (updated) {
      tierJustUnlocked = newTier
      await notifyAchievementUnlocked(admin, userId, achievement, newTier)
    }
  }

  return { currentValue: row.current_value, currentTier: newTier, tierJustUnlocked }
}

async function notifyAchievementUnlocked(
  admin: SupabaseClient,
  userId: string,
  achievement: Achievement,
  tier: number
): Promise<void> {
  const tierInfo = achievement.tiers.find((t) => t.tier === tier)
  const title = achievement.tiers.length > 1 && tierInfo
    ? `Achievement unlocked: ${achievement.label} (${tierInfo.label})`
    : `Achievement unlocked: ${achievement.label}`

  const { error } = await admin.from('notifications').insert({
    user_id: userId,
    type: 'achievement_unlocked',
    title,
    message: achievement.description,
    link: '/achievements',
    read: false,
    metadata: { achievement_id: achievement.id, tier },
  })

  if (error) {
    console.error('Error inserting achievement notification:', error)
  }

  await sendPushToUser(userId, {
    title,
    body: achievement.description,
    url: '/achievements',
  })
}

function getTop10(prediction: Pick<Prediction,
  'position_1' | 'position_2' | 'position_3' | 'position_4' | 'position_5' |
  'position_6' | 'position_7' | 'position_8' | 'position_9' | 'position_10'
>): number[] {
  return [
    prediction.position_1, prediction.position_2, prediction.position_3, prediction.position_4,
    prediction.position_5, prediction.position_6, prediction.position_7, prediction.position_8,
    prediction.position_9, prediction.position_10,
  ]
}

/**
 * Fired once, server-side, right where scoring.ts learns a prediction's
 * result just became final (the existing no-op guard there means this is
 * never called twice for an unchanged points value).
 */
export async function handlePointsFinalized(
  admin: SupabaseClient,
  prediction: Prediction,
  resultOrder: number[],
  points: number,
  matched: MatchedAchievements
): Promise<void> {
  const userId = prediction.user_id
  const previousPoints = prediction.points ?? 0
  const delta = points - previousPoints

  const tasks: Promise<unknown>[] = []

  if (delta !== 0) {
    tasks.push(awardProgress(admin, userId, 'points_collector', { incrementBy: delta }))
  }
  if (points === 0) {
    tasks.push(awardProgress(admin, userId, 'secret_bono', { setValue: 1 }))
  }
  if (points >= 30) {
    tasks.push(awardProgress(admin, userId, 'big_haul', { setValue: 1 }))
  }
  if (points === 50) {
    tasks.push(awardProgress(admin, userId, 'perfect_ten', { setValue: 1 }))
  }
  if (matched.polePerfect) {
    tasks.push(awardProgress(admin, userId, 'pole_prophet', { incrementBy: 1 }))
  }
  if (matched.podiumPerfect) {
    tasks.push(awardProgress(admin, userId, 'podium_perfect', { incrementBy: 1 }))
  }
  if (matched.fullGrid) {
    tasks.push(awardProgress(admin, userId, 'full_grid', { incrementBy: 1 }))
  }
  if (matched.lastPointExact) {
    tasks.push(awardProgress(admin, userId, 'last_point', { incrementBy: 1 }))
  }

  await Promise.all(tasks)
}

/**
 * Fired after a pool_members insert (own join, or accepting an invite).
 */
export async function handlePoolJoined(admin: SupabaseClient, userId: string): Promise<void> {
  const { count } = await admin
    .from('pool_members')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)

  await awardProgress(admin, userId, 'on_the_grid', { setValue: count ?? 0 })
}

/**
 * Fired after a pool_members insert, for the pool's owner (Team Principal
 * tracks the owner's pool, not the joining user).
 */
export async function handlePoolMemberAdded(admin: SupabaseClient, poolId: string): Promise<void> {
  const { data: pool } = await admin
    .from('pools')
    .select('created_by')
    .eq('id', poolId)
    .maybeSingle()

  if (!pool) return

  const { count } = await admin
    .from('pool_members')
    .select('id', { count: 'exact', head: true })
    .eq('pool_id', poolId)
    .neq('user_id', pool.created_by)

  await awardProgress(admin, pool.created_by, 'team_principal', { setValue: count ?? 0 })
}

interface SeasonRaceSession {
  session_key: number
  date_start: string
}

/**
 * Every Race session that has already locked (date_start in the past), in
 * order. Iron Man / DNF run across the whole timeline (not just one season)
 * since a streak spans a season change. Deliberately excludes future races:
 * a race that hasn't happened yet has no prediction because it isn't due
 * yet, not because anyone "missed" it — including it here would make the
 * next-scheduled race always look like a miss right after your last streak.
 */
async function getAllRaceSessions(admin: SupabaseClient): Promise<SeasonRaceSession[]> {
  const { data } = await admin
    .from('sessions')
    .select('session_key, date_start')
    .eq('session_name', 'Race')
    .lte('date_start', new Date().toISOString())
    .order('date_start', { ascending: true })

  return data ?? []
}

/** Race sessions for one season only — used for the 24/24 Season Ticket check. */
async function getSeasonRaceSessions(
  admin: SupabaseClient,
  year: number
): Promise<SeasonRaceSession[]> {
  const { data } = await admin
    .from('sessions')
    .select('session_key, date_start')
    .eq('session_name', 'Race')
    .eq('year', year)
    .order('date_start', { ascending: true })

  return data ?? []
}

/**
 * Iron Man (current streak), Season Ticket (24/24) and the secret DNF
 * (missed a race after a streak of 10) all fall out of the same
 * "which races did this user predict" lookup, so they're computed together
 * in one pass.
 */
async function handleRaceStreakAchievements(
  admin: SupabaseClient,
  userId: string,
  session: Pick<Session, 'session_key' | 'year'>
): Promise<void> {
  const allRaceSessions = await getAllRaceSessions(admin)
  const currentIndex = allRaceSessions.findIndex((s) => s.session_key === session.session_key)
  if (currentIndex === -1) return

  const sessionKeys = allRaceSessions.map((s) => s.session_key)
  const { data: userPredictions } = await admin
    .from('predictions')
    .select('session_key')
    .eq('user_id', userId)
    .in('session_key', sessionKeys)

  const predictedSet = new Set((userPredictions ?? []).map((p) => p.session_key as number))

  let streak = 0
  for (let i = currentIndex; i >= 0; i--) {
    if (predictedSet.has(allRaceSessions[i].session_key)) streak++
    else break
  }
  await awardProgress(admin, userId, 'iron_man', { setValue: streak })

  let bestStreakBeforeAGap = 0
  let running = 0
  for (let i = 0; i < currentIndex; i++) {
    if (predictedSet.has(allRaceSessions[i].session_key)) {
      running++
    } else {
      bestStreakBeforeAGap = Math.max(bestStreakBeforeAGap, running)
      running = 0
    }
  }
  if (bestStreakBeforeAGap >= 10) {
    await awardProgress(admin, userId, 'secret_dnf', { setValue: 1 })
  }

  const seasonRaceSessions = await getSeasonRaceSessions(admin, session.year)
  const currentIsLastRaceOfSeason = seasonRaceSessions.length > 0
    && seasonRaceSessions[seasonRaceSessions.length - 1].session_key === session.session_key
  const predictedAllSoFarThisSeason = seasonRaceSessions.every((s) => predictedSet.has(s.session_key))
  if (currentIsLastRaceOfSeason && predictedAllSoFarThisSeason) {
    await awardProgress(admin, userId, 'season_ticket', { setValue: 1 })
  }
}

async function handleDejaVu(
  admin: SupabaseClient,
  userId: string,
  session: Pick<Session, 'date_start'>,
  prediction: Prediction
): Promise<void> {
  const { data: priorSession } = await admin
    .from('sessions')
    .select('session_key')
    .eq('session_name', 'Race')
    .lt('date_start', session.date_start)
    .order('date_start', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!priorSession) return

  const { data: priorPrediction } = await admin
    .from('predictions')
    .select('position_1,position_2,position_3,position_4,position_5,position_6,position_7,position_8,position_9,position_10')
    .eq('user_id', userId)
    .eq('session_key', priorSession.session_key)
    .maybeSingle()

  if (!priorPrediction) return

  const current = getTop10(prediction)
  const prior = getTop10(priorPrediction)
  if (current.every((driver, i) => driver === prior[i])) {
    await awardProgress(admin, userId, 'secret_deja_vu', { setValue: 1 })
  }
}

async function handleLateBraker(
  admin: SupabaseClient,
  userId: string,
  session: Pick<Session, 'date_start'>
): Promise<void> {
  const msUntilLock = new Date(session.date_start).getTime() - Date.now()
  if (msUntilLock >= 0 && msUntilLock <= 5 * 60 * 1000) {
    await awardProgress(admin, userId, 'secret_late_braker', { setValue: 1 })
  }
}

async function handleBoxBox(admin: SupabaseClient, userId: string, sessionKey: number): Promise<void> {
  const { data, error } = await admin
    .rpc('increment_prediction_edit_count', { p_user_id: userId, p_session_key: sessionKey })
    .single<{ edit_count: number }>()

  if (error || !data) return
  if (data.edit_count >= 10) {
    await awardProgress(admin, userId, 'secret_box_box', { setValue: 1 })
  }
}

/**
 * Fired after a predictions upsert. Does its own targeted, indexed reads to
 * determine actual progress rather than trusting anything the client sent —
 * the caller only needs to tell us which session was just saved.
 */
export async function handlePredictionSaved(
  admin: SupabaseClient,
  userId: string,
  sessionKey: number,
  isEdit: boolean
): Promise<void> {
  const { data: session } = await admin
    .from('sessions')
    .select('session_key, session_name, date_start, year')
    .eq('session_key', sessionKey)
    .maybeSingle<Pick<Session, 'session_key' | 'session_name' | 'date_start' | 'year'>>()

  if (!session) return

  const { data: prediction } = await admin
    .from('predictions')
    .select('*')
    .eq('user_id', userId)
    .eq('session_key', sessionKey)
    .maybeSingle<Prediction>()

  if (!prediction) return

  const { count: totalPredictions } = await admin
    .from('predictions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
  await awardProgress(admin, userId, 'lights_out', { setValue: totalPredictions ?? 0 })

  const tasks: Promise<unknown>[] = [handleLateBraker(admin, userId, session)]

  if (session.session_name === 'Race') {
    tasks.push(handleRaceStreakAchievements(admin, userId, session))
    tasks.push(handleDejaVu(admin, userId, session, prediction))
  }
  if (isEdit) {
    tasks.push(handleBoxBox(admin, userId, sessionKey))
  }

  await Promise.all(tasks)
}
