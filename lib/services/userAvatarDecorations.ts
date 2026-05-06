import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

/** Tolerate the table not yet existing during early rollout. */
function isMissingUserDecorationsTableError(error: {
  message?: string
  code?: string
} | null) {
  if (!error) return false
  const msg = error.message?.toLowerCase() ?? ''
  return (
    error.code === '42P01'
    || msg.includes('user_avatar_decorations')
    || msg.includes('does not exist')
    || msg.includes('schema cache')
  )
}

/**
 * Returns the decoration ids that have been manually granted to `userId`
 * via the `user_avatar_decorations` table.
 */
export async function getManualAvatarDecorationGrantsForUser(
  userId: string,
  client?: SupabaseClient,
): Promise<string[]> {
  const supabase = client ?? (await createClient())
  const { data, error } = await supabase
    .from('user_avatar_decorations')
    .select('decoration_id')
    .eq('user_id', userId)

  if (error) {
    if (!isMissingUserDecorationsTableError(error)) {
      console.error('Error fetching user_avatar_decorations:', error)
    }
    return []
  }

  return (data ?? [])
    .map((row) => (row as { decoration_id?: string }).decoration_id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0)
}
