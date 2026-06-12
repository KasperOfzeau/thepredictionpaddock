import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveReferralDecorationId } from '@/lib/referrals'

/** Postgres unique_violation – the grant already exists, treat as success. */
const UNIQUE_VIOLATION = '23505'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { code?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const code = typeof body.code === 'string' ? body.code : null
  const decorationId = resolveReferralDecorationId(code)

  if (!decorationId) {
    return NextResponse.json({ error: 'Unknown referral code' }, { status: 400 })
  }

  let admin
  try {
    admin = createAdminClient()
  } catch (err) {
    console.error('Referral claim: admin client unavailable:', err)
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }

  const { error } = await admin.from('user_avatar_decorations').upsert(
    {
      user_id: user.id,
      decoration_id: decorationId,
    },
    { onConflict: 'user_id,decoration_id', ignoreDuplicates: true },
  )

  if (error && error.code !== UNIQUE_VIOLATION) {
    console.error('Referral claim: failed to grant decoration:', error)
    return NextResponse.json({ error: 'Failed to grant decoration' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
