import Image from 'next/image'
import { ACHIEVEMENTS, type Achievement, type AchievementCategory } from '@/lib/achievements/catalog'
import type { UserAchievementProgress } from '@/lib/types'

const CATEGORY_LABELS: Record<AchievementCategory, string> = {
  'getting-started': 'Getting started',
  accuracy: 'Accuracy',
  consistency: 'Consistency',
  competition: 'Competition',
  secret: 'Secret',
}

const CATEGORY_ORDER: AchievementCategory[] = [
  'getting-started',
  'accuracy',
  'consistency',
  'competition',
  'secret',
]

function LockedIcon() {
  return (
    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/30 sm:h-16 sm:w-16">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="10" width="16" height="10" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </svg>
    </div>
  )
}

function AchievementCard({
  achievement,
  progress,
}: {
  achievement: Achievement
  progress: UserAchievementProgress | undefined
}) {
  const currentTier = progress?.current_tier ?? 0
  const currentValue = progress?.current_value ?? 0
  const isUnlocked = currentTier > 0
  const isHiddenSecret = achievement.secret && !isUnlocked

  const activeTier = achievement.tiers.find((t) => t.tier === currentTier)
  const nextTier = achievement.tiers.find((t) => t.tier === currentTier + 1)
  const isTiered = achievement.tiers.length > 1

  return (
    <div
      className={`flex items-center gap-4 rounded-2xl border p-4 transition-colors ${
        isUnlocked ? 'border-f1-red/30 bg-f1-red/5' : 'border-white/10 bg-white/5'
      }`}
    >
      {isHiddenSecret || !activeTier ? (
        <LockedIcon />
      ) : (
        <div className="relative h-14 w-14 shrink-0 sm:h-16 sm:w-16">
          <Image src={activeTier.icon} alt="" fill className="object-contain" />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <h3 className="font-semibold text-white">
          {isHiddenSecret ? '???' : achievement.label}
        </h3>
        <p className="mt-0.5 text-sm text-white/50">
          {isHiddenSecret ? 'Keep playing to discover this one.' : achievement.description}
        </p>
        {!isHiddenSecret && isTiered && nextTier && (
          <p className="mt-1 text-xs text-white/35">
            {currentValue} / {nextTier.threshold} for {nextTier.label}
          </p>
        )}
      </div>
    </div>
  )
}

/**
 * Full catalog, grouped by category, each card showing locked/unlocked/tier
 * state from `progressByAchievementId`. Shared by the current user's own
 * /achievements page and the public /profile/[username]/achievements page —
 * only the data source for that map differs (own RLS-readable rows vs. the
 * admin client reading someone else's public progress).
 */
export default function AchievementsGrid({
  progressByAchievementId,
}: {
  progressByAchievementId: Map<string, UserAchievementProgress>
}) {
  return (
    <div className="space-y-10">
      {CATEGORY_ORDER.map((category) => {
        const achievementsInCategory = ACHIEVEMENTS.filter((a) => a.category === category)
        if (!achievementsInCategory.length) return null

        return (
          <section key={category}>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-white/40">
              {CATEGORY_LABELS[category]}
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {achievementsInCategory.map((achievement) => (
                <AchievementCard
                  key={achievement.id}
                  achievement={achievement}
                  progress={progressByAchievementId.get(achievement.id)}
                />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}

export function countUnlocked(progressByAchievementId: Map<string, UserAchievementProgress>): number {
  return ACHIEVEMENTS.filter((a) => (progressByAchievementId.get(a.id)?.current_tier ?? 0) > 0).length
}
