import type { Metadata } from 'next'
import type { Prediction, Session } from '@/lib/types'
import { unstable_cache } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import Nav from '@/components/Nav'
import GlobalLeaderboard from '@/components/GlobalLeaderboard'
import {
  getNextEventForPublic,
  getLatestStartedEventForPublic,
  getLastEventForPublic,
  canMakePredictionForPublic,
  isBeforeFirstRaceWeekendForPublic,
} from '@/lib/services/meetings'
import { getGlobalLeaderboard } from '@/lib/services/leaderboard'
import PreviousRaceCard from '@/components/PreviousRaceCard'
import HomeHero from '@/components/HomeHero'
import SeasonPredictionsBlock from '@/components/SeasonPredictionsBlock'
import InstagramFollowBlock from '@/components/InstagramFollowBlock'
import ExpansionRoadmapBlock from '@/components/ExpansionRoadmapBlock'
import FaqBlock from '@/components/FaqBlock'

type PoolMemberCount = { count: number }
type PoolInfoWithCount = {
  id: string
  name: string
  description: string | null
  created_at: string
  pool_members: PoolMemberCount[] | PoolMemberCount | null
}
type PoolInfo = Omit<PoolInfoWithCount, 'pool_members'>
type PoolMembership = {
  id: string
  role: string
  joined_at: string
  pools: PoolInfoWithCount | PoolInfoWithCount[] | null
}

export const metadata: Metadata = {
  title: "The Prediction Paddock",
  description: "Predict F1 race results and compete with your friends in pools",
}

const getCachedNextEventForPublic = unstable_cache(
  async () => getNextEventForPublic(),
  ['home-next-event-public'],
  { revalidate: 60 }
)

const getCachedLatestStartedEventForPublic = unstable_cache(
  async () => getLatestStartedEventForPublic(),
  ['home-latest-started-event-public'],
  { revalidate: 60 }
)

const getCachedLastEventForPublic = unstable_cache(
  async (before?: string) => getLastEventForPublic(before),
  ['home-last-event-public'],
  { revalidate: 60 }
)

const getCachedGlobalLeaderboard = unstable_cache(
  async (limit: number) => {
    try {
      return await getGlobalLeaderboard(limit)
    } catch (e) {
      console.error('Global leaderboard:', e)
      return []
    }
  },
  ['home-global-leaderboard'],
  { revalidate: 60 }
)

// Same value for every visitor; cache globally to avoid the DB+OpenF1 round-trip
// on every page render for logged-in users. Only primitive args go into the
// cache key so it stays stable across the API/DB shapes of Session.
const getCachedPredictionAvailability = unstable_cache(
  async (
    sessionKey: number,
    sessionName: string,
    sessionDateStart: string,
    sessionDateEnd: string,
    meetingKey: number,
  ) => {
    try {
      return await canMakePredictionForPublic(
        {
          session_key: sessionKey,
          session_name: sessionName,
          date_start: sessionDateStart,
          date_end: sessionDateEnd,
          meeting_key: meetingKey,
        } as Session,
        meetingKey,
      )
    } catch (e) {
      console.error('Prediction availability:', e)
      return { canPredict: false, reason: 'Availability unavailable' }
    }
  },
  ['home-prediction-availability'],
  { revalidate: 60 }
)

