'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import type { Driver, ProfileGarage } from '@/lib/types'

interface GarageSettingsFormProps {
  userId: string
  seasonYear: number
  initialGarage: ProfileGarage | null
}

type TeamOption = {
  name: string
  colour: string | null
}

const supabase = createClient()

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

function getTeamsFromDrivers(drivers: Driver[]): TeamOption[] {
  const byName = new Map<string, TeamOption>()
  for (const driver of drivers) {
    if (!driver.team_name || byName.has(driver.team_name)) continue
    byName.set(driver.team_name, {
      name: driver.team_name,
      colour: driver.team_colour || null,
    })
  }
  return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name))
}

export default function GarageSettingsForm({
  userId,
  seasonYear,
  initialGarage,
}: GarageSettingsFormProps) {
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [selectedDriverNumber, setSelectedDriverNumber] = useState<number | null>(
    initialGarage?.favorite_driver_number ?? null
  )
  const [selectedTeamName, setSelectedTeamName] = useState<string | null>(
    initialGarage?.favorite_team_name ?? null
  )
  const [loadingDrivers, setLoadingDrivers] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    setSelectedDriverNumber(initialGarage?.favorite_driver_number ?? null)
    setSelectedTeamName(initialGarage?.favorite_team_name ?? null)
  }, [initialGarage])

  useEffect(() => {
    let cancelled = false

    async function loadDrivers() {
      setLoadingDrivers(true)
      setError(null)
      try {
        const res = await fetch('/api/drivers?meeting_key=latest')
        if (!res.ok) throw new Error('Could not load drivers')
        const data = await res.json()
        if (!cancelled) setDrivers(Array.isArray(data.drivers) ? data.drivers : [])
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load drivers')
        }
      } finally {
        if (!cancelled) setLoadingDrivers(false)
      }
    }

    loadDrivers()
    return () => {
      cancelled = true
    }
  }, [])

  const teams = useMemo(() => getTeamsFromDrivers(drivers), [drivers])

  const selectedDriver = useMemo(
    () => drivers.find((driver) => driver.driver_number === selectedDriverNumber) ?? null,
    [drivers, selectedDriverNumber]
  )

  const selectedTeam = useMemo(
    () => teams.find((team) => team.name === selectedTeamName) ?? null,
    [teams, selectedTeamName]
  )

  async function handleSave() {
    setSaving(true)
    setError(null)
    setSuccess(null)

    const payload = {
      user_id: userId,
      season_year: seasonYear,
      favorite_driver_number: selectedDriver?.driver_number ?? null,
      favorite_driver_name: selectedDriver?.full_name ?? null,
      favorite_driver_team_name: selectedDriver?.team_name ?? null,
      favorite_driver_team_colour: selectedDriver?.team_colour ?? null,
      favorite_driver_headshot_url: selectedDriver?.headshot_url ?? null,
      favorite_team_name: selectedTeam?.name ?? null,
      favorite_team_colour: selectedTeam?.colour ?? null,
      updated_at: new Date().toISOString(),
    }

    const { error: upsertError } = await supabase
      .from('profile_garage')
      .upsert(payload, { onConflict: 'user_id,season_year' })

    setSaving(false)

    if (upsertError) {
      setError(upsertError.message)
      return
    }

    setSuccess('Garage saved successfully!')
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-6 sm:p-8">
      <div>
        <h2 className="text-xl font-bold text-white">Garage</h2>
        <p className="mt-1 text-sm text-white/55">
          Pick your favorite driver and constructor for this season.
        </p>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="garage-driver" className="mb-2 block text-sm font-medium text-white/90">
            Favorite driver
          </label>
          <select
            id="garage-driver"
            value={selectedDriverNumber ?? ''}
            onChange={(e) => setSelectedDriverNumber(e.target.value ? Number(e.target.value) : null)}
            disabled={loadingDrivers}
            className="w-full rounded-lg border border-white/10 bg-carbon-black px-3 py-2.5 text-white focus:border-f1-red focus:outline-none focus:ring-2 focus:ring-f1-red disabled:opacity-50"
          >
            <option value="">Select driver...</option>
            {drivers.map((driver) => (
              <option key={driver.driver_number} value={driver.driver_number}>
                #{driver.driver_number} {driver.full_name} - {driver.team_name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="garage-team" className="mb-2 block text-sm font-medium text-white/90">
            Favorite team
          </label>
          <select
            id="garage-team"
            value={selectedTeamName ?? ''}
            onChange={(e) => setSelectedTeamName(e.target.value || null)}
            disabled={loadingDrivers}
            className="w-full rounded-lg border border-white/10 bg-carbon-black px-3 py-2.5 text-white focus:border-f1-red focus:outline-none focus:ring-2 focus:ring-f1-red disabled:opacity-50"
          >
            <option value="">Select team...</option>
            {teams.map((team) => (
              <option key={team.name} value={team.name}>
                {team.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          {selectedDriver ? (
            <div className="flex items-center gap-3">
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full border border-white/10 bg-white/10">
                {selectedDriver.headshot_url ? (
                  <Image
                    src={selectedDriver.headshot_url}
                    alt={selectedDriver.full_name}
                    fill
                    className="object-cover"
                    sizes="56px"
                  />
                ) : (
                  <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white/50">
                    {selectedDriver.name_acronym}
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate font-semibold text-white">
                  #{selectedDriver.driver_number} {formatDriverName(selectedDriver.full_name)}
                </p>
                <div className="mt-1 flex items-center gap-2 text-sm text-white/55">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: colourToCss(selectedDriver.team_colour) }}
                  />
                  <span className="truncate">{selectedDriver.team_name}</span>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-white/45">No favorite driver selected yet.</p>
          )}
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          {selectedTeam ? (
            <div className="flex items-center gap-3">
              <span
                className="h-10 w-2 rounded-full"
                style={{ backgroundColor: colourToCss(selectedTeam.colour) }}
              />
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-white/40">
                  Favorite team
                </p>
                <p className="mt-1 font-semibold text-white">{selectedTeam.name}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-white/45">No favorite team selected yet.</p>
          )}
        </div>
      </div>

      {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}
      {success ? <p className="mt-4 text-sm text-emerald-300">{success}</p> : null}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || loadingDrivers}
          className="rounded-full bg-f1-red px-6 py-2.5 font-semibold text-white transition-colors hover:bg-f1-red-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save garage'}
        </button>
        <button
          type="button"
          onClick={() => {
            setSelectedDriverNumber(null)
            setSelectedTeamName(null)
          }}
          className="rounded-full border border-white/15 px-6 py-2.5 font-medium text-white/80 transition-colors hover:bg-white/5 hover:text-white"
        >
          Clear
        </button>
      </div>
    </section>
  )
}
