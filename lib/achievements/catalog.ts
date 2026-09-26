/**
 * Static catalog of achievements. This is the single source of truth for
 * labels, descriptions, icons and tier thresholds.
 *
 * Unlike lib/avatarDecorations.ts, entries here do NOT carry an `isUnlocked`
 * predicate re-evaluated at read time. Progress is written once, at the
 * moment of the qualifying event, into `user_achievement_progress`
 * (lib/services/achievements.ts). This file is only ever read — to render
 * the catalog and to look up tier thresholds when deciding whether a write
 * just crossed one.
 *
 * `dormant: true` marks achievements whose badge assets already exist but
 * whose award logic isn't wired up yet (cross-user achievements that need a
 * periodic job across all participants). They still render as locked.
 */

const ICON_BASE = '/images/assets/achievments'

export type AchievementCategory =
  | 'getting-started'
  | 'accuracy'
  | 'consistency'
  | 'competition'
  | 'secret'

export interface AchievementTier {
  /** 1-indexed tier level. Tier 0 (implicit) means locked/not yet unlocked. */
  tier: number
  /** current_value must reach this for the tier to unlock. */
  threshold: number
  label: string
  icon: string
}

export interface Achievement {
  id: string
  category: AchievementCategory
  label: string
  description: string
  secret?: boolean
  /** True while award logic for this achievement isn't wired up yet. */
  dormant?: boolean
  tiers: AchievementTier[]
}

