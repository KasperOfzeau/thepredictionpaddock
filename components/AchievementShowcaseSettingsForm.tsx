'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { MAX_SHOWCASED_ACHIEVEMENTS } from '@/lib/achievements/catalog'

const supabase = createClient()

export interface UnlockedAchievementOption {
  id: string
  label: string
  description: string
  icon: string
}

interface AchievementShowcaseSettingsFormProps {
  userId: string
  unlockedAchievements: UnlockedAchievementOption[]
  initialSelectedIds: string[]
}

export default function AchievementShowcaseSettingsForm({
  userId,
  unlockedAchievements,
  initialSelectedIds,
}: AchievementShowcaseSettingsFormProps) {
  const unlockedIds = new Set(unlockedAchievements.map((a) => a.id))
  const [selectedIds, setSelectedIds] = useState<string[]>(
    initialSelectedIds.filter((id) => unlockedIds.has(id))
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  function toggle(id: string) {
    setSuccess(null)
    setSelectedIds((current) => {
      if (current.includes(id)) return current.filter((existing) => existing !== id)
      if (current.length >= MAX_SHOWCASED_ACHIEVEMENTS) return current
      return [...current, id]
    })
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    setSuccess(null)

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ showcased_achievement_ids: selectedIds, updated_at: new Date().toISOString() })
      .eq('id', userId)

    setSaving(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    setSuccess('Trophy cabinet saved!')
  }

  if (unlockedAchievements.length === 0) {
    return (
      <section className="rounded-2xl border border-white/10 bg-white/5 p-6 sm:p-8">
        <h2 className="text-xl font-bold text-white">Trophy cabinet</h2>
        <p className="mt-1 text-sm text-white/55">
          Pick achievements to feature on your public profile.
        </p>
        <p className="mt-6 text-sm text-white/45">
          You haven&apos;t unlocked any achievements yet.{' '}
          <Link href="/achievements" className="text-f1-red hover:text-f1-red-hover">
            See what&apos;s available
          </Link>
          .
        </p>
      </section>
    )
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-6 sm:p-8">
      <h2 className="text-xl font-bold text-white">Trophy cabinet</h2>
      <p className="mt-1 text-sm text-white/55">
        Pick up to {MAX_SHOWCASED_ACHIEVEMENTS} unlocked achievements to feature on your public profile.
        {' '}({selectedIds.length}/{MAX_SHOWCASED_ACHIEVEMENTS} selected)
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {unlockedAchievements.map((achievement) => {
          const position = selectedIds.indexOf(achievement.id)
          const isSelected = position !== -1
          const isDisabled = !isSelected && selectedIds.length >= MAX_SHOWCASED_ACHIEVEMENTS

          return (
            <button
              key={achievement.id}
              type="button"
              onClick={() => toggle(achievement.id)}
              disabled={isDisabled}
              className={`relative rounded-xl border p-4 text-left transition-colors ${
                isSelected
                  ? 'border-f1-red bg-f1-red/10'
                  : 'border-white/10 bg-white/6 hover:border-white/25'
              } ${isDisabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'}`}
            >
              {isSelected ? (
                <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-f1-red text-[11px] font-semibold text-white">
                  {position + 1}
                </span>
              ) : null}
              <div className="relative h-10 w-10">
                <Image src={achievement.icon} alt="" fill className="object-contain" />
              </div>
              <p className="mt-3 truncate font-semibold text-white/90">{achievement.label}</p>
              <p className="mt-1 text-xs text-white/40">{achievement.description}</p>
            </button>
          )
        })}
      </div>

      {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}
      {success ? <p className="mt-4 text-sm text-emerald-300">{success}</p> : null}

      <div className="mt-6">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-full bg-f1-red px-6 py-2.5 font-semibold text-white transition-colors hover:bg-f1-red-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save trophy cabinet'}
        </button>
      </div>
    </section>
  )
}
