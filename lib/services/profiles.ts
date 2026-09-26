import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { getAdminClientIfAvailable } from '@/lib/supabase/admin'
import type { SupabaseClient } from '@supabase/supabase-js'

/** Row shape used by public-profile routes (subset of profiles.* plus normalized optional fields). */
export interface ProfilePublicRow {
  id: string
  username: string | null
  avatar_url: string | null
  full_name: string | null
  created_at: string | null
  bio: string | null
  avatar_decoration_id: string | null
  website_url: string | null
  showcased_achievement_ids: string[]
}

/**
 * Public profile by URL slug. Tries the service-role client first (bypasses
 * RLS for strangers viewing someone else's profile), then the session
 * client (works locally without SUPABASE_SERVICE_ROLE_KEY if RLS allows).
 * Uses select('*') so missing optional columns (e.g. before a migration
 * runs) don't break the query.
 */
export const getProfileByUsername = cache(async (username: string): Promise<ProfilePublicRow | null> => {
  const normalized = username.toLowerCase()
  const serverClient = await createClient()
  const admin = getAdminClientIfAvailable()
  const clients: SupabaseClient[] = admin ? [admin, serverClient] : [serverClient]

  for (const client of clients) {
    const { data, error } = await client.from('profiles').select('*').eq('username', normalized).maybeSingle()
    if (error) continue
    if (data) {
      const d = data as Record<string, unknown>
      return {
        ...d,
        bio: typeof d.bio === 'string' ? d.bio : null,
        avatar_decoration_id:
          typeof d.avatar_decoration_id === 'string' ? d.avatar_decoration_id : null,
        website_url: typeof d.website_url === 'string' ? d.website_url : null,
        showcased_achievement_ids: Array.isArray(d.showcased_achievement_ids)
          ? (d.showcased_achievement_ids as string[])
          : [],
      } as ProfilePublicRow
    }
  }
  return null
})