export const ACHIEVEMENTS: readonly Achievement[] = [
  // Getting started
  {
    id: 'lights_out',
    category: 'getting-started',
    label: 'Lights Out',
    description: 'Place your first prediction.',
    tiers: [{ tier: 1, threshold: 1, label: 'Unlocked', icon: `${ICON_BASE}/lights-out.svg` }],
  },
  {
    id: 'on_the_grid',
    category: 'getting-started',
    label: 'On the Grid',
    description: 'Join your first pool.',
    tiers: [{ tier: 1, threshold: 1, label: 'Unlocked', icon: `${ICON_BASE}/on-the-grid.svg` }],
  },
  {
    id: 'team_principal',
    category: 'getting-started',
    label: 'Team Principal',
    description: 'Create a pool and get 5 friends to join it.',
    tiers: [{ tier: 1, threshold: 5, label: 'Unlocked', icon: `${ICON_BASE}/team-principal.svg` }],
  },

  // Accuracy
  {
    id: 'pole_prophet',
    category: 'accuracy',
    label: 'Pole Prophet',
    description: 'Predict the race winner in the exact spot.',
    tiers: [
      { tier: 1, threshold: 1, label: 'Bronze', icon: `${ICON_BASE}/pole-prophet-bronze.svg` },
      { tier: 2, threshold: 10, label: 'Silver', icon: `${ICON_BASE}/pole-prophet-silver.svg` },
      { tier: 3, threshold: 25, label: 'Gold', icon: `${ICON_BASE}/pole-prophet-gold.svg` },
    ],
  },
  {
    id: 'podium_perfect',
    category: 'accuracy',
    label: 'Podium Perfect',
    description: 'Get the top 3 exactly right in one race.',
    tiers: [
      { tier: 1, threshold: 1, label: 'Bronze', icon: `${ICON_BASE}/podium-perfect-bronze.svg` },
      { tier: 2, threshold: 5, label: 'Silver', icon: `${ICON_BASE}/podium-perfect-silver.svg` },
      { tier: 3, threshold: 15, label: 'Gold', icon: `${ICON_BASE}/podium-perfect-gold.svg` },
    ],
  },
  {
    id: 'full_grid',
    category: 'accuracy',
    label: 'Full Grid',
    description: 'All 10 of your drivers finish in the top 10, in any order.',
    tiers: [
      { tier: 1, threshold: 1, label: 'Bronze', icon: `${ICON_BASE}/full-grid-bronze.svg` },
      { tier: 2, threshold: 5, label: 'Silver', icon: `${ICON_BASE}/full-grid-silver.svg` },
      { tier: 3, threshold: 10, label: 'Gold', icon: `${ICON_BASE}/full-grid-gold.svg` },
    ],
  },
  {
    id: 'last_point',
    category: 'accuracy',
    label: 'Last Point',
    description: 'Nail P10 exactly.',
    tiers: [
      { tier: 1, threshold: 1, label: 'Bronze', icon: `${ICON_BASE}/last-point-bronze.svg` },
      { tier: 2, threshold: 5, label: 'Silver', icon: `${ICON_BASE}/last-point-silver.svg` },
      { tier: 3, threshold: 15, label: 'Gold', icon: `${ICON_BASE}/last-point-gold.svg` },
    ],
  },
  {
    id: 'big_haul',
    category: 'accuracy',
    label: 'Big Haul',
    description: 'Score 30 or more points in a single race.',
    tiers: [{ tier: 1, threshold: 1, label: 'Unlocked', icon: `${ICON_BASE}/big-haul.svg` }],
  },
  {
    id: 'perfect_ten',
    category: 'accuracy',
    label: 'Perfect Ten',
    description: 'The full top 10 in the exact order. 50 points.',
    tiers: [{ tier: 1, threshold: 1, label: 'Unlocked', icon: `${ICON_BASE}/perfect-ten.svg` }],
  },

  // Consistency
  {
    id: 'iron_man',
    category: 'consistency',
    label: 'Iron Man',
    description: 'Predict races in a row without missing one.',
    tiers: [
      { tier: 1, threshold: 5, label: 'Bronze', icon: `${ICON_BASE}/iron-man-bronze.svg` },
      { tier: 2, threshold: 10, label: 'Silver', icon: `${ICON_BASE}/iron-man-silver.svg` },
      { tier: 3, threshold: 24, label: 'Gold', icon: `${ICON_BASE}/iron-man-gold.svg` },
    ],
  },
  {
    id: 'points_collector',
    category: 'consistency',
    label: 'Points Collector',
    description: 'Total points across all races.',
    tiers: [
      { tier: 1, threshold: 100, label: 'Bronze', icon: `${ICON_BASE}/points-collector-bronze.svg` },
      { tier: 2, threshold: 250, label: 'Silver', icon: `${ICON_BASE}/points-collector-silver.svg` },
      { tier: 3, threshold: 500, label: 'Gold', icon: `${ICON_BASE}/points-collector-gold.svg` },
    ],
  },
  {
    id: 'season_ticket',
    category: 'consistency',
    label: 'Season Ticket',
    description: 'Predict every race of a season.',
    tiers: [{ tier: 1, threshold: 1, label: 'Unlocked', icon: `${ICON_BASE}/season-ticket.svg` }],
  },

  // Competition (dormant: needs a cross-user periodic job, see plan)
  {
    id: 'race_winner',
    category: 'competition',
    label: 'Race Winner',
    description: 'Best prediction of the weekend on the global leaderboard.',
    dormant: true,
    tiers: [
      { tier: 1, threshold: 1, label: 'Bronze', icon: `${ICON_BASE}/race-winner-bronze.svg` },
      { tier: 2, threshold: 3, label: 'Silver', icon: `${ICON_BASE}/race-winner-silver.svg` },
      { tier: 3, threshold: 10, label: 'Gold', icon: `${ICON_BASE}/race-winner-gold.svg` },
    ],
  },
  {
    id: 'pool_leader',
    category: 'competition',
    label: 'Pool Leader',
    description: 'Top your pool after a race.',
    dormant: true,
    tiers: [
      { tier: 1, threshold: 1, label: 'Bronze', icon: `${ICON_BASE}/pool-leader-bronze.svg` },
      { tier: 2, threshold: 5, label: 'Silver', icon: `${ICON_BASE}/pool-leader-silver.svg` },
      { tier: 3, threshold: 15, label: 'Gold', icon: `${ICON_BASE}/pool-leader-gold.svg` },
    ],
  },
  {
    id: 'world_champion',
    category: 'competition',
    label: 'World Champion',
    description: 'Finish a season first on the global leaderboard.',
    dormant: true,
    tiers: [{ tier: 1, threshold: 1, label: 'Unlocked', icon: `${ICON_BASE}/world-champion.svg` }],
  },

  // Secret
  {
    id: 'secret_bono',
    category: 'secret',
    label: 'Bono, My Tyres Are Gone',
    description: 'Score 0 points in a race.',
    secret: true,
    tiers: [{ tier: 1, threshold: 1, label: 'Unlocked', icon: `${ICON_BASE}/secret-bono-my-tyres-are-gone.svg` }],
  },
  {
    id: 'secret_box_box',
    category: 'secret',
    label: 'Box, Box',
    description: 'Change your prediction 10 times before one race.',
    secret: true,
    tiers: [{ tier: 1, threshold: 1, label: 'Unlocked', icon: `${ICON_BASE}/secret-box-box.svg` }],
  },
  {
    id: 'secret_late_braker',
    category: 'secret',
    label: 'Late Braker',
    description: 'Lock in your prediction in the last 5 minutes.',
    secret: true,
    tiers: [{ tier: 1, threshold: 1, label: 'Unlocked', icon: `${ICON_BASE}/secret-late-braker.svg` }],
  },
  {
    id: 'secret_deja_vu',
    category: 'secret',
    label: 'Déjà Vu',
    description: 'Submit the exact same top 10 two races in a row.',
    secret: true,
    tiers: [{ tier: 1, threshold: 1, label: 'Unlocked', icon: `${ICON_BASE}/secret-deja-vu.svg` }],
  },
  {
    id: 'secret_dnf',
    category: 'secret',
    label: 'DNF',
    description: 'Miss a race after a streak of 10.',
    secret: true,
    tiers: [{ tier: 1, threshold: 1, label: 'Unlocked', icon: `${ICON_BASE}/secret-dnf.svg` }],
  },
  {
    id: 'secret_photo_finish',
    category: 'secret',
    label: 'Photo Finish',
    description: 'Win your pool by a single point.',
    secret: true,
    dormant: true,
    tiers: [{ tier: 1, threshold: 1, label: 'Unlocked', icon: `${ICON_BASE}/secret-photo-finish.svg` }],
  },
]

/** Max number of achievements a user can pin to their public "trophy cabinet". */
export const MAX_SHOWCASED_ACHIEVEMENTS = 6

const ACHIEVEMENTS_BY_ID = new Map(ACHIEVEMENTS.map((achievement) => [achievement.id, achievement]))

export function getAchievement(id: string): Achievement | undefined {
  return ACHIEVEMENTS_BY_ID.get(id)
}

/** Highest tier whose threshold is met by `value`, or 0 if none. */
export function tierForValue(achievement: Achievement, value: number): number {
  let tier = 0
  for (const t of achievement.tiers) {
    if (value >= t.threshold) tier = t.tier
  }
  return tier
}
