import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { calculatePoints } from '@/lib/points'

// Runs at 11pm EST (4:00 UTC next day)
// Finalizes today's slate: calculates points, updates streaks
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return finalize()
}

// POST for manual trigger from admin
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  return finalize(body.slate_id)
}

async function finalize(specificSlateId?: string) {
  try {
    const supabase = createAdminClient()

    // Get the slate to finalize
    let slate: any

    if (specificSlateId) {
      const { data } = await supabase
        .from('slates')
        .select('*')
        .eq('id', specificSlateId)
        .single()
      slate = data
    } else {
      // Get today's slate (or most recent locked one)
      const now = new Date()
      const estDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))
      const today = estDate.toISOString().split('T')[0]

      const { data } = await supabase
        .from('slates')
        .select('*')
        .eq('date', today)
        .in('status', ['open', 'locked'])
        .single()
      slate = data
    }

    if (!slate) {
      return NextResponse.json({ message: 'No slate to finalize' })
    }

    // Check all games are final
    const { data: games } = await supabase
      .from('games')
      .select('*')
      .eq('slate_id', slate.id)

    const allFinal = games?.every(g => g.status === 'final')
    const totalGames = games?.length || 0

    if (!allFinal && !specificSlateId) {
      // Not all games final yet - only skip if not manually triggered
      const finalCount = games?.filter(g => g.status === 'final').length || 0
      return NextResponse.json({
        message: `Not all games final yet (${finalCount}/${totalGames})`,
      })
    }

    // Get all users who made picks for this slate
    const { data: picks } = await supabase
      .from('picks')
      .select('user_id, is_correct')
      .eq('slate_id', slate.id)

    if (!picks || picks.length === 0) {
      // No picks, just finalize the slate
      await supabase.from('slates').update({ status: 'finalized' }).eq('id', slate.id)
      return NextResponse.json({ message: 'Slate finalized (no picks)' })
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
      // Get current streak
      const { data: streakData } = await supabase
        .from('streaks')
        .select('*')
        .eq('user_id', userId)
        .single()

      let currentStreak = 1 // at least 1 for today

      if (streakData) {
        const lastPlayed = streakData.last_played_date
        const yesterday = new Date(slate.date)
        yesterday.setDate(yesterday.getDate() - 1)
        const yesterdayStr = yesterday.toISOString().split('T')[0]

        if (lastPlayed === yesterdayStr) {
          // Consecutive day - extend streak
          currentStreak = streakData.current_streak + 1
        }
        // else streak resets to 1
      }

      // Calculate points
      const points = calculatePoints(correct, total, currentStreak)

      // Upsert daily score
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

      // Upsert streak
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

    // Mark slate as finalized
    await supabase.from('slates').update({ status: 'finalized' }).eq('id', slate.id)

    return NextResponse.json({
      message: `Slate finalized! ${results.length} users scored.`,
      results,
    })
  } catch (err: any) {
    console.error('Finalize error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
