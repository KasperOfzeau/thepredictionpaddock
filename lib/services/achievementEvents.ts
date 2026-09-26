'use client'

type AchievementEvent =
  | { event: 'prediction_saved'; sessionKey: number; isEdit: boolean }
  | { event: 'pool_joined' }
  | { event: 'pool_member_added'; poolId: string }

/**
 * Fire-and-forget notice to the server that a qualifying event just
 * happened. Never awaited by callers on purpose — achievement progress is
 * not part of the user-facing save flow, so a slow or failed check must
 * never block or fail the save itself. The route re-derives real progress
 * server-side; this call only says which event to look at.
 */
export function trackAchievementEvent(payload: AchievementEvent): void {
  fetch('/api/achievements/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => {})
}
