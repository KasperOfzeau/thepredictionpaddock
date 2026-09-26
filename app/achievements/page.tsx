import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Nav from '@/components/Nav'
import AchievementsGrid, { countUnlocked } from '@/components/AchievementsGrid'
import { ACHIEVEMENTS } from '@/lib/achievements/catalog'
import { getAchievementProgressMapForUser } from '@/lib/services/achievements'

export const metadata: Metadata = {
  title: 'Achievements',
}

export default async function AchievementsPage() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/login')
  }

  const progressByAchievementId = await getAchievementProgressMapForUser(supabase, user.id)
  const unlockedCount = countUnlocked(progressByAchievementId)

  return (
    <div className="min-h-screen bg-carbon-black">
      <Nav />

      <main className="mx-auto max-w-3xl py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <h1 className="text-3xl font-bold text-white">Achievements</h1>
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
