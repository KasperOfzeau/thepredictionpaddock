'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import AvatarWithDecoration from '@/components/AvatarWithDecoration'

const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/predictions', label: 'Predictions' },
  { href: '/leaderboard', label: 'Leaderboard' },
  { href: '/pools/create', label: 'Create pool' },
]

function isLinkActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(`${href}/`)
}

const ANIMATION_MS = 300

interface MobileNavDrawerProps {
  isOpen: boolean
  onClose: () => void
  username: string | null
  avatarUrl: string | null
  avatarDecorationId: string | null
  unreadCount: number
}

export default function MobileNavDrawer({
  isOpen,
  onClose,
  username,
  avatarUrl,
  avatarDecorationId,
  unreadCount,
}: MobileNavDrawerProps) {
  const [mounted, setMounted] = useState(false)
  const [shouldRender, setShouldRender] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const rafRef = useRef<number>(0)
  const pathname = usePathname()

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true)
      // Two rAFs guarantee the browser has painted the initial
      // (off-screen) position before we flip to the visible one,
      // otherwise the two states can collapse into a single paint
      // and the slide-in never becomes visible.
      const raf1 = requestAnimationFrame(() => {
        const raf2 = requestAnimationFrame(() => setIsVisible(true))
        rafRef.current = raf2
      })
      rafRef.current = raf1
      return () => cancelAnimationFrame(rafRef.current)
    }

    setIsVisible(false)
    const timeout = setTimeout(() => setShouldRender(false), ANIMATION_MS)
    return () => clearTimeout(timeout)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEscape)
    document.body.style.overflow = 'hidden'
    closeButtonRef.current?.focus()
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  if (!mounted || !shouldRender) return null

  return createPortal(
    <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" id="mobile-nav-drawer" aria-label="Main navigation">
      {/* Overlay */}
      <div
        className={`fixed inset-0 bg-black/50 transition-opacity duration-300 ease-in-out ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
        aria-hidden
      />

      {/* Panel */}
      <div
        className={`fixed inset-y-0 right-0 w-72 max-w-[80vw] bg-[#0a0a0c] border-l border-zinc-800 shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out ${
          isVisible ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-end px-4 py-4 shrink-0">
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="shrink-0 rounded-md p-1.5 text-zinc-300 hover:bg-white/10 hover:text-white transition-colors"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Account section */}
        <div className="border-b border-zinc-800 px-4 py-4 shrink-0">
          {username ? (
            <div className="flex items-center gap-6">
              <Link
                href="/notifications"
                onClick={onClose}
                className="relative text-zinc-300 hover:text-white transition-colors"
                title="Notifications"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                  />
                </svg>
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-f1-red text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Link>

              <Link
                href={`/profile/${encodeURIComponent(username)}`}
                onClick={onClose}
                className="flex items-center gap-2 text-sm text-zinc-300 hover:text-white transition-colors"
              >
                <AvatarWithDecoration
                  avatarUrl={avatarUrl}
                  username={username}
                  decorationId={avatarDecorationId}
                  size={32}
                  avatarClassName="bg-zinc-600 ring-2 ring-zinc-500 transition-all"
                  fallbackTextClassName="text-sm text-zinc-400"
                  alt="Profile"
                />
                <span>@{username}</span>
              </Link>
            </div>
          ) : (
            <div className="flex items-center gap-6">
              <Link
                href="/login"
                onClick={onClose}
                className="text-sm font-medium text-zinc-300 hover:text-white transition-colors"
              >
                Login
              </Link>
              <Link
                href="/register"
                onClick={onClose}
                className="text-sm font-medium text-zinc-300 hover:text-white transition-colors"
              >
                Register
              </Link>
            </div>
          )}
        </div>

        {/* Primary nav links */}
        <nav className="flex-1 overflow-y-auto px-2 py-4">
          <ul className="space-y-1">
            {NAV_LINKS.map(({ href, label }) => {
              const active = isLinkActive(pathname, href)
              return (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={onClose}
                    className={`relative block overflow-hidden pl-7 pr-4 py-3 text-base font-medium rounded-md transition-colors ${
                      active
                        ? 'text-white bg-white/5'
                        : 'text-zinc-300 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {active && (
                      <span aria-hidden className="checkered-flag-indicator absolute inset-y-0 left-0 w-4" />
                    )}
                    {label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
      </div>
    </div>,
    document.body
  )
}
