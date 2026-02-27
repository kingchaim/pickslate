// ESPN hidden API integration — free, no API key, no rate limits
// Endpoints: https://site.api.espn.com/apis/site/v2/sports/{category}/{league}/scoreboard

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports'

// In-season sports config
const ESPN_SPORTS = [
  { slug: 'basketball/nba', key: 'nba', priority: 0 },
  { slug: 'hockey/nhl', key: 'nhl', priority: 1 },
  { slug: 'basketball/mens-college-basketball', key: 'ncaab', priority: 2 },
] as const

// Known team abbreviations ESPN uses — map to our format
const TEAM_ABBR_OVERRIDES: Record<string, string> = {
  'GS': 'GSW', 'NY': 'NYK', 'SA': 'SAS', 'NO': 'NOP',
  'WSH': 'WAS', 'PHO': 'PHX', 'UTAH': 'UTA',
}

function normalizeAbbr(abbr: string): string {
  return TEAM_ABBR_OVERRIDES[abbr] || abbr
}

// American odds → decimal odds
// -700 → 1.143, +500 → 6.0
function americanToDecimal(american: string): number {
  const num = parseInt(american)
  if (num < 0) return (100 / Math.abs(num)) + 1
  return (num / 100) + 1
}

export interface ESPNGame {
  external_id: string
  sport: string
  home_team: string
  away_team: string
  home_team_abbr: string
  away_team_abbr: string
  commence_time: string
  competitiveness: number
  sport_priority: number
  home_odds: number | null
  away_odds: number | null
}

function parseESPNEvent(event: any, sportKey: string, sportPriority: number): ESPNGame | null {
  const comp = event.competitions?.[0]
  if (!comp) return null

  const home = comp.competitors?.find((c: any) => c.homeAway === 'home')
  const away = comp.competitors?.find((c: any) => c.homeAway === 'away')
  if (!home || !away) return null

  // Extract moneyline odds
  let homeOdds: number | null = null
  let awayOdds: number | null = null
  let competitiveness = 0.5

  const odds = comp.odds?.[0]
  if (odds?.moneyline) {
    const homeML = odds.moneyline.home?.close?.odds || odds.moneyline.home?.open?.odds
    const awayML = odds.moneyline.away?.close?.odds || odds.moneyline.away?.open?.odds
    if (homeML && awayML) {
      homeOdds = americanToDecimal(homeML)
      awayOdds = americanToDecimal(awayML)
      // Competitiveness: closer implied probs = more competitive
      const probHome = 1 / homeOdds
      const probAway = 1 / awayOdds
      competitiveness = Math.max(0, 1 - Math.abs(probHome - probAway))
    }
  }

  return {
    external_id: event.id,
    sport: sportKey,
    home_team: home.team.displayName,
    away_team: away.team.displayName,
    home_team_abbr: normalizeAbbr(home.team.abbreviation),
    away_team_abbr: normalizeAbbr(away.team.abbreviation),
    commence_time: event.date,
    competitiveness,
    sport_priority: sportPriority,
    home_odds: homeOdds,
    away_odds: awayOdds,
  }
}

// Fetch today's games across all in-season sports
export async function fetchTodaysGames(): Promise<ESPNGame[]> {
  const allGames: ESPNGame[] = []

  // Get today in EST as YYYYMMDD for ESPN date param
  const now = new Date()
  const est = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))
  const todayParam = est.toISOString().split('T')[0].replace(/-/g, '')

  for (const sport of ESPN_SPORTS) {
    try {
      const url = `${ESPN_BASE}/${sport.slug}/scoreboard?dates=${todayParam}`
      const res = await fetch(url, { next: { revalidate: 0 } })
      if (!res.ok) {
        console.log(`ESPN: skipping ${sport.key}: ${res.status}`)
        continue
      }

      const data = await res.json()
      const events = data.events || []

      for (const event of events) {
        // Skip games already final (we want upcoming/live for slate creation)
        const status = event.status?.type?.name
        if (status === 'STATUS_FINAL' || status === 'STATUS_POSTPONED') continue

        const game = parseESPNEvent(event, sport.key, sport.priority)
        if (game) allGames.push(game)
      }

      console.log(`ESPN: ${sport.key} → ${events.length} events, ${allGames.length} total upcoming`)
    } catch (err) {
      console.error(`ESPN: error fetching ${sport.key}:`, err)
    }
  }

  return allGames
}

// Pick the best 7 games — same algorithm as before
export function pickTop7(games: ESPNGame[]): ESPNGame[] {
  if (games.length <= 7) return games.sort((a, b) => new Date(a.commence_time).getTime() - new Date(b.commence_time).getTime())

  const scored = games.map(g => {
    // Prime time bonus: games 6-10pm EST
    const gameEST = new Date(new Date(g.commence_time).toLocaleString('en-US', { timeZone: 'America/New_York' }))
    const hour = gameEST.getHours()
    const primeTimeBonus = (hour >= 18 && hour <= 22) ? 0.2 : 0

    const score = (g.competitiveness * 0.6) + primeTimeBonus + ((1 - g.sport_priority / ESPN_SPORTS.length) * 0.2)
    return { ...g, score }
  })

  scored.sort((a, b) => b.score - a.score)

  // Max 3 per sport for diversity
  const selected: (typeof scored[0])[] = []
  const sportCount: Record<string, number> = {}

  for (const game of scored) {
    if (selected.length >= 7) break
    const count = sportCount[game.sport] || 0
    if (count >= 3) continue
    selected.push(game)
    sportCount[game.sport] = count + 1
  }

  // Backfill if needed (respects the cap this time)
  if (selected.length < 7) {
    for (const game of scored) {
      if (selected.length >= 7) break
      if (!selected.find(s => s.external_id === game.external_id)) {
        selected.push(game)
      }
    }
  }

  return selected.sort((a, b) => new Date(a.commence_time).getTime() - new Date(b.commence_time).getTime())
}

// ESPN score data for a single sport
export interface ESPNScoreResult {
  external_id: string
  completed: boolean
  home_team: string
  away_team: string
  home_score: number | null
  away_score: number | null
}

// Fetch scores for games — checks scoreboard for a given date (defaults to today)
export async function fetchScoresForSport(sportKey: string, date?: string): Promise<ESPNScoreResult[]> {
  const sport = ESPN_SPORTS.find(s => s.key === sportKey)
  if (!sport) return []

  try {
    const dateParam = date ? `?dates=${date.replace(/-/g, '')}` : ''
    const url = `${ESPN_BASE}/${sport.slug}/scoreboard${dateParam}`
    const res = await fetch(url, { next: { revalidate: 0 } })
    if (!res.ok) return []

    const data = await res.json()
    const results: ESPNScoreResult[] = []

    for (const event of (data.events || [])) {
      const comp = event.competitions?.[0]
      if (!comp) continue

      const home = comp.competitors?.find((c: any) => c.homeAway === 'home')
      const away = comp.competitors?.find((c: any) => c.homeAway === 'away')
      if (!home || !away) continue

      const status = event.status?.type?.name
      const completed = status === 'STATUS_FINAL'

      results.push({
        external_id: event.id,
        completed,
        home_team: home.team.displayName,
        away_team: away.team.displayName,
        home_score: home.score ? parseInt(home.score) : null,
        away_score: away.score ? parseInt(away.score) : null,
      })
    }

    return results
  } catch (err) {
    console.error(`ESPN: error fetching scores for ${sportKey}:`, err)
    return []
  }
}
