import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { finalizeSlate } from '@/lib/finalize'

const BASE_URL = 'https://api.the-odds-api.com/v4'

const SPORT_API_KEYS: Record<string, string> = {
  nba: 'basketball_nba',
  nfl: 'americanfootball_nfl',
  nhl: 'icehockey_nhl',
  mlb: 'baseball_mlb',
  ncaab: 'basketball_ncaab',
  ncaaf: 'americanfootball_ncaaf',
  epl: 'soccer_epl',
  mls: 'soccer_usa_mls',
}

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
    const apiKey = process.env.THE_ODDS_API_KEY
    if (!apiKey) throw new Error('THE_ODDS_API_KEY not set')

    let slate: any

    if (specificSlateId) {
      const { data } = await supabase
        .from('slates')
        .select('*')
        .eq('id', specificSlateId)
        .single()
      slate = data
    } else {
      // Get today's slate
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

    // Fetch scores per sport
    for (const [sport, sportGamesList] of Object.entries(sportGames)) {
      const apiSport = SPORT_API_KEYS[sport]
      if (!apiSport) continue

      try {
        const url = `${BASE_URL}/sports/${apiSport}/scores/?apiKey=${apiKey}&daysFrom=2`
        const res = await fetch(url)
        if (!res.ok) continue

        const scores: any[] = await res.json()

        for (const game of sportGamesList) {
          const scoreData = scores.find((s: any) => s.id === game.external_id)
          if (!scoreData) continue

          if (scoreData.completed) {
            const homeScore = scoreData.scores?.find((s: any) => s.name === game.home_team)
            const awayScore = scoreData.scores?.find((s: any) => s.name === game.away_team)

            if (homeScore && awayScore) {
              const hScore = parseInt(homeScore.score)
              const aScore = parseInt(awayScore.score)
              const winner = hScore > aScore ? 'home' : 'away'

              await supabase.from('games').update({
                home_score: hScore,
                away_score: aScore,
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
              updates.push(`${game.away_team_abbr} ${aScore} - ${hScore} ${game.home_team_abbr} (FINAL)`)
            }
          } else if (scoreData.scores) {
            const homeScore = scoreData.scores?.find((s: any) => s.name === game.home_team)
            const awayScore = scoreData.scores?.find((s: any) => s.name === game.away_team)

            if (homeScore && awayScore) {
              await supabase.from('games').update({
                home_score: parseInt(homeScore.score),
                away_score: parseInt(awayScore.score),
                status: 'live',
              }).eq('id', game.id)
            }
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
