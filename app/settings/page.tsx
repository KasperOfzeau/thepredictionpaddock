import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SettingsForm from '@/components/SettingsForm'
import GarageSettingsForm from '@/components/GarageSettingsForm'
import PushNotificationToggle from '@/components/PushNotificationToggle'
import Nav from '@/components/Nav'
import LogoutButton from '@/components/LogoutButton'
import { getCurrentGarageSeasonYear, getGarageForUser } from '@/lib/services/garage'
import { getManualAvatarDecorationGrantsForUser } from '@/lib/services/userAvatarDecorations'

export const metadata: Metadata = {
  title: 'Settings',
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
  const [{ data: profile }, garage, predictionCountRes, manualDecorationGrants] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    getGarageForUser(user.id, garageSeasonYear, supabase),
    supabase
      .from('predictions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id),
    getManualAvatarDecorationGrantsForUser(user.id, supabase),
  ])

  const predictionCount = predictionCountRes.count ?? 0

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
              Profile picture, avatar decoration, name, username, and public bio.
            </p>
            <div className="mt-6">
              <SettingsForm
                user={user}
                profile={profile}
                predictionCount={predictionCount}
                manualDecorationGrants={manualDecorationGrants}
              />
            </div>
          </section>

          <GarageSettingsForm
            userId={user.id}
            seasonYear={garageSeasonYear}
            initialGarage={garage}
          />

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
