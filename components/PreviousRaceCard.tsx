import Image from 'next/image'
import Link from 'next/link'
import type { NextEvent } from '@/lib/types'
import type { TopPredictor } from '@/lib/services/leaderboard'
import { getAllResultPageHref, getResultPageHref } from '@/lib/resultPage'
import AvatarWithDecoration from '@/components/AvatarWithDecoration'

function getCircuitImageSrc(circuitShortName: string): string {
  const base = circuitShortName.replace(/\s+/g, '-')
  const hasExtension = /\.(jpe?g|png|webp)$/i.test(base)
  return `/images/circuits/${hasExtension ? base : `${base}.jpg`}`
}

const PODIUM_MEDALS = ['🥇', '🥈', '🥉']

interface PreviousRaceCardProps {
  lastEvent: NextEvent | null
  hasPrediction: boolean
  points: number | null
  /** When true, show prediction/points section; when false, only race name + date */
  isLoggedIn?: boolean
  /** Top 3 predictions for the previous event, ranked by points. */
  topPredictors?: TopPredictor[]
}

export default function PreviousRaceCard({
  lastEvent,
  hasPrediction,
  points,
  isLoggedIn = false,
  topPredictors = [],
}: PreviousRaceCardProps) {
  const sessionLabel = 'Previous event'
  const isSprint = lastEvent?.session.session_name === 'Sprint'
  const noPredictionLabel = isSprint
    ? 'No prediction made for this sprint'
    : 'No prediction made for this race'

  return (
    <div className="relative flex flex-col rounded-xl border border-white/10 p-6 overflow-hidden min-h-[450px] bg-white/5">
      {lastEvent && (
        <div className="absolute inset-0 opacity-25">
          <Image
            src={getCircuitImageSrc(lastEvent.meeting.circuit_short_name)}
            alt=""
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 33vw"
          />
        </div>
      )}

      <h3 className="relative z-10 text-2xl font-semibold text-white mb-4">{sessionLabel}</h3>

      <div className="relative z-10 flex flex-1 flex-col">
        <div className="flex flex-col items-center text-center">
          {lastEvent && (
            <span
              className={`mb-2.5 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] ${
                isSprint
                  ? 'bg-amber-400/20 text-amber-300 ring-1 ring-amber-400/40'
                  : 'bg-f1-red/25 text-white ring-1 ring-f1-red/50'
              }`}
            >
              {isSprint ? 'Sprint' : 'Race'}
            </span>
          )}
          <h4 className="text-white/90 text-3xl font-bold leading-tight">
            {lastEvent?.meeting.meeting_name ?? '—'}
          </h4>
          {lastEvent && (
            <p className="text-white/60 mt-1.5 text-sm">
              {new Date(lastEvent.session.date_start).toLocaleDateString('en-GB', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </p>
          )}
        </div>

        {topPredictors.length > 0 && (
          <div className="mt-5">
            <p className="text-xs uppercase tracking-[0.16em] text-white/50 mb-2.5 text-center">
              Best predictions
            </p>
            <div className="space-y-2">
              {topPredictors.map((predictor, index) => (
                <Link
                  key={predictor.user_id}
                  href={`/profile/${encodeURIComponent(predictor.username)}`}
                  className="flex items-center gap-3 rounded-lg border border-white/10 bg-black/30 px-3 py-2 transition-colors hover:border-f1-red hover:bg-white/5"
                >
                  <span className="w-6 shrink-0 text-center text-lg leading-none">
                    {PODIUM_MEDALS[index] ?? index + 1}
                  </span>
                  <AvatarWithDecoration
                    avatarUrl={predictor.avatar_url}
                    username={predictor.username}
                    decorationId={predictor.avatar_decoration_id}
                    size={32}
                    fallbackTextClassName="text-xs text-white/60"
                    alt={predictor.username}
                  />
                  <span className="flex-1 min-w-0 truncate text-sm font-semibold text-white">
                    @{predictor.username}
                  </span>
                  <span className="shrink-0 text-sm font-bold text-white tabular-nums">
                    {predictor.points} pts
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {isLoggedIn && lastEvent && (
          <div className="mt-auto flex flex-col items-center gap-3 pt-5">
            {hasPrediction ? (
              <>
                <p className="text-white/80 text-sm">
                  Your points:{' '}
                  <span className="font-bold text-white">{points !== null ? points : '—'}</span>
                </p>
                <Link
                  href={getResultPageHref(lastEvent.session.session_key)}
                  className="px-5 py-2 rounded-full font-medium transition-colors border-2 border-f1-red text-white hover:bg-f1-red/20 cursor-pointer"
                >
                  View my results
                </Link>
              </>
            ) : (
              <p className="text-white/50 text-sm">{noPredictionLabel}</p>
            )}
            <Link
              href={getAllResultPageHref(lastEvent.session.session_key)}
              className="px-5 py-2 rounded-full font-medium transition-colors border border-white/20 text-white hover:bg-white/10 cursor-pointer"
            >
              View all results
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
