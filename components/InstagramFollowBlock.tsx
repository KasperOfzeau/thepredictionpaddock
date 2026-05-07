'use client'

const INSTAGRAM_LINK = 'https://www.instagram.com/thepredictionpaddock/'

export default function InstagramFollowBlock() {
  return (
    <div className="bg-white/5 rounded-xl border border-white/10 p-6">
      <h3 className="text-2xl font-semibold text-white mb-2">Follow us on Instagram</h3>
      <p className="text-white/70 text-sm mb-4">
        Follow @thepredictionpaddock for race-week reminders and a peek at what we&apos;re building
        next. Tag us with your predictions to get featured.
      </p>
      <a
        href={INSTAGRAM_LINK}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 border-2 border-f1-red text-white px-4 py-2 rounded-full text-sm font-medium transition-colors hover:bg-f1-red/20"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
          <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
          <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
        </svg>
        Follow on Instagram
      </a>
    </div>
  )
}
