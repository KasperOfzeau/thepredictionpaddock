import { getProfileLinkInfo, type ProfileLinkPlatform } from '@/lib/profileLinks'

interface ProfileLinkBadgeProps {
  url: string | null | undefined
  className?: string
}

function PlatformIcon({ platform }: { platform: ProfileLinkPlatform }) {
  const props = {
    className: 'h-4 w-4 shrink-0',
    viewBox: '0 0 24 24',
    'aria-hidden': true as const,
  }

  switch (platform) {
    case 'instagram':
      return (
        <svg {...props} fill="none" stroke="currentColor" strokeWidth={1.8}>
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
        </svg>
      )
    case 'youtube':
      return (
        <svg {...props} fill="currentColor">
          <path d="M21.6 7.2a2.5 2.5 0 0 0-1.76-1.77C18.27 5 12 5 12 5s-6.27 0-7.84.43A2.5 2.5 0 0 0 2.4 7.2 26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.76 1.77C5.73 19 12 19 12 19s6.27 0 7.84-.43a2.5 2.5 0 0 0 1.76-1.77A26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8ZM10 15V9l5.2 3Z" />
        </svg>
      )
    case 'x':
      return (
        <svg {...props} fill="currentColor">
          <path d="M17.53 3H20.5l-6.5 7.43L21.75 21h-6l-4.7-6.14L5.7 21H2.7l6.95-7.95L2.25 3h6.16l4.25 5.62L17.53 3Zm-2.1 16.2h1.66L8.65 4.7H6.87l8.56 14.5Z" />
        </svg>
      )
    case 'tiktok':
      return (
        <svg {...props} fill="currentColor">
          <path d="M16 3a4.7 4.7 0 0 0 4.5 4.5v3A7.7 7.7 0 0 1 16 9.2v6.3a5.5 5.5 0 1 1-5.5-5.5c.34 0 .67.03 1 .1v3.18A2.4 2.4 0 1 0 13 15.5V3h3Z" />
        </svg>
      )
    case 'github':
      return (
        <svg {...props} fill="currentColor">
          <path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.46-1.16-1.12-1.46-1.12-1.46-.91-.62.07-.6.07-.6 1.01.07 1.54 1.04 1.54 1.04.9 1.53 2.36 1.09 2.94.83.09-.65.35-1.09.64-1.34-2.22-.25-4.55-1.11-4.55-4.95 0-1.09.39-1.99 1.03-2.69-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02a9.5 9.5 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.6 1.03 2.69 0 3.85-2.34 4.7-4.57 4.94.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0 0 12 2Z" />
        </svg>
      )
    case 'linkedin':
      return (
        <svg {...props} fill="currentColor">
          <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9.5h4v11H3v-11Zm6.5 0h3.83v1.5h.05c.53-1 1.85-2.06 3.8-2.06 4.07 0 4.82 2.68 4.82 6.16V20.5h-4v-4.96c0-1.18-.02-2.7-1.65-2.7-1.66 0-1.91 1.3-1.91 2.62v5.04h-4v-11Z" />
        </svg>
      )
    case 'twitch':
      return (
        <svg {...props} fill="currentColor">
          <path d="M3.86 2 2.5 5.43V18h4.29v3h2.4l3-3h3.43L21 13.71V2H3.86Zm15.43 11-3 3h-3l-2.57 2.57V16h-3.86V3.43h12.43V13Zm-3.86-7H14v4.71h1.43V6Zm-4.29 0H9.71v4.71h1.43V6Z" />
        </svg>
      )
    case 'website':
    default:
      return (
        <svg {...props} fill="none" stroke="currentColor" strokeWidth={1.8}>
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18" />
          <path d="M12 3a14 14 0 0 1 0 18" />
          <path d="M12 3a14 14 0 0 0 0 18" />
        </svg>
      )
  }
}

export default function ProfileLinkBadge({ url, className }: ProfileLinkBadgeProps) {
  const info = getProfileLinkInfo(url)
  if (!info) return null

  return (
    <a
      href={info.href}
      target="_blank"
      rel="noopener noreferrer nofollow ugc"
      className={
        'inline-flex max-w-full items-center gap-1.5 text-sm text-white/70 underline-offset-4 transition-colors hover:text-f1-red hover:underline' +
        (className ? ` ${className}` : '')
      }
      aria-label={`${info.label}: ${info.display}`}
    >
      <PlatformIcon platform={info.platform} />
      <span className="truncate">{info.display}</span>
    </a>
  )
}
