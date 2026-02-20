import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

// Returns participant data for a slate (who's playing, pick counts)
// Only exposes display names and pick counts — no actual pick data
export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const slateId = url.searchParams.get('slate_id')
    if (!slateId) {
      return NextResponse.json({ error: 'slate_id required' }, { status: 400 })
    }

    const admin = createAdminClient()

    // Get picks for this slate
    const { data: picks, error: picksError } = await admin
      .from('picks')
      .select('user_id')
      .eq('slate_id', slateId)

    if (picksError) {
      console.error('slate-activity picks error:', picksError)
      return NextResponse.json({ count: 0, players: [], names: [] })
    }

    if (!picks || picks.length === 0) {
      return NextResponse.json({ count: 0, players: [], names: [] })
    }

    // Count picks per user
    const userPickCounts: Record<string, number> = {}
    for (const pick of picks) {
      userPickCounts[pick.user_id] = (userPickCounts[pick.user_id] || 0) + 1
    }
    const userIds = Object.keys(userPickCounts)

    // Get total games for this slate
    const { count: totalGames } = await admin
      .from('games')
      .select('id', { count: 'exact', head: true })
      .eq('slate_id', slateId)

    // Get profiles
    const { data: profiles, error: profilesError } = await admin
      .from('profiles')
      .select('id, display_name, email')
      .in('id', userIds)

    if (profilesError) {
      console.error('slate-activity profiles error:', profilesError)
    }

    const players = (profiles || []).map(p => ({
      display_name: p.display_name || p.email?.split('@')[0] || 'Anonymous',
      picks_count: userPickCounts[p.id] || 0,
      total_games: totalGames || 0,
      locked_in: (userPickCounts[p.id] || 0) >= (totalGames || 7),
    }))

    // Locked in first, then by pick count desc
    players.sort((a, b) => {
      if (a.locked_in !== b.locked_in) return b.locked_in ? 1 : -1
      return b.picks_count - a.picks_count
    })

    // First names for social teaser
    const names = (profiles || [])
      .map(p => (p.display_name || p.email?.split('@')[0] || 'Anonymous').split(' ')[0])
      .slice(0, 2)

    return NextResponse.json({
      count: userIds.length,
      players,
      names,
    })
  } catch (err: any) {
    console.error('slate-activity error:', err)
    return NextResponse.json({ count: 0, players: [], names: [] })
  }
}