// Same value for every visitor; only changes when the season calendar shifts.
const getCachedIsBeforeFirstRaceWeekend = unstable_cache(
  async () => {
    try {
      return await isBeforeFirstRaceWeekendForPublic()
    } catch (e) {
      console.error('isBeforeFirstRaceWeekend:', e)
      return false
    }
  },
  ['home-is-before-first-race-weekend'],
  { revalidate: 60 }
)

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Kick off independent, read-heavy data in parallel. User-specific queries
  // that don't depend on the resolved hero/previous event start in the same
  // batch as the global cached fetches.
  const nextEventPromise = getCachedNextEventForPublic()
  const latestStartedEventPromise = getCachedLatestStartedEventForPublic()
  const lastFinishedEventPromise = getCachedLastEventForPublic()
  const leaderboardPromise = getCachedGlobalLeaderboard(5)
  const poolMembershipsPromise = user
    ? supabase
      .from('pool_members')
      .select(`
        id,
        role,
        joined_at,
        pools (
          id,
          name,
          description,
          created_at,
          pool_members(count)
        )
      `)
      .eq('user_id', user.id)
      .order('joined_at', { ascending: false })
    : Promise.resolve({ data: null as PoolMembership[] | null })
  const showSeasonPredictionsBlockPromise = user
    ? getCachedIsBeforeFirstRaceWeekend()
    : Promise.resolve(false)

  const [nextEvent, latestStartedEvent, lastFinishedEvent, leaderboard] = await Promise.all([
    nextEventPromise,
    latestStartedEventPromise,
    lastFinishedEventPromise,
    leaderboardPromise,
  ])

  const now = new Date()
  const latestStartedEventIsOngoing = latestStartedEvent
    ? new Date(latestStartedEvent.session.date_start) <= now
      && new Date(latestStartedEvent.session.date_end) > now
    : false

  const heroEvent = latestStartedEventIsOngoing
    ? latestStartedEvent
    : nextEvent ?? latestStartedEvent

  // If the hero event is the same as the latest finished event, look further
  // back so the "previous race" card doesn't duplicate the hero.
  const previousEventPromise =
    heroEvent
      && lastFinishedEvent
      && heroEvent.session.session_key === lastFinishedEvent.session.session_key
      ? getCachedLastEventForPublic(heroEvent.session.date_end)
      : Promise.resolve(lastFinishedEvent)

  // Now that we know the hero event we can also start the per-user prediction
  // queries in parallel with everything still in-flight above.
  const predictionAvailabilityPromise = user && heroEvent
    ? getCachedPredictionAvailability(
        heroEvent.session.session_key,
        heroEvent.session.session_name,
        heroEvent.session.date_start,
        heroEvent.session.date_end,
        heroEvent.meeting.meeting_key,
      )
    : Promise.resolve(
        { canPredict: false, reason: 'No upcoming race' } as { canPredict: boolean; reason?: string }
      )
  const nextPredictionPromise = user && heroEvent
    ? supabase
      .from('predictions')
      .select('id')
      .eq('user_id', user.id)
      .eq('session_key', heroEvent.session.session_key)
      .maybeSingle()
    : Promise.resolve({ data: null as { id: string } | null })

  // Trust `prediction.points` from the DB – it is kept fresh by the cached
  // global leaderboard, which refreshes every user's race points on its
  // 60-second cycle via getOrComputeSeasonPointsForUsers. So we only need a
  // single read here, no extra OpenF1 round-trip.
  const previousPredictionPromise: Promise<Prediction | null> = user
    ? previousEventPromise.then(async (event) => {
        if (!event) return null
        const { data } = await supabase
          .from('predictions')
          .select('*')
          .eq('user_id', user.id)
          .eq('session_key', event.session.session_key)
          .maybeSingle<Prediction>()
        return data ?? null
      })
    : Promise.resolve(null)

  const [
    previousEvent,
    nextEventPredictionAvailability,
    nextPredictionResult,
    previousPrediction,
    poolMembershipsResult,
    showSeasonPredictionsBlock,
  ] = await Promise.all([
    previousEventPromise,
    predictionAvailabilityPromise,
    nextPredictionPromise,
    previousPredictionPromise,
    poolMembershipsPromise,
    showSeasonPredictionsBlockPromise,
  ])

  const nextEventHasPrediction = !!nextPredictionResult.data
  const previousPoints = previousPrediction?.points ?? null

  // Normalize the combined pool query (Supabase nests relations as arrays
  // depending on cardinality, so flatten consistently).
  const poolsWithMemberCount = ((poolMembershipsResult.data || []) as PoolMembership[])
    .flatMap((membership) => {
      const poolWithCount = Array.isArray(membership.pools) ? membership.pools[0] : membership.pools
      if (!poolWithCount?.id) return []
      const countRow = Array.isArray(poolWithCount.pool_members)
        ? poolWithCount.pool_members[0]
        : poolWithCount.pool_members
      const pool: PoolInfo = {
        id: poolWithCount.id,
        name: poolWithCount.name,
        description: poolWithCount.description,
        created_at: poolWithCount.created_at,
      }
      return [{
        id: membership.id,
        role: membership.role,
        joined_at: membership.joined_at,
        pools: pool,
        memberCount: countRow?.count ?? 0,
      }]
    })

  return (
    <div className="min-h-112 sm:min-h-128 md:min-h-144 bg-carbon-black">
      <Nav />
      <main>
          {heroEvent ? (
            <HomeHero
              nextEvent={heroEvent}
              isLoggedIn={!!user}
              predictionAvailability={nextEventPredictionAvailability}
              hasPrediction={nextEventHasPrediction}
            />
          ) : null}

          <section className="max-w-7xl mx-auto px-6 pt-8 pb-4 flex flex-col gap-6">
            {showSeasonPredictionsBlock && (
              <SeasonPredictionsBlock show={true} />
            )}
            <InstagramFollowBlock />
          </section>

          <section className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-7xl mx-auto px-6 pt-6 pb-6">
            <div className="bg-white/5 rounded-xl border border-white/10 p-6">
              <div className="flex justify-between items-center gap-3 mb-4">
                <h3 className="text-2xl font-semibold text-white">My pools</h3>
                {user ? (
                  <Link
                    href="/pools/create"
                    className="shrink-0 inline-flex items-center gap-1.5 text-sm font-medium text-f1-red hover:underline"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                    New pool
                  </Link>
                ) : null}
              </div>
              {user ? (
                <div className="space-y-3">
                  {poolsWithMemberCount.length === 0 ? (
                    <p className="text-white/70 text-sm text-center">
                      <Link href="/pools/create" className="text-f1-red hover:underline">Create a pool</Link> or ask for an invitation.
                    </p>
                  ) : (
                    poolsWithMemberCount.map((membership) => (
                      <Link
                        key={membership.id}
                        href={`/pools/${membership.pools.id}`}
                        className="block border border-white/10 rounded-lg p-3 hover:border-f1-red hover:bg-white/5 transition-all text-left"
                      >
                        <div className="flex justify-between items-start gap-2">
                          <h4 className="text-base font-semibold text-white truncate">
                            {membership.pools.name}
                          </h4>
                          {membership.role === 'admin' && (
                            <span className="text-xs bg-f1-red/20 text-f1-red px-2 py-0.5 rounded shrink-0">
                              Admin
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-white/50 mt-2">👥 {membership.memberCount} members</p>
                      </Link>
                    ))
                  )}
                </div>
              ) : (
                <div className="relative">
                  <div className="space-y-3 blur-[2px] pointer-events-none select-none opacity-60">
                    {[
                      { name: 'DTS Believers Anonymous', members: 12 },
                      { name: 'We Crashed (Into Each Other)', members: 8 },
                      { name: 'Bono My Tyres Are Gone', members: 6 },
                      { name: 'No Michael No That’s So Not Right', members: 24 },
                      { name: 'GP2 Engine Support Group', members: 15 },
                    ].map((pool, i) => (
                      <div
                        key={i}
                        className="border border-white/10 rounded-lg p-3 bg-white/5"
                      >
                        <h4 className="text-base font-semibold text-white truncate">{pool.name}</h4>
                        <p className="text-xs text-white/50 mt-2">👥 {pool.members} members</p>
                      </div>
                    ))}
                  </div>
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-4">
                    <p className="text-white text-md font-bold">
                      Login or make an account to join or create pools
                    </p>
                    <div className="flex items-center gap-6">
                    <Link
                      href="/login"
                      className="px-6 py-2 rounded-full font-medium transition-colors border-4 border-f1-red text-white cursor-pointer text-center"
                    >
                      Login
                    </Link>
                    <Link
                      href="/register"
                      className="px-6 py-2 rounded-full font-medium transition-colors border-4 border-f1-red text-white cursor-pointer text-center"
                    >
                      Register
                    </Link>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="bg-white/5 rounded-xl border border-white/10 p-6 flex flex-col min-h-0">
              <h3 className="mb-4 shrink-0 text-2xl font-semibold text-white">Global leaderboard</h3>
              <div className="flex-1 min-h-0 flex flex-col">
                <GlobalLeaderboard entries={leaderboard} />
              </div>
              <Link
                href="/leaderboard"
                className="mt-4 inline-flex items-center justify-center self-start rounded-full border-2 border-f1-red px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-f1-red/20"
              >
                View all
              </Link>
            </div>
            <PreviousRaceCard
              lastEvent={previousEvent}
              hasPrediction={!!previousPrediction}
              points={previousPoints}
              isLoggedIn={!!user}
            />
          </section>

          <section className="max-w-7xl mx-auto px-6 pb-16">
            <FaqBlock />
          </section>

          <section className="max-w-7xl mx-auto px-6 pb-16">
            <ExpansionRoadmapBlock />
          </section>
      </main>
    </div>
  )
}