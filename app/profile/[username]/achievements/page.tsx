import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getAdminClientIfAvailable } from '@/lib/supabase/admin'
import Nav from '@/components/Nav'
import AchievementsGrid, { countUnlocked } from '@/components/AchievementsGrid'
import { ACHIEVEMENTS } from '@/lib/achievements/catalog'
import { getProfileByUsername } from '@/lib/services/profiles'
import { getAchievementProgressMapForUser } from '@/lib/services/achievements'

interface PageProps {
  params: Promise<{ username: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { username } = await params
  const profile = await getProfileByUsername(username)
  return {
    title: profile?.username ? `@${profile.username}'s achievements` : 'Achievements',
  }
}

export default async function ProfileAchievementsPage({ params }: PageProps) {
  const { username: usernameParam } = await params
  const supabase = await createClient()

  const [{ data: { user: currentUser } }, profile] = await Promise.all([
    supabase.auth.getUser(),
    getProfileByUsername(usernameParam),
  ])

  if (!profile) {
    notFound()
  }

  const isOwnProfile = !!currentUser && currentUser.id === profile.id

  // Reading someone else's achievement progress needs the admin client:
  // user_achievement_progress only grants self-select via RLS, same reason
  // the public profile page reaches for it for other users' predictions/points.
  const adminOptional = getAdminClientIfAvailable()
  const client = isOwnProfile ? supabase : (adminOptional ?? supabase)

  const progressByAchievementId = await getAchievementProgressMapForUser(client, profile.id)
  const unlockedCount = countUnlocked(progressByAchievementId)

  return (
    <div className="min-h-screen bg-carbon-black">
      <Nav />

      <main className="mx-auto max-w-3xl py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <Link
            href={`/profile/${profile.username}`}
            className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back to profile
          </Link>

          <h1 className="mt-3 text-3xl font-bold text-white">
            {isOwnProfile ? 'My achievements' : `@${profile.username}'s achievements`}
          </h1>
          <p className="mt-1 text-sm text-white/50">
            {unlockedCount} / {ACHIEVEMENTS.length} unlocked
          </p>

          <div className="mt-8">
            <AchievementsGrid progressByAchievementId={progressByAchievementId} />
          </div>
        </div>
      </main>
    </div>
  )
}
