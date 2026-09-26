 'use client'

import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import AvatarWithDecoration from '@/components/AvatarWithDecoration'
import MobileNavDrawer from '@/components/MobileNavDrawer'

const supabase = createClient()

const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/predictions', label: 'Predictions' },
  { href: '/leaderboard', label: 'Leaderboard' },
  { href: '/achievements', label: 'Achievements' },
  { href: '/pools/create', label: 'Create pool' },
]

function isLinkActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(`${href}/`)
}

export default function Nav() {
  const [username, setUsername] = useState<string | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [avatarDecorationId, setAvatarDecorationId] = useState<string | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false)
  const hamburgerButtonRef = useRef<HTMLButtonElement>(null)
  const pathname = usePathname()

  useEffect(() => {
    const loadUserAndNotifications = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('username, avatar_url, avatar_decoration_id')
        .eq('id', user.id)
        .single()

      if (profile) {
        setUsername(profile.username ?? null)
        setAvatarUrl(profile.avatar_url ?? null)
        setAvatarDecorationId(profile.avatar_decoration_id ?? null)
      }

      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('read', false)

      setUnreadCount(count ?? 0)
    }

    loadUserAndNotifications()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      loadUserAndNotifications()
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <nav className="bg-[#0a0a0c] shadow-sm">
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/">
               <Image src="/logos/TPP_White.svg" alt="The Prediction Paddock" width={100} height={100}/>
            </Link>
          </div>

          <div className="flex items-center gap-6">
            {/* Desktop-only primary nav links */}
            <div className="hidden lg:flex items-center gap-6">
              {NAV_LINKS.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className={`text-sm font-medium transition-colors ${
                    isLinkActive(pathname, href) ? 'text-white font-semibold' : 'text-zinc-300 hover:text-white'
                  }`}
                >
                  {label}
                </Link>
              ))}
            </div>

            {username ? (
              <div className="hidden lg:flex items-center gap-6">
                <Link
                  href="/notifications"
                  className="relative text-zinc-300 hover:text-white transition-colors"
                  title="Notifications"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
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
                  href={username ? `/profile/${encodeURIComponent(username)}` : '/profile'}
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
              <div className="hidden lg:flex items-center gap-6">
                <Link
                  href="/login"
                  className="text-sm font-medium text-zinc-300 hover:text-white transition-colors"
                >
                  Login
                </Link>
                <Link
                  href="/register"
                  className="text-sm font-medium text-zinc-300 hover:text-white transition-colors"
                >
                  Register
                </Link>
              </div>
            )}

            {/* Hamburger trigger — mobile/tablet only */}
            <button
              ref={hamburgerButtonRef}
              type="button"
              onClick={() => setIsMobileNavOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={isMobileNavOpen}
              aria-controls="mobile-nav-drawer"
              aria-label="Open menu"
              className="lg:hidden inline-flex items-center justify-center p-2 text-zinc-300 hover:text-white transition-colors"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <MobileNavDrawer
        isOpen={isMobileNavOpen}
        onClose={() => {
          setIsMobileNavOpen(false)
          hamburgerButtonRef.current?.focus()
        }}
        username={username}
        avatarUrl={avatarUrl}
        avatarDecorationId={avatarDecorationId}
        unreadCount={unreadCount}
      />
    </nav>
  )
}