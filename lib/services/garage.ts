import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import type { ProfileGarage } from '@/lib/types'

export function getCurrentGarageSeasonYear(date = new Date()) {
  return date.getMonth() === 0 ? date.getFullYear() - 1 : date.getFullYear()
}

function isMissingGarageTableError(error: { message?: string; code?: string } | null) {
  if (!error) return false
  const msg = error.message?.toLowerCase() ?? ''
  return (
    error.code === '42P01'
    || msg.includes('profile_garage')
    || msg.includes('does not exist')
    || msg.includes('schema cache')
  )
}

export async function getGarageForUser(
  userId: string,
  seasonYear: number,
  client?: SupabaseClient
): Promise<ProfileGarage | null> {
  const supabase = client ?? (await createClient())
  const { data, error } = await supabase
    .from('profile_garage')
    .select('*')
    .eq('user_id', userId)
    .eq('season_year', seasonYear)
    .maybeSingle()

  if (error) {
    if (!isMissingGarageTableError(error)) {
      console.error('Error fetching profile garage:', error)
    }
    return null
  }

  return (data as ProfileGarage | null) ?? null
}
