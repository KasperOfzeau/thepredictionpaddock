import type { Metadata } from 'next'
import { cache } from 'react'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import { getAdminClientIfAvailable } from '@/lib/supabase/admin'
import type { SupabaseClient } from '@supabase/supabase-js'
import Nav from '@/components/Nav'
import { getRecentPredictionsForUser } from '@/lib/services/userPredictions'
import { getGlobalLeaderboardRankForUser } from '@/lib/services/leaderboard'
import { getGarageForUser } from '@/lib/services/garage'
import UserPredictionsList from '@/components/UserPredictionsList'
import AvatarWithDecoration from '@/components/AvatarWithDecoration'

interface PageProps {
  params: Promise<{ username: string }>
}

/** Row used by public profile route (subset of profiles.* plus normalized bio) */
interface ProfilePublicRow {
  id: string
  username: string | null
  avatar_url: string | null
  full_name: string | null
  created_at: string | null
  bio: string | null
  avatar_decoration_id: string | null
}

const stripeOverlayStyle = {
  backgroundImage:
    'repeating-linear-gradient(115deg, transparent 0 14px, rgba(255,255,255,0.06) 14px 16px)',
} as const

function colourToCss(colour: string | null | undefined) {
  if (!colour) return '#ffffff'
  return colour.startsWith('#') ? colour : `#${colour}`
}

function formatDriverName(name: string | null | undefined) {
  return name
    ?.toLowerCase()
    .replace(/\b\p{L}/gu, (letter) => letter.toUpperCase())
    ?? ''
}

function LockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
      />
    </svg>
  )
}

/**
 * Public profile by URL slug. Tries service-role client first (bypasses RLS for strangers),
 * then the session client (works locally without SUPABASE_SERVICE_ROLE_KEY if RLS allows).
 * Uses select('*') so missing optional columns (e.g. before migrations) do not break the query.
 */
const getProfileByUsername = cache(async (username: string) => {
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
      } as ProfilePublicRow
    }
  }
  return null
})

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { username } = await params
  const profile = await getProfileByUsername(username)
  const displayName = profile?.username ? `@${profile.username}` : undefined
  return {
    title: profile ? `${displayName} | Profile` : 'Profile',
  }
}

