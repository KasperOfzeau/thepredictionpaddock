import Link from 'next/link'
import type { LeaderboardEntry } from '@/lib/services/leaderboard'
import AvatarWithDecoration from '@/components/AvatarWithDecoration'

interface GlobalLeaderboardProps {
  entries: LeaderboardEntry[]
}

export default function GlobalLeaderboard({ entries }: GlobalLeaderboardProps) {
  return (
    <div className="flex flex-col h-full min-h-[220px] gap-2 sm:gap-3">
      {entries.length === 0 ? (
        <p className="text-white/50 text-center py-6">No players yet</p>
      ) : (
        entries.map((entry) => (
            <Link
              key={entry.user_id}
              href={`/profile/${encodeURIComponent(entry.username)}`}
              className="flex-1 flex items-center gap-2 sm:gap-4 p-2 sm:p-3 rounded-lg overflow-hidden border border-white/10  min-h-0 hover:border-f1-red hover:bg-white/5 transition-colors"
            >
              <div className="text-xs text-white/60 min-w-[20px] text-center shrink-0 tabular-nums">
                {entry.rank}
              </div>

              <AvatarWithDecoration
                avatarUrl={entry.avatar_url}
                username={entry.username}
                decorationId={entry.avatar_decoration_id}
                size={40}
                fallbackTextClassName="text-sm text-white/60"
                alt={entry.username}
              />

              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm sm:text-base truncate text-white">
                  @{entry.username}
                </p>
              </div>

              <div className="text-right shrink-0">
                <p className="font-bold text-base sm:text-lg text-white">{entry.total_points}</p>
                <p className="text-xs text-white/50">points</p>
              </div>
            </Link>
          ))
      )}
    </div>
  )
}
