import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SettingsForm from '@/components/SettingsForm'
import GarageSettingsForm from '@/components/GarageSettingsForm'
import PushNotificationToggle from '@/components/PushNotificationToggle'
import Nav from '@/components/Nav'
import LogoutButton from '@/components/LogoutButton'
import { getCurrentGarageSeasonYear, getGarageForUser } from '@/lib/services/garage'

export const metadata: Metadata = {
  title: 'Settings',
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

export default async function SettingsPage() {
  const supabase = await createClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/login')
  }

  const garageSeasonYear = getCurrentGarageSeasonYear()
  const [{ data: profile }, garage] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    getGarageForUser(user.id, garageSeasonYear, supabase),
  ])

  return (
    <div className="min-h-screen bg-carbon-black">
      <Nav />

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white sm:text-4xl">Settings</h1>
          <p className="mt-3 max-w-2xl text-sm text-white/65 sm:text-base">
            Manage your account, profile picture, and notifications.
          </p>
        </div>

        <div className="flex flex-col gap-6">
          <section className="rounded-2xl border border-white/10 bg-white/5 p-6 sm:p-8">
            <h2 className="text-xl font-bold text-white">Account</h2>
            <p className="mt-1 text-sm text-white/55">
              Profile picture, name, username, and public bio.
            </p>
            <div className="mt-6">
              <SettingsForm user={user} profile={profile} />
            </div>
          </section>

          <GarageSettingsForm
            userId={user.id}
            seasonYear={garageSeasonYear}
            initialGarage={garage}
          />

          <section className="rounded-2xl border border-dashed border-white/15 bg-white/3 p-6 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-white">Personalisation</h2>
                <p className="mt-1 text-sm text-white/55">
                  Unlock banners and avatar borders by earning achievements.
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/30 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-white/55">
                <LockIcon className="h-3 w-3" />
                Soon
              </span>
            </div>
            <div className="mt-4 rounded-xl border border-dashed border-white/15 bg-white/5 p-6 text-center">
              <LockIcon className="mx-auto mb-3 h-10 w-10 text-white/25" />
              <p className="text-sm font-medium text-white/65">Profile banner</p>
              <p className="mt-1 text-xs text-white/40">Upload when personalisation goes live</p>
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-6 sm:p-8">
            <h2 className="text-xl font-bold text-white">Notifications</h2>
            <p className="mt-1 text-sm text-white/55">
              Receive reminders before races start and when you haven&apos;t submitted your prediction yet.
            </p>
            <div className="mt-6">
              <PushNotificationToggle />
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-6 sm:p-8">
            <h2 className="text-xl font-bold text-white">Sign out</h2>
            <p className="mt-1 text-sm text-white/55">End your session on this device.</p>
            <div className="mt-6">
              <LogoutButton className="rounded-full border-2 border-f1-red px-5 py-2.5 text-white hover:bg-f1-red/20 hover:text-white" />
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
