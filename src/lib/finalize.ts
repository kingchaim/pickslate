import { createAdminClient } from '@/lib/supabase-admin'
import { calculatePoints } from '@/lib/points'

export interface FinalizeResult {
  message: string
  results?: string[]
}

export async function finalizeSlate(slateId: string): Promise<FinalizeResult> {
  const supabase = createAdminClient()

  const { data: slate } = await supabase
    .from('slates')
    .select('*')
    .eq('id', slateId)
    .single()

  if (!slate) {
    return { message: 'No slate found' }
  }

  if (slate.status === 'finalized') {
    return { message: 'Slate already finalized' }
  }

  // Check all games are final
  const { data: games } = await supabase
    .from('games')
    .select('*')
    .eq('slate_id', slate.id)

  const allFinal = games?.every(g => g.status === 'final')
  if (!allFinal) {
    const finalCount = games?.filter(g => g.status === 'final').length || 0
    const totalGames = games?.length || 0
    return { message: `Not all games final yet (${finalCount}/${totalGames})` }
  }

  // Get all users who made picks for this slate
  const { data: picks } = await supabase
    .from('picks')
    .select('user_id, is_correct')
    .eq('slate_id', slate.id)

  if (!picks || picks.length === 0) {
    await supabase.from('slates').update({ status: 'finalized' }).eq('id', slate.id)
    return { message: 'Slate finalized (no picks)' }
  }

  // Group picks by user
  const userPicks: Record<string, { correct: number; total: number }> = {}
  for (const pick of picks) {
    if (!userPicks[pick.user_id]) {
      userPicks[pick.user_id] = { correct: 0, total: 0 }
    }
    userPicks[pick.user_id].total++
    if (pick.is_correct) userPicks[pick.user_id].correct++
  }

  const results: string[] = []

  // Calculate points and update streaks for each user
  for (const [userId, { correct, total }] of Object.entries(userPicks)) {
    const { data: streakData } = await supabase
      .from('streaks')
      .select('*')
      .eq('user_id', userId)
      .single()

    let currentStreak = 1

    if (streakData) {
      const lastPlayed = streakData.last_played_date
      const yesterday = new Date(slate.date)
      yesterday.setDate(yesterday.getDate() - 1)
      const yesterdayStr = yesterday.toISOString().split('T')[0]

      if (lastPlayed === yesterdayStr) {
        currentStreak = streakData.current_streak + 1
      }
    }

    const points = calculatePoints(correct, total, currentStreak)

    await supabase.from('daily_scores').upsert({
      user_id: userId,
      slate_id: slate.id,
      correct_picks: correct,
      total_picks: total,
      base_points: points.base_points,
      performance_points: points.performance_points,
      perfect_bonus: points.perfect_bonus,
      streak_bonus: points.streak_bonus,
      total_points: points.total_points,
    }, { onConflict: 'user_id,slate_id' })

    const longestStreak = Math.max(currentStreak, streakData?.longest_streak || 0)
    await supabase.from('streaks').upsert({
      user_id: userId,
      current_streak: currentStreak,
      longest_streak: longestStreak,
      last_played_date: slate.date,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })

    results.push(`${userId}: ${correct}/${total} = +${points.total_points}pts (streak: ${currentStreak})`)
  }

  await supabase.from('slates').update({ status: 'finalized' }).eq('id', slate.id)

  return {
    message: `Slate finalized! ${results.length} users scored.`,
    results,
  }
}
