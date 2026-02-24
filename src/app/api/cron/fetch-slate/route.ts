import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { fetchTodaysGames, pickTop7 } from '@/lib/odds-api'

// Runs daily at 8am EST (12:00 UTC)
// Fetches all today's games, picks the best 7, creates the slate
export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createAdminClient()

    // Get today's date in EST
    const now = new Date()
    const estDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))
    const today = estDate.toISOString().split('T')[0]

    // Check if slate already exists
    const { data: existing } = await supabase
      .from('slates')
      .select('id')
      .eq('date', today)
      .single()

    if (existing) {
      return NextResponse.json({ message: 'Slate already exists', slate_id: existing.id })
    }

    // Fetch all today's games from The Odds API
    const allGames = await fetchTodaysGames()
    console.log(`Found ${allGames.length} total games today`)

    if (allGames.length === 0) {
      return NextResponse.json({ message: 'No games found today, no slate created' })
    }

    // Pick the top 7
    const top7 = pickTop7(allGames)
    console.log(`Selected ${top7.length} games for today's slate`)

    // Create slate
    const { data: slate, error: slateError } = await supabase
      .from('slates')
      .insert({ date: today, status: 'open' })
      .select()
      .single()

    if (slateError) throw slateError

    // Insert games
    const gamesToInsert = top7.map(g => ({
      slate_id: slate.id,
      external_id: g.external_id,
      sport: g.sport,
      home_team: g.home_team,
      away_team: g.away_team,
      home_team_abbr: g.home_team_abbr,
      away_team_abbr: g.away_team_abbr,
      commence_time: g.commence_time,
      status: 'upcoming',
      home_odds: g.home_odds,
      away_odds: g.away_odds,
    }))

    const { error: gamesError } = await supabase.from('games').insert(gamesToInsert)
    if (gamesError) throw gamesError

    return NextResponse.json({
      message: `Slate created with ${top7.length} games`,
      slate_id: slate.id,
      games: top7.map(g => `${g.away_team_abbr} @ ${g.home_team_abbr} (${g.sport})`),
    })
  } catch (err: any) {
    console.error('Fetch slate error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// Also allow POST for manual trigger from admin
export async function POST(request: Request) {
  // Skip auth check for manual trigger (admin-only page handles auth)
  try {
    const supabase = createAdminClient()

    const now = new Date()
    const estDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))
    const today = estDate.toISOString().split('T')[0]

    // Delete existing slate for today if any
    await supabase.from('slates').delete().eq('date', today)

    const allGames = await fetchTodaysGames()
    if (allGames.length === 0) {
      return NextResponse.json({ message: 'No games found today' })
    }

    const top7 = pickTop7(allGames)

    const { data: slate, error: slateError } = await supabase
      .from('slates')
      .insert({ date: today, status: 'open' })
      .select()
      .single()
    if (slateError) throw slateError

    const gamesToInsert = top7.map(g => ({
      slate_id: slate.id,
      external_id: g.external_id,
      sport: g.sport,
      home_team: g.home_team,
      away_team: g.away_team,
      home_team_abbr: g.home_team_abbr,
      away_team_abbr: g.away_team_abbr,
      commence_time: g.commence_time,
      status: 'upcoming',
      home_odds: g.home_odds,
      away_odds: g.away_odds,
    }))

    await supabase.from('games').insert(gamesToInsert)

    return NextResponse.json({
      message: `Slate created with ${top7.length} games`,
      slate_id: slate.id,
      games: top7.map(g => `${g.away_team_abbr} @ ${g.home_team_abbr} (${g.sport})`),
    })
  } catch (err: any) {
    console.error('Manual fetch slate error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
