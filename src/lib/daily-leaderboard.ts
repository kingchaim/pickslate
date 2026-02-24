import type { Game, Pick } from '@/types'

export interface DailyLeaderboardEntry {
  user_id: string
  display_name: string
  correct_picks: number
  total_picks: number
  total_points: number
  blocks: string[]
}

export function buildDailyLeaderboard(scores: any[], allPicks: Pick[], games: Game[]): DailyLeaderboardEntry[] {
  const picksByUser = new Map<string, Map<string, Pick>>()
  allPicks.forEach(p => {
    if (!picksByUser.has(p.user_id)) picksByUser.set(p.user_id, new Map())
    picksByUser.get(p.user_id)!.set(p.game_id, p)
  })

  return scores
    .map(s => ({
      user_id: s.user_id,
      display_name: s.profiles?.display_name || 'Unknown',
      correct_picks: s.correct_picks,
      total_picks: s.total_picks,
      total_points: s.total_points,
      blocks: games.map(g => {
        const pick = picksByUser.get(s.user_id)?.get(g.id)
        return pick?.is_correct === true ? '🟩' : pick?.is_correct === false ? '🟥' : '⬜'
      }),
    }))
    .sort((a, b) => b.correct_picks - a.correct_picks || b.total_points - a.total_points)
}
