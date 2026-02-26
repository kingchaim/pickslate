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

    let slate: any

    if (specificSlateId) {
      const { data } = await supabase
        .from('slates')
        .select('*')
        .eq('id', specificSlateId)
        .single()
      slate = data
    } else {
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
      return NextResponse.json({ message: 'No active slate found' })
    }

    // Get games that aren't final yet
    const { data: games } = await supabase
      .from('games')
      .select('*')
      .eq('slate_id', slate.id)
      .neq('status', 'final')

    if (!games || games.length === 0) {
      return NextResponse.json({ message: 'All games already final' })
    }

    // Group games by sport
    const sportGames: Record<string, typeof games> = {}
    for (const game of games) {
      if (!sportGames[game.sport]) sportGames[game.sport] = []
      sportGames[game.sport].push(game)
    }

    const updates: string[] = []
    let newlyFinalized = 0

    // Fetch scores per sport from ESPN
    for (const [sport, sportGamesList] of Object.entries(sportGames)) {
      try {
        const scores = await fetchScoresForSport(sport)

        for (const game of sportGamesList) {
          // Match by team names (ESPN IDs may differ from what we stored)
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

            // Mark picks correct/incorrect
            await supabase.from('picks')
              .update({ is_correct: true })
              .eq('game_id', game.id)
              .eq('pick', winner)

            await supabase.from('picks')
              .update({ is_correct: false })
              .eq('game_id', game.id)
              .neq('pick', winner)

            newlyFinalized++
            updates.push(`${game.away_team_abbr} ${scoreData.away_score} - ${scoreData.home_score} ${game.home_team_abbr} (FINAL)`)
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

    // If first game has started, lock the slate
    if (slate.status === 'open') {
      const { data: startedGames } = await supabase
        .from('games')
        .select('id')
        .eq('slate_id', slate.id)
        .in('status', ['live', 'final'])
        .limit(1)

      if (startedGames && startedGames.length > 0) {
        await supabase.from('slates').update({ status: 'locked' }).eq('id', slate.id)
        updates.push('Slate locked (first game started)')
      }
    }

    // Auto-finalize: if all games are now final, calculate points immediately
    if (newlyFinalized > 0) {
      const { data: remaining } = await supabase
        .from('games')
        .select('id')
        .eq('slate_id', slate.id)
        .neq('status', 'final')
        .limit(1)

      if (!remaining || remaining.length === 0) {
        const finalizeResult = await finalizeSlate(slate.id)
        updates.push(`AUTO-FINALIZED: ${finalizeResult.message}`)
      }
    }

    return NextResponse.json({
      message: `Checked scores: ${updates.length} updates`,
      updates,
    })
  } catch (err: any) {
    console.error('Check scores error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
