import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { finalizeSlate } from '@/lib/finalize'
import { fetchScoresForSport } from '@/lib/espn-api'

// Runs every 30 minutes via Vercel cron
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return checkScores()
}

// POST for manual trigger from admin
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  return checkScores(body.slate_id)
}

async function checkScores(specificSlateId?: string) {
  try {
    const supabase = createAdminClient()

    let slates: any[] = []

    if (specificSlateId) {
      const { data } = await supabase
        .from('slates')
        .select('*')
        .eq('id', specificSlateId)
        .single()
      if (data) slates = [data]
    } else {
      // Find ALL non-finalized slates — oldest first to clear backlog
      const { data } = await supabase
        .from('slates')
        .select('*')
        .in('status', ['open', 'locked'])
        .order('date', { ascending: true })
      slates = data || []
    }

    if (slates.length === 0) {
      return NextResponse.json({ message: 'No active slates found' })
    }

    const allUpdates: string[] = []

    for (const slate of slates) {
      const updates = await processSlate(supabase, slate)
      allUpdates.push(...updates)
    }

    return NextResponse.json({
      message: `Processed ${slates.length} slate(s): ${allUpdates.length} updates`,
      updates: allUpdates,
    })
  } catch (err: any) {
    console.error('Check scores error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

async function processSlate(supabase: any, slate: any): Promise<string[]> {
  const updates: string[] = []

  // Get games that aren't final yet
  const { data: games } = await supabase
    .from('games')
    .select('*')
    .eq('slate_id', slate.id)
    .neq('status', 'final')

  // All games already final — just finalize the slate
  if (!games || games.length === 0) {
    const result = await finalizeSlate(slate.id)
    updates.push(`${slate.date}: AUTO-FINALIZED (all games were final): ${result.message}`)
    return updates
  }

  // Group games by sport
  const sportGames: Record<string, typeof games> = {}
  for (const game of games) {
    if (!sportGames[game.sport]) sportGames[game.sport] = []
    sportGames[game.sport].push(game)
  }

  let newlyFinalized = 0

  for (const [sport, sportGamesList] of Object.entries(sportGames)) {
    try {
      const scores = await fetchScoresForSport(sport, slate.date)

      for (const game of sportGamesList) {
        const scoreData = scores.find(s =>
          s.home_team === game.home_team && s.away_team === game.away_team
        )
        if (!scoreData) continue

        if (scoreData.completed && scoreData.home_score !== null && scoreData.away_score !== null) {
          const winner = scoreData.home_score > scoreData.away_score ? 'home' : 'away'

          await supabase.from('games').update({
            home_score: scoreData.home_score,
            away_score: scoreData.away_score,
            winner,
            status: 'final',
          }).eq('id', game.id)

          await supabase.from('picks')
            .update({ is_correct: true })
            .eq('game_id', game.id)
            .eq('pick', winner)

          await supabase.from('picks')
            .update({ is_correct: false })
            .eq('game_id', game.id)
            .neq('pick', winner)

          newlyFinalized++
          updates.push(`${slate.date}: ${game.away_team_abbr} ${scoreData.away_score} - ${scoreData.home_score} ${game.home_team_abbr} (FINAL)`)
        } else if (scoreData.home_score !== null && scoreData.away_score !== null) {
          await supabase.from('games').update({
            home_score: scoreData.home_score,
            away_score: scoreData.away_score,
            status: 'live',
          }).eq('id', game.id)
        }
      }
    } catch (err) {
      console.error(`Error fetching scores for ${sport}:`, err)
    }
  }

  // Lock the slate if any game has started
  if (slate.status === 'open') {
    const { data: startedGames } = await supabase
      .from('games')
      .select('id')
      .eq('slate_id', slate.id)
      .in('status', ['live', 'final'])
      .limit(1)

    if (startedGames && startedGames.length > 0) {
      await supabase.from('slates').update({ status: 'locked' }).eq('id', slate.id)
      updates.push(`${slate.date}: Slate locked`)
    }
  }

  // Auto-finalize if all games are now final
  const { data: remaining } = await supabase
    .from('games')
    .select('id')
    .eq('slate_id', slate.id)
    .neq('status', 'final')
    .limit(1)

  if (!remaining || remaining.length === 0) {
    const result = await finalizeSlate(slate.id)
    updates.push(`${slate.date}: AUTO-FINALIZED: ${result.message}`)
  }

  return updates
}
