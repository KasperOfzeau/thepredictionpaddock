'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import AvatarWithDecoration from '@/components/AvatarWithDecoration'
import {
  AVATAR_DECORATIONS,
  NO_DECORATION_LABEL,
  type AvatarDecoration,
  type AvatarDecorationStats,
} from '@/lib/avatarDecorations'

interface AvatarDecorationDropdownProps {
  /** Currently selected decoration id, or `null` for no decoration. */
  value: string | null
  onChange: (decorationId: string | null) => void
  /** User's avatar shown in every option preview. */
  avatarUrl: string | null | undefined
  username: string | null | undefined
  stats: AvatarDecorationStats
  id?: string
}

interface OptionMeta {
  /** Stable key. `null` is the "No decoration" entry. */
  id: string | null
  label: string
  /** Unlock requirement text (small/secondary line). */
  hint: string | null
  unlocked: boolean
  decoration: AvatarDecoration | null
}

export default function AvatarDecorationDropdown({
  value,
  onChange,
  avatarUrl,
  username,
  stats,
  id,
}: AvatarDecorationDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const options = useMemo<OptionMeta[]>(
    () => [
      {
        id: null,
        label: NO_DECORATION_LABEL,
        hint: null,
        unlocked: true,
        decoration: null,
      },
      ...AVATAR_DECORATIONS.map<OptionMeta>((decoration) => ({
        id: decoration.id,
        label: decoration.label,
        hint: decoration.unlockLabel,
        unlocked: decoration.isUnlocked(stats),
        decoration,
      })),
    ],
    [stats],
  )

  const selectedOption =
    options.find((option) => option.id === (value ?? null)) ?? options[0]

  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKey)
    }
  }, [isOpen])

  return (
    <div className="relative" ref={containerRef}>
      <button
        id={id}
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className="flex w-full items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-left text-white transition-colors hover:border-white/20 focus:border-f1-red focus:outline-none focus:ring-2 focus:ring-f1-red"
      >
        <AvatarWithDecoration
          avatarUrl={avatarUrl}
          username={username}
          decorationId={selectedOption.decoration?.id ?? null}
          size={40}
          avatarClassName="ring-1 ring-white/10"
          fallbackTextClassName="text-sm text-white/45"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-white">{selectedOption.label}</p>
          {selectedOption.hint ? (
            <p className="truncate text-xs text-white/50">
              Unlocked {selectedOption.hint}
            </p>
          ) : null}
        </div>
        <svg
          className={`h-5 w-5 shrink-0 text-white/50 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isOpen ? (
        <ul
          role="listbox"
          className="absolute z-20 mt-2 w-full overflow-hidden rounded-lg border border-white/10 bg-[#15151a] shadow-2xl shadow-black/40"
        >
          {options.map((option) => {
            const isSelected = option.id === (value ?? null)
            const subtext = option.hint
              ? option.unlocked
                ? `Unlocked ${option.hint}`
                : `Locked - unlock ${option.hint}`
              : null

            return (
              <li key={option.id ?? '__none__'}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  disabled={!option.unlocked}
                  onClick={() => {
                    if (!option.unlocked) return
                    onChange(option.id)
                    setIsOpen(false)
                  }}
                  className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                    option.unlocked
                      ? isSelected
                        ? 'bg-f1-red/15 hover:bg-f1-red/20'
                        : 'hover:bg-white/5'
                      : 'cursor-not-allowed opacity-55'
                  }`}
                >
                  <AvatarWithDecoration
                    avatarUrl={avatarUrl}
                    username={username}
                    decorationId={option.decoration?.id ?? null}
                    size={40}
                    avatarClassName="ring-1 ring-white/10"
                    fallbackTextClassName="text-sm text-white/45"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white">
                      {option.label}
                    </p>
                    {subtext ? (
                      <p className="truncate text-xs text-white/50">{subtext}</p>
                    ) : null}
                  </div>
                  {isSelected ? (
                    <svg
                      className="h-5 w-5 shrink-0 text-f1-red"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                      aria-hidden
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : null}
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}
