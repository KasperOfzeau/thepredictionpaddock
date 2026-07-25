'use client'

import Link from 'next/link'
import { useState } from 'react'
import dynamic from 'next/dynamic'
import type { PredictionWithMeta } from '@/lib/services/userPredictions'
import type { SeasonPrediction } from '@/lib/types'
import { getResultPageHref } from '@/lib/resultPage'

const SeasonPredictionViewModal = dynamic(() => import('./SeasonPredictionViewModal'), {
  ssr: false,
})

interface UserPredictionsListProps {
  items: PredictionWithMeta[]
  seasonPrediction: SeasonPrediction | null
  seasonYear: number
  /** When false, empty state says "They haven't made...". Default true (own profile). */
  isOwnProfile?: boolean
  sharerName?: string | null
  sharerAvatarUrl?: string | null
  theme?: 'light' | 'dark'
}

export default function UserPredictionsList({
  items,
  seasonPrediction,
  seasonYear,
  isOwnProfile = true,
  sharerName = null,
  theme = 'light',
}: UserPredictionsListProps) {
  const [showSeasonModal, setShowSeasonModal] = useState(false)

  const hasSeason = seasonPrediction != null
  const hasRaces = items.length > 0
  const hasAny = hasSeason || hasRaces

  if (!hasAny) {
    return (
      <p className={theme === 'dark' ? 'text-sm text-white/60' : 'text-zinc-600 text-sm'}>
        {isOwnProfile ? "You haven't made any predictions yet." : "They haven't made any predictions yet."}
      </p>
    )
  }

  const containerClassName = theme === 'dark'
    ? 'grid grid-cols-1 gap-3'
    : 'divide-y divide-zinc-200'
  const itemClassName = theme === 'dark'
    ? 'flex w-full items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/5 p-4 text-left transition-all hover:border-f1-red hover:bg-white/7 cursor-pointer'
    : 'w-full text-left py-3 -mx-1 px-1 flex items-center justify-between gap-4 transition-colors hover:bg-zinc-50 rounded cursor-pointer'
  const titleClassName = theme === 'dark'
    ? 'font-medium text-white truncate'
    : 'font-medium text-carbon-black truncate'
  const metaClassName = theme === 'dark'
    ? 'text-sm text-white/50'
    : 'text-sm text-zinc-500'
  const pointsClassName = theme === 'dark'
    ? 'text-sm font-semibold text-white'
    : 'text-sm font-semibold text-carbon-black'
  const badgeBaseClassName =
    'inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em]'
  const getBadgeClassName = (isSprint: boolean) => {
    if (theme === 'dark') {
      return isSprint
        ? `${badgeBaseClassName} bg-amber-400/20 text-amber-300 ring-1 ring-amber-400/40`
        : `${badgeBaseClassName} bg-f1-red/25 text-white ring-1 ring-f1-red/50`
    }
    return isSprint
      ? `${badgeBaseClassName} bg-amber-100 text-amber-700 ring-1 ring-amber-300`
      : `${badgeBaseClassName} bg-f1-red/10 text-f1-red ring-1 ring-f1-red/30`
  }

  return (
    <>
      <ul className={containerClassName}>
        {hasSeason && (
          <li>
            <button
              type="button"
              onClick={() => setShowSeasonModal(true)}
              className={itemClassName}
            >
              <div className="min-w-0">
                <p className={theme === 'dark' ? 'font-medium text-white' : 'font-medium text-carbon-black'}>
                  {seasonYear} Season
                </p>
                <p className={metaClassName}>Season prediction</p>
              </div>
              <div className="shrink-0 flex items-center gap-2">
                {seasonPrediction.points != null && (
                  <span className={pointsClassName}>
                    {seasonPrediction.points} pts
                  </span>
                )}
                <svg className="h-4 w-4 text-f1-red" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>
          </li>
        )}
        {items.map((item) => {
          const dateLabel = new Date(item.dateStart).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })
          const isSprint = item.sessionName === 'Sprint'
          const href = getResultPageHref(
            item.sessionKey,
            !isOwnProfile ? sharerName : null
          )
          return (
            <li key={item.prediction.id}>
              <Link
                href={href}
                className={itemClassName}
              >
                <div className="min-w-0">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
                    <span className={`${getBadgeClassName(isSprint)} order-1 self-start sm:order-2 sm:self-auto`}>
                      {isSprint ? 'Sprint' : 'Race'}
                    </span>
                    <p className={`${titleClassName} order-2 sm:order-1`}>
                      {item.meetingName}
                    </p>
                  </div>
                  <p className={metaClassName}>
                    {dateLabel}
                  </p>
                </div>
                <div className="shrink-0 flex items-center gap-2">
                  {item.points != null && (
                    <span className={pointsClassName}>
                      {item.points} pts
                    </span>
                  )}
                  <svg className="h-4 w-4 text-f1-red" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            </li>
          )
        })}
      </ul>

      {seasonPrediction && (
        <SeasonPredictionViewModal
          isOpen={showSeasonModal}
          onClose={() => setShowSeasonModal(false)}
          seasonPrediction={seasonPrediction}
          seasonYear={seasonYear}
        />
      )}
    </>
  )
}
