'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { resolveReferralDecorationId } from '@/lib/referrals'

const STORAGE_KEY = 'pp_pending_referral'

/**
 * Captures a `?ref=<code>` referral from the URL on any page, persists it in
 * localStorage, and claims it (granting the linked avatar decoration) as soon
 * as the visitor is logged in. Renders nothing.
 */
export default function ReferralHandler() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const refFromUrl = params.get('ref')
    if (resolveReferralDecorationId(refFromUrl)) {
      window.localStorage.setItem(STORAGE_KEY, refFromUrl!.trim().toLowerCase())
    }

    const supabase = createClient()
    let claiming = false

    const claimPending = async () => {
      if (claiming) return
      const code = window.localStorage.getItem(STORAGE_KEY)
      if (!code) return

      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      claiming = true
      try {
        const res = await fetch('/api/referral/claim', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        })
        // Clear on success or on a permanent rejection (unknown code) so we
        // don't keep retrying. Keep it on transient (5xx) failures.
        if (res.ok || res.status === 400) {
          window.localStorage.removeItem(STORAGE_KEY)
        }
      } catch {
        // Network error – leave the pending code for a later attempt.
      } finally {
        claiming = false
      }
    }

    void claimPending()

    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        void claimPending()
      }
    })

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [])

  return null
}
