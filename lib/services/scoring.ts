import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { openf1Fetch } from '@/lib/services/openf1'
import { handlePointsFinalized } from '@/lib/services/achievements'
import type { Prediction } from '@/lib/types'
import type { SupabaseClient } from '@supabase/supabase-js'

const OPENF1_FETCH_OPTIONS = { next: { revalidate: 60 } } as const
const POINTS_CORRECT_POSITION = 5
const POINTS_IN_TOP_10 = 1

function getPredictedOrder(prediction: Prediction): number[] {
  return [
    prediction.position_1,
    prediction.position_2,
    prediction.position_3,
    prediction.position_4,
    prediction.position_5,
    prediction.position_6,
    prediction.position_7,
    prediction.position_8,
    prediction.position_9,
    prediction.position_10,
  ]
}

export function calculatePoints(prediction: Prediction, resultOrder: number[]): number {
  const predOrder = getPredictedOrder(prediction)
  const top10Set = new Set(resultOrder.slice(0, 10))
  let points = 0
  for (let i = 0; i < Math.min(10, resultOrder.length); i++) {
    const predictedDriver = predOrder[i]
    if (predictedDriver === resultOrder[i]) {
      points += POINTS_CORRECT_POSITION
    } else if (top10Set.has(predictedDriver)) {
      points += POINTS_IN_TOP_10
    }
  }
  return points
}

export interface MatchedAchievements {
  polePerfect: boolean
  podiumPerfect: boolean
  fullGrid: boolean
  lastPointExact: boolean
}

/**
 * Which exact-position achievements this prediction satisfies against a
 * (10-long) result order. Needs the actual matched positions, not just the
 * points total, since e.g. 5 points could be one exact match or five
 * top-10-but-wrong-slot hits.
 */
export function getMatchedAchievements(prediction: Prediction, resultOrder: number[]): MatchedAchievements {
  const predOrder = getPredictedOrder(prediction)
  const top10Set = new Set(resultOrder.slice(0, 10))
  return {
    polePerfect: predOrder[0] === resultOrder[0],
    podiumPerfect: predOrder.slice(0, 3).every((driver, i) => driver === resultOrder[i]),
    fullGrid: predOrder.every((driver) => top10Set.has(driver)),
    lastPointExact: predOrder[9] === resultOrder[9],
  }
}

/**
 * Fetch race result (driver numbers in finish order 1–10) from OpenF1.
 * Uses session_result endpoint: top 10 by position.
 * @see https://api.openf1.org/v1/session_result?session_key=...&position<=10
 */
export async function getRaceResultBySessionKey(sessionKey: number): Promise<number[] | null> {
  try {
    const res = await openf1Fetch(
      `/session_result?session_key=${sessionKey}&position<=10`,
      OPENF1_FETCH_OPTIONS
    )
    if (!res.ok) return null

    const data = await res.json()
    if (!Array.isArray(data) || data.length < 10) return null

    type Row = { position: number; driver_number: number }
    const sorted = (data as Row[]).sort((a, b) => a.position - b.position)
    return sorted.slice(0, 10).map((row) => row.driver_number)
  } catch {
    return null
  }
}

async function hasSessionEnded(
  sessionKey: number,
  supabase: SupabaseClient
): Promise<boolean> {
  const { data: session } = await supabase
    .from('sessions')
    .select('date_start, date_end')
    .eq('session_key', sessionKey)
    .maybeSingle()

  if (!session) return false

  const endIso = session.date_end ?? session.date_start
  if (!endIso) return false

  return new Date(endIso) <= new Date()
}

async function savePredictionPoints(
  prediction: Prediction,
  points: number,
  supabase: SupabaseClient
): Promise<boolean> {
  if (prediction.points === points) return false

  const { error } = await supabase
    .from('predictions')
    .update({ points, updated_at: new Date().toISOString() })
    .eq('id', prediction.id)

  if (error) {
    console.error('Error saving prediction points:', error)
    return false
  }

  return true
}

export interface PredictionPointsRefreshResult {
  points: number | null
  updated: boolean
}

/**
 * Recalculate and persist points when OpenF1 has a complete result.
 * Returns null points while the session is unfinished or the result is unavailable.
 */
export async function refreshPointsForPrediction(
  prediction: Prediction | null,
  sessionKey: number,
  supabaseAdmin?: SupabaseClient
): Promise<PredictionPointsRefreshResult> {
  if (!prediction) return { points: null, updated: false }

  const supabase = supabaseAdmin ?? (await createClient())
  const sessionEnded = await hasSessionEnded(sessionKey, supabase)
  if (!sessionEnded) return { points: null, updated: false }

  const resultOrder = await getRaceResultBySessionKey(sessionKey)
  if (!resultOrder || resultOrder.length < 10) return { points: null, updated: false }

  const points = calculatePoints(prediction, resultOrder)
  const updated = await savePredictionPoints(prediction, points, supabase)
  if (updated) {
    const matched = getMatchedAchievements(prediction, resultOrder)
    await handlePointsFinalized(createAdminClient(), prediction, resultOrder, points, matched)
  }
  return { points, updated }
}

/**
 * Recalculate and persist points for every prediction in a finished session.
 * OpenF1 is fetched once for the session, then all matching predictions are updated.
 */
export async function refreshPointsForSession(
  sessionKey: number,
  supabaseAdmin?: SupabaseClient
): Promise<Set<string>> {
  const updatedUserIds = new Set<string>()
  const supabase = supabaseAdmin ?? (await createClient())
  const sessionEnded = await hasSessionEnded(sessionKey, supabase)
  if (!sessionEnded) return updatedUserIds

  const resultOrder = await getRaceResultBySessionKey(sessionKey)
  if (!resultOrder || resultOrder.length < 10) return updatedUserIds

  const { data: rows, error } = await supabase
    .from('predictions')
    .select('*')
    .eq('session_key', sessionKey)

  if (error || !rows?.length) {
    if (error) console.error('Error fetching predictions for scoring:', error)
    return updatedUserIds
  }

  const admin = createAdminClient()
  await Promise.all(
    rows.map(async (row) => {
      const prediction = row as Prediction
      const points = calculatePoints(prediction, resultOrder)
      const updated = await savePredictionPoints(prediction, points, supabase)
      if (updated) {
        updatedUserIds.add(prediction.user_id)
        const matched = getMatchedAchievements(prediction, resultOrder)
        await handlePointsFinalized(admin, prediction, resultOrder, points, matched)
      }
    })
  )

  return updatedUserIds
}

/**
 * Get points earned for a user's prediction for a given race session.
 * Recalculates from OpenF1 whenever the result is available, then saves and returns.
 * Returns null if no result available yet or no prediction.
 * Pass supabaseAdmin when updating another user's prediction (bypasses RLS).
 */
export async function getPointsForPrediction(
  prediction: Prediction | null,
  sessionKey: number,
  supabaseAdmin?: SupabaseClient
): Promise<number | null> {
  const { points } = await refreshPointsForPrediction(
    prediction,
    sessionKey,
    supabaseAdmin
  )
  return points
}
