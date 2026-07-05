import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import Nav from '@/components/Nav'
import AvatarWithDecoration from '@/components/AvatarWithDecoration'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getPredictionResultsForSession } from '@/lib/services/leaderboard'
import { getResultPageHref } from '@/lib/resultPage'

interface PageProps {
  params: Promise<{ sessionKey: string }>
}

export const metadata: Metadata = {
  title: 'All Results | The Prediction Paddock',
  description: 'View all prediction results for a race session.',
}

export default async function AllSessionResultsPage({ params }: PageProps) {
  const { sessionKey: sessionKeyParam } = await params
  const sessionKey = Number(sessionKeyParam)

  if (!Number.isInteger(sessionKey)) {
    notFound()
  }

  const supabase = await createClient()
  const admin = createAdminClient()
  const [
    { data: { user: currentUser } },
    { data: session },
    results,
  ] = await Promise.all([
    supabase.auth.getUser(),
    admin
      .from('sessions')
      .select('*')
      .eq('session_key', sessionKey)
      .maybeSingle(),
    getPredictionResultsForSession(sessionKey),
  ])

  if (!session) {
    notFound()
  }

  const { data: meeting } = await admin
    .from('meetings')
    .select('*')
    .eq('meeting_key', session.meeting_key)
    .maybeSingle()

  if (!meeting) {
    notFound()
  }

  const sessionDate = new Date(session.date_start).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
  const myResult = currentUser
    ? results.find((result) => result.user_id === currentUser.id)
    : null

  return (
    <div className="min-h-screen bg-carbon-black">
      <Nav />

      <main className="max-w-5xl mx-auto px-6 py-10 sm:py-12">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] text-white/70 sm:text-[11px] sm:tracking-[0.24em]">
              <span className="h-2 w-2 rounded-full bg-f1-red" />
              {session.session_name}
            </div>
            <h1 className="mt-3 text-3xl font-bold text-white sm:text-4xl">
              {meeting.meeting_name} results
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-white/65 sm:text-base">
              All prediction scores for this event, ranked by points.
            </p>
            <p className="mt-2 text-xs uppercase tracking-[0.16em] text-white/45 sm:text-sm sm:tracking-[0.2em]">
              {sessionDate}
            </p>
          </div>

          <div className="flex flex-wrap gap-2 sm:gap-3">
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/8 sm:px-5"
            >
              Back to home
            </Link>
            {myResult && (
              <Link
                href={getResultPageHref(sessionKey)}
                className="inline-flex items-center justify-center rounded-full border-2 border-f1-red px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-f1-red/20 sm:px-5"
              >
                View my results
              </Link>
            )}
          </div>
        </div>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-5 sm:p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-white/60">
              {results.length === 0
                ? 'No prediction results yet.'
                : `${results.length} prediction${results.length === 1 ? '' : 's'}`}
            </p>
          </div>

          {results.length === 0 ? (
            <p className="rounded-xl border border-white/10 bg-black/20 p-6 text-center text-white/55">
              Results will appear here once players have predictions for this event.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:gap-3">
              {results.map((result) => (
                <Link
                  key={result.user_id}
                  href={getResultPageHref(sessionKey, result.username)}
                  className="flex items-center gap-2 overflow-hidden rounded-lg border border-white/10 p-3 transition-colors hover:border-f1-red hover:bg-white/5 sm:gap-4"
                >
                  <div className="min-w-[28px] shrink-0 text-center text-sm text-white/60 tabular-nums">
                    {result.rank}
                  </div>

                  <AvatarWithDecoration
                    avatarUrl={result.avatar_url}
                    username={result.username}
                    decorationId={result.avatar_decoration_id}
                    size={40}
                    fallbackTextClassName="text-sm text-white/60"
                    alt={result.username}
                  />

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-white sm:text-base">
                      @{result.username}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="text-base font-bold text-white sm:text-lg">
                      {result.points ?? '—'}
                    </p>
                    <p className="text-xs text-white/50">
                      {result.points == null ? 'pending' : 'points'}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
