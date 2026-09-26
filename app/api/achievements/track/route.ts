import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { handlePredictionSaved, handlePoolJoined, handlePoolMemberAdded } from '@/lib/services/achievements'

/**
 * Intake for client-triggered achievement events. Predictions and pool
 * writes in this app happen straight from the browser via the anon
 * Supabase client (see lib/services/predictions.ts, CreatePoolForm,
 * InvitesList), so this route is what turns "a write just succeeded" into
 * an authenticated, server-side achievement check.
 *
 * The client only ever tells us WHICH event happened — never a progress
 * number. Every count used to decide tiers is re-derived here with a
 * targeted, indexed query against the real data, so a tampered client can
 * at most trigger a redundant recheck, never fake an unlock.
 */

type TrackEvent =
  | { event: 'prediction_saved'; sessionKey: number; isEdit: boolean }
  | { event: 'pool_joined' }
  | { event: 'pool_member_added'; poolId: string }

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: TrackEvent
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const admin = createAdminClient()

  try {
    switch (body.event) {
      case 'prediction_saved': {
        if (typeof body.sessionKey !== 'number') {
          return NextResponse.json({ error: 'sessionKey is required' }, { status: 400 })
        }
        await handlePredictionSaved(admin, user.id, body.sessionKey, Boolean(body.isEdit))
        break
      }
      case 'pool_joined': {
        await handlePoolJoined(admin, user.id)
        break
      }
      case 'pool_member_added': {
        if (typeof body.poolId !== 'string') {
          return NextResponse.json({ error: 'poolId is required' }, { status: 400 })
        }
        await handlePoolMemberAdded(admin, body.poolId)
        break
      }
      default:
        return NextResponse.json({ error: 'Unknown event' }, { status: 400 })
    }
  } catch (error) {
    console.error('Error tracking achievement event:', error)
    return NextResponse.json({ error: 'Failed to track event' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