export default async function ProfileByUsernamePage({ params }: PageProps) {
  const { username: usernameParam } = await params
  const supabase = await createClient()

  const { data: { user: currentUser } } = await supabase.auth.getUser()

  const profile = await getProfileByUsername(usernameParam)
  if (!profile) {
    notFound()
  }

  const isOwnProfile = !!currentUser && currentUser.id === profile.id

  const shareUsername = profile.username ?? null

  const currentSeasonYear =
    new Date().getMonth() === 0 ? new Date().getFullYear() - 1 : new Date().getFullYear()

  const adminOptional = getAdminClientIfAvailable()
  if (!isOwnProfile && !adminOptional) {
    console.warn(
      '[profile] SUPABASE_SERVICE_ROLE_KEY not available at runtime – other users’ season predictions will be hidden. Check Vercel env vars and redeploy.'
    )
  }
  const clientForSeason = adminOptional ?? supabase
  const adminClient: SupabaseClient = adminOptional ?? supabase

  const [recentPredictions, seasonRes, rankInfo, predictionCountRes, maxPointsRes, garage] = await Promise.all([
    getRecentPredictionsForUser(profile.id, 5, adminClient),
    clientForSeason
      .from('season_predictions')
      .select('*')
      .eq('user_id', profile.id)
      .eq('season_year', currentSeasonYear)
      .maybeSingle(),
    getGlobalLeaderboardRankForUser(profile.id),
    adminClient.from('predictions').select('*', { count: 'exact', head: true }).eq('user_id', profile.id),
    adminClient
      .from('predictions')
      .select('points')
      .eq('user_id', profile.id)
      .not('points', 'is', null),
    getGarageForUser(profile.id, currentSeasonYear, adminClient),
  ])

  const seasonPrediction = seasonRes.data ?? null
  const predictionCount = predictionCountRes.count ?? 0
  const pointsRows = maxPointsRes.data ?? []
  const bestRacePoints =
    pointsRows.length > 0 ? Math.max(...pointsRows.map((r) => r.points ?? 0)) : null

  const memberSinceDate =
    profile.created_at ??
    (isOwnProfile && currentUser ? currentUser.created_at : null)

  const memberSinceLabel = memberSinceDate
    ? new Date(memberSinceDate).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : null

  const achievementPlaceholders = Array.from({ length: 6 }, (_, i) => i)

  const bioText = profile.bio?.trim() ?? ''
  const hasBio = bioText.length > 0
  const hasGarage = Boolean(garage?.favorite_driver_number || garage?.favorite_team_name)

  return (
    <div className="min-h-screen bg-carbon-black">
      <Nav />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 pb-16">
        {/* Hero / driver card */}
        <section className="relative mt-6 overflow-hidden rounded-3xl border border-white/10 bg-white/5">
          <div className="relative h-32 sm:h-44 bg-linear-to-br from-f1-red/25 via-white/5 to-transparent">
            <div className="absolute inset-0 opacity-20" style={stripeOverlayStyle} />
            <span className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/40 px-3 py-1 text-[10px] uppercase tracking-[0.24em] text-white/70 backdrop-blur-sm">
              <LockIcon className="h-3 w-3 shrink-0 text-white/60" />
              Banner — coming soon · unlock via achievements
            </span>
          </div>

          <div className="-mt-12 flex flex-col gap-5 px-5 pb-0 sm:px-6 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-end">
              <AvatarWithDecoration
                avatarUrl={profile.avatar_url}
                username={profile.username}
                decorationId={profile.avatar_decoration_id}
                size={112}
                avatarClassName="shadow-[0_0_0_4px_rgba(255,24,1,0.35)] ring-4 ring-carbon-black"
                fallbackTextClassName="text-4xl text-white/50"
                alt={profile.username ? `@${profile.username}` : 'Profile'}
              />
              <div className="min-w-0 text-center sm:pb-1 sm:text-left">
                <h1 className="text-3xl font-bold text-white sm:text-4xl">
                  @{profile.username}
                </h1>
                {profile.full_name ? (
                  <p className="mt-3 text-white/60">{profile.full_name}</p>
                ) : null}
                <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                  {rankInfo ? (
                    <span className="inline-flex items-center rounded-full border border-white/10 bg-white/6 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-white/70">
                      Global rank #{rankInfo.rank}
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full border border-white/10 bg-white/6 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-white/50">
                      Unranked
                    </span>
                  )}
                  <span className="inline-flex items-center rounded-full border border-white/10 bg-white/6 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-white/70">
                    Member since {memberSinceLabel ?? '—'}
                  </span>
                </div>
              </div>
            </div>

            {isOwnProfile ? (
              <div className="flex flex-wrap items-center justify-center gap-3 sm:justify-end sm:pb-1">
                <Link
                  href="/settings"
                  className="inline-flex items-center justify-center rounded-full border-2 border-f1-red px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-f1-red/20"
                >
                  Edit profile
                </Link>
              </div>
            ) : null}
          </div>

          <div className="mt-6 border-t border-white/10 px-5 pb-6 pt-6 sm:mt-8 sm:px-6">
            {hasBio ? (
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/85">{bioText}</p>
            ) : (
              <p className="text-sm italic text-white/45">No bio yet.</p>
            )}
          </div>
        </section>

        {/* Stats */}
        <section className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-white/6 p-4 text-center sm:text-left">
            <p className="text-[11px] uppercase tracking-[0.24em] text-white/45">Predictions made</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums text-white">{predictionCount}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/6 p-4 text-center sm:text-left">
            <p className="text-[11px] uppercase tracking-[0.24em] text-white/45">Season points</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums text-white">
              {rankInfo?.total_points ?? '—'}
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/6 p-4 text-center sm:text-left">
            <p className="text-[11px] uppercase tracking-[0.24em] text-white/45">Best race score</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums text-white">
              {bestRacePoints != null ? `${bestRacePoints} pts` : '—'}
            </p>
          </div>
        </section>

        {/* Garage */}
        {(isOwnProfile || hasGarage) ? (
        <section className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-white">Garage</h2>
              <p className="mt-1 text-sm text-white/55">
                Favorite driver &amp; team for the {currentSeasonYear} season.
              </p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="min-h-[120px] rounded-xl border border-white/10 bg-white/5 p-4">
              {garage?.favorite_driver_number ? (
                <div className="flex h-full items-center gap-3">
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full border border-white/10 bg-white/10">
                    {garage.favorite_driver_headshot_url ? (
                      <Image
                        src={garage.favorite_driver_headshot_url}
                        alt={garage.favorite_driver_name ?? 'Favorite driver'}
                        fill
                        className="object-cover"
                        sizes="64px"
                      />
                    ) : (
                      <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white/45">
                        #{garage.favorite_driver_number}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-white/40">
                      Favorite driver
                    </p>
                    <p className="mt-1 truncate font-semibold text-white">
                      #{garage.favorite_driver_number} {formatDriverName(garage.favorite_driver_name)}
                    </p>
                    {garage.favorite_driver_team_name ? (
                      <div className="mt-1 flex items-center gap-2 text-sm text-white/55">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: colourToCss(garage.favorite_driver_team_colour) }}
                        />
                        <span className="truncate">{garage.favorite_driver_team_name}</span>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="flex h-full min-h-[88px] flex-col items-center justify-center text-center">
                  <LockIcon className="mb-2 h-8 w-8 text-white/25" />
                  <p className="text-sm font-medium text-white/65">Favorite driver</p>
                  <p className="mt-1 text-xs text-white/40">
                    {isOwnProfile ? (
                      <Link href="/settings" className="text-f1-red hover:text-f1-red-hover">
                        Set your garage in settings
                      </Link>
                    ) : (
                      'Garage not set for this season.'
                    )}
                  </p>
                </div>
              )}
            </div>
            <div className="min-h-[120px] rounded-xl border border-white/10 bg-white/5 p-4">
              {garage?.favorite_team_name ? (
                <div className="flex h-full items-center gap-3">
                  <span
                    className="h-16 w-2 rounded-full"
                    style={{ backgroundColor: colourToCss(garage.favorite_team_colour) }}
                  />
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-white/40">
                      Favorite team
                    </p>
                    <p className="mt-1 truncate font-semibold text-white">{garage.favorite_team_name}</p>
                  </div>
                </div>
              ) : (
                <div className="flex h-full min-h-[88px] flex-col items-center justify-center text-center">
                  <LockIcon className="mb-2 h-8 w-8 text-white/25" />
                  <p className="text-sm font-medium text-white/65">Favorite team</p>
                  <p className="mt-1 text-xs text-white/40">
                    {isOwnProfile ? (
                      <Link href="/settings" className="text-f1-red hover:text-f1-red-hover">
                        Set your garage in settings
                      </Link>
                    ) : (
                      'Garage not set for this season.'
                    )}
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>
        ) : null}

        {/* Trophy cabinet */}
        <section className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5 sm:p-6">
          <h2 className="text-xl font-bold text-white">Trophy cabinet</h2>
          <p className="mt-1 text-sm text-white/55">Earn badges by predicting and competing.</p>
          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {achievementPlaceholders.map((i) => (
              <li
                key={i}
                className="group rounded-xl border border-white/10 bg-white/6 p-4 transition-all hover:border-f1-red/50 hover:shadow-[0_0_24px_-4px_rgba(255,24,1,0.35)]"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-white/35 group-hover:text-white/50">
                  <LockIcon className="h-6 w-6" />
                </div>
                <p className="mt-3 font-semibold text-white/80">???</p>
                <p className="mt-1 text-xs text-white/40">Locked</p>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-white/45">
            Achievements coming soon — earn them by predicting races and finishing seasons.
          </p>
        </section>

        {/* Predictions */}
        <section className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5 sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-bold text-white">
              {isOwnProfile ? 'My predictions' : 'Predictions'}
            </h2>
            {isOwnProfile ? (
              <Link
                href="/predictions"
                className="inline-flex items-center rounded-full border-2 border-f1-red px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-f1-red/20"
              >
                See all
              </Link>
            ) : null}
          </div>
          <UserPredictionsList
            items={recentPredictions}
            seasonPrediction={seasonPrediction}
            seasonYear={currentSeasonYear}
            isOwnProfile={isOwnProfile}
            sharerName={shareUsername}
            sharerAvatarUrl={profile.avatar_url}
            theme="dark"
          />
        </section>
      </main>
    </div>
  )
}
