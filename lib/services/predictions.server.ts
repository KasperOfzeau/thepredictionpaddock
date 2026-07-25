import 'server-only'
import { openf1Fetch } from '@/lib/services/openf1'
import type { Driver } from '@/lib/types'

function dedupeByDriverNumber(data: Driver[]): Driver[] {
  const byNumber = new Map<number, Driver>()
  data.forEach((d) => {
    if (!byNumber.has(d.driver_number)) byNumber.set(d.driver_number, d)
  })
  return Array.from(byNumber.values()).sort((a, b) => a.driver_number - b.driver_number)
}

async function fetchDriversForMeetingKey(meetingKey: number | 'latest'): Promise<Driver[]> {
  const res = await openf1Fetch(`/drivers?meeting_key=${meetingKey}`, { next: { revalidate: 60 } })
  if (!res.ok) return []
  return dedupeByDriverNumber(await res.json())
}

async function fetchDriversForSessionKey(sessionKey: number): Promise<Driver[]> {
  const res = await openf1Fetch(`/drivers?session_key=${sessionKey}`, { next: { revalidate: 60 } })
  if (!res.ok) return []
  return dedupeByDriverNumber(await res.json())
}

interface OpenF1SessionSummary {
  session_key: number
  date_start: string
  date_end: string
}

/**
 * Completed sessions for a meeting, most recently finished first.
 */
async function fetchCompletedSessionsForMeeting(meetingKey: number): Promise<OpenF1SessionSummary[]> {
  const res = await openf1Fetch(`/sessions?meeting_key=${meetingKey}`, { next: { revalidate: 60 } })
  if (!res.ok) return []

  const sessions: OpenF1SessionSummary[] = await res.json()
  const now = new Date()
  return sessions
    .filter((s) => s.date_end && new Date(s.date_end) <= now)
    .sort((a, b) => new Date(b.date_start).getTime() - new Date(a.date_start).getTime())
}

/**
 * Roster for an upcoming meeting. Uses the most recently completed session
 * of this weekend (Race > Qualifying > Practice 3 > Practice 2 > Practice 1,
 * whichever has finished) rather than the meeting-wide aggregate, so a
 * rookie who only drove Practice 1 doesn't linger in the list once the
 * regular driver is back for Practice 2 onward. Falls back to the most
 * recently completed meeting's roster when nothing has run yet this
 * weekend. Server-only: calls OpenF1 directly with the premium bearer token.
 */
export async function getDriverRosterForUpcomingMeeting(meetingKey: number): Promise<Driver[]> {
  const completedSessions = await fetchCompletedSessionsForMeeting(meetingKey)

  for (const s of completedSessions) {
    const drivers = await fetchDriversForSessionKey(s.session_key)
    if (drivers.length > 0) return drivers
  }

  return fetchDriversForMeetingKey('latest')
}
