import Image from 'next/image'
import { getAvatarDecorationById } from '@/lib/avatarDecorations'

interface AvatarWithDecorationProps {
  avatarUrl: string | null | undefined
  username: string | null | undefined
  decorationId: string | null | undefined
  /** Outer square size in pixels. The badge scales with the avatar size. */
  size: number
  /** Extra classes for the outer wrapper (positioning, ring offsets etc.). */
  className?: string
  /** Extra classes applied to the rounded avatar circle (rings, shadows). */
  avatarClassName?: string
  /** Extra classes for the fallback initial when no avatar image is set. */
  fallbackTextClassName?: string
  alt?: string
}

/**
 * Avatar with an optional decoration badge in the bottom-right corner.
 * Used everywhere we render a user avatar so the badge stays consistent.
 */
export default function AvatarWithDecoration({
  avatarUrl,
  username,
  decorationId,
  size,
  className,
  avatarClassName,
  fallbackTextClassName,
  alt,
}: AvatarWithDecorationProps) {
  const decoration = getAvatarDecorationById(decorationId)
  const fallbackLetter = username?.charAt(0)?.toUpperCase() || '?'
  const decorationSize = Math.max(12, Math.round(size * 0.36))

  const wrapperClass = ['relative shrink-0', className].filter(Boolean).join(' ')
  const avatarCircleClass = [
    'absolute inset-0 overflow-hidden rounded-full bg-white/10',
    avatarClassName,
  ]
    .filter(Boolean)
    .join(' ')
  const fallbackClass = [
    'absolute inset-0 flex items-center justify-center font-semibold',
    fallbackTextClassName ?? 'text-white/60',
  ].join(' ')

  return (
    <div className={wrapperClass} style={{ width: size, height: size }}>
      <div className={avatarCircleClass}>
        {avatarUrl ? (
          <Image
            src={avatarUrl}
            alt={alt ?? (username ? `@${username}` : 'Profile')}
            fill
            className="object-cover"
            sizes={`${size}px`}
          />
        ) : (
          <span className={fallbackClass}>{fallbackLetter}</span>
        )}
      </div>
      {decoration ? (
        <span
          className="absolute bottom-0 right-0 flex items-center justify-center overflow-hidden rounded-full ring-2 ring-carbon-black"
          style={{
            width: decorationSize,
            height: decorationSize,
            backgroundColor: decoration.color,
            // Inset shrinks the logo without affecting the badge circle itself.
            padding: Math.max(2, Math.round(decorationSize * (decoration.logoInset ?? 0.05))),
          }}
          aria-label={decoration.label}
          title={decoration.label}
        >
          {/* Plain <img> so a missing logo just falls back to the colored circle. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={decoration.logoSrc}
            alt=""
            width={decorationSize}
            height={decorationSize}
            className="h-full w-full object-contain"
          />
        </span>
      ) : null}
    </div>
  )
}
