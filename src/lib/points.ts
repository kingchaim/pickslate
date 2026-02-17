// Points system
export const POINTS = {
  BASE_PARTICIPATION: 10,       // just for playing
  PER_CORRECT: 15,              // per correct pick
  THRESHOLD_5_OF_7: 20,         // bonus if 5/7 or better
  THRESHOLD_6_OF_7: 35,         // bonus if 6/7
  PERFECT_7_OF_7: 100,          // bonus for perfect day
  STREAK_3: 25,
  STREAK_7: 100,
  STREAK_14: 250,
  STREAK_30: 1000,
}

export function calculatePoints(
  correctPicks: number,
  totalPicks: number,
  currentStreak: number
): {
  base_points: number
  performance_points: number
  perfect_bonus: number
  streak_bonus: number
  total_points: number
} {
  let base_points = POINTS.BASE_PARTICIPATION
  let performance_points = correctPicks * POINTS.PER_CORRECT

  // Threshold bonuses
  if (totalPicks >= 7) {
    if (correctPicks >= 5) performance_points += POINTS.THRESHOLD_5_OF_7
    if (correctPicks >= 6) performance_points += POINTS.THRESHOLD_6_OF_7
  }

  let perfect_bonus = 0
  if (correctPicks === totalPicks && totalPicks >= 7) {
    perfect_bonus = POINTS.PERFECT_7_OF_7
  }

  let streak_bonus = 0
  if (currentStreak >= 30) streak_bonus = POINTS.STREAK_30
  else if (currentStreak >= 14) streak_bonus = POINTS.STREAK_14
  else if (currentStreak >= 7) streak_bonus = POINTS.STREAK_7
  else if (currentStreak >= 3) streak_bonus = POINTS.STREAK_3

  const total_points = base_points + performance_points + perfect_bonus + streak_bonus

  return { base_points, performance_points, perfect_bonus, streak_bonus, total_points }
}

export function getStreakEmoji(streak: number): string {
  if (streak >= 30) return '👑🍆'
  if (streak >= 14) return '💊🔥'
  if (streak >= 7) return '🪨🔥'
  if (streak >= 3) return '🔥'
  return ''
}

export function getStreakLabel(streak: number): string {
  if (streak >= 30) return 'Tantric God'
  if (streak >= 14) return 'Viagra Who?'
  if (streak >= 7) return 'Rock Solid'
  if (streak >= 3) return 'Semi-Hard'
  return ''
}

export function getPerformanceLabel(correct: number, total: number): string {
  if (total < 7) {
    const pct = total > 0 ? correct / total : 0
    if (pct === 1) return 'GIRTHY KING 👑🍆'
    if (pct >= 0.7) return 'BALLS DEEP 🔥'
    if (pct >= 0.5) return 'HALF CHUB 💪'
    return 'MICRO ENERGY 🤏'
  }
  if (correct === 7) return 'GIRTHY KING 👑🍆'
  if (correct === 6) return 'BALLS DEEP 🔥'
  if (correct === 5) return 'HALF CHUB 💪'
  if (correct === 4) return 'WHISKEY DICK 🫠'
  if (correct === 3) return 'MICRO ENERGY 🤏'
  if (correct === 2) return 'PREMATURE FINISH 💀'
  if (correct === 1) return "COULDN'T FIND THE HOLE ☠️"
  return 'ERECTILE MALFUNCTION 🪦'
}

export function getLeaderboardTitle(rank: number, totalMembers: number): string {
  if (rank === 1) return 'Top Dog (Hung Like One Too)'
  if (rank === 2) return 'Almost Alpha'
  if (rank === 3) return 'Bronze Boner'
  if (rank === totalMembers && totalMembers > 3) return 'The Group Eunuch'
  return ''
}
