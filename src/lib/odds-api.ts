// The Odds API integration
// Docs: https://the-odds-api.com/lv/guides/v4/

const BASE_URL = 'https://api.the-odds-api.com/v4'

// Sports we care about, in priority order
const SPORTS = [
  'basketball_nba',
  'americanfootball_nfl',
  'icehockey_nhl',
  'baseball_mlb',
  'basketball_ncaab',
  'americanfootball_ncaaf',
  'soccer_epl',
  'soccer_usa_mls',
] as const

// Map API sport keys to our short codes
const SPORT_MAP: Record<string, string> = {
  basketball_nba: 'nba',
  americanfootball_nfl: 'nfl',
  icehockey_nhl: 'nhl',
  baseball_mlb: 'mlb',
  basketball_ncaab: 'ncaab',
  americanfootball_ncaaf: 'ncaaf',
  soccer_epl: 'epl',
  soccer_usa_mls: 'mls',
}

export interface OddsGame {
  id: string
  sport_key: string
  sport_title: string
  commence_time: string // ISO
  home_team: string
  away_team: string
  bookmakers: {
    key: string
    title: string
    markets: {
      key: string
      outcomes: {
        name: string
        price: number
      }[]
    }[]
  }[]
}

export interface RankedGame {
  external_id: string
  sport: string
  home_team: string
  away_team: string
  home_team_abbr: string
  away_team_abbr: string
  commence_time: string
  competitiveness: number // 0-1, higher = more competitive (closer odds)
  sport_priority: number
}

// Abbreviate team names (take first 3 chars of last word, or known abbrevs)
function abbreviate(name: string): string {
  // Common NBA/NFL/NHL abbreviations
  const KNOWN: Record<string, string> = {
    'Los Angeles Lakers': 'LAL', 'Los Angeles Clippers': 'LAC',
    'Golden State Warriors': 'GSW', 'New York Knicks': 'NYK',
    'Brooklyn Nets': 'BKN', 'San Antonio Spurs': 'SAS',
    'Oklahoma City Thunder': 'OKC', 'Portland Trail Blazers': 'POR',
    'New Orleans Pelicans': 'NOP', 'Minnesota Timberwolves': 'MIN',
    'Sacramento Kings': 'SAC', 'Philadelphia 76ers': 'PHI',
    'Milwaukee Bucks': 'MIL', 'Boston Celtics': 'BOS',
    'Miami Heat': 'MIA', 'Chicago Bulls': 'CHI',
    'Dallas Mavericks': 'DAL', 'Houston Rockets': 'HOU',
    'Denver Nuggets': 'DEN', 'Phoenix Suns': 'PHX',
    'Utah Jazz': 'UTA', 'Cleveland Cavaliers': 'CLE',
    'Atlanta Hawks': 'ATL', 'Toronto Raptors': 'TOR',
    'Charlotte Hornets': 'CHA', 'Indiana Pacers': 'IND',
    'Detroit Pistons': 'DET', 'Orlando Magic': 'ORL',
    'Washington Wizards': 'WAS', 'Memphis Grizzlies': 'MEM',
    // NFL
    'Kansas City Chiefs': 'KC', 'Buffalo Bills': 'BUF',
    'San Francisco 49ers': 'SF', 'Dallas Cowboys': 'DAL',
    'Philadelphia Eagles': 'PHI', 'New York Giants': 'NYG',
    'New York Jets': 'NYJ', 'New England Patriots': 'NE',
    'Green Bay Packers': 'GB', 'Tampa Bay Buccaneers': 'TB',
    'Las Vegas Raiders': 'LV', 'Los Angeles Rams': 'LAR',
    'Los Angeles Chargers': 'LAC', 'Baltimore Ravens': 'BAL',
    'Pittsburgh Steelers': 'PIT', 'Cincinnati Bengals': 'CIN',
    'Cleveland Browns': 'CLE', 'Jacksonville Jaguars': 'JAX',
    'Tennessee Titans': 'TEN', 'Indianapolis Colts': 'IND',
    'Houston Texans': 'HOU', 'Denver Broncos': 'DEN',
    'Seattle Seahawks': 'SEA', 'Arizona Cardinals': 'ARI',
    'Atlanta Falcons': 'ATL', 'Carolina Panthers': 'CAR',
    'New Orleans Saints': 'NO', 'Minnesota Vikings': 'MIN',
    'Chicago Bears': 'CHI', 'Detroit Lions': 'DET',
    'Washington Commanders': 'WAS', 'Miami Dolphins': 'MIA',
  }
  if (KNOWN[name]) return KNOWN[name]
  // Fallback: first 3 chars of last word
  const parts = name.split(' ')
  return parts[parts.length - 1].substring(0, 3).toUpperCase()
}

// Calculate how competitive a game is from moneyline odds
// Closer odds = more competitive = higher score
function getCompetitiveness(game: OddsGame): number {
  // Find h2h (moneyline) market from first bookmaker
  for (const bm of game.bookmakers) {
    const h2h = bm.markets.find(m => m.key === 'h2h')
    if (h2h && h2h.outcomes.length >= 2) {
      const prices = h2h.outcomes.map(o => o.price)
      // Convert American-style or decimal odds to implied probability
      const probs = prices.map(p => {
        if (p >= 2) {
          // Decimal odds
          return 1 / p
        }
        return 0.5
      })
      // Competitiveness = 1 - abs(prob1 - prob2)
      // When probs are equal (50/50), competitiveness = 1
      const diff = Math.abs(probs[0] - probs[1])
      return Math.max(0, 1 - diff)
    }
  }
  return 0.5 // default if no odds found
}

// Fetch all today's games across all sports
export async function fetchTodaysGames(): Promise<RankedGame[]> {
  const apiKey = process.env.THE_ODDS_API_KEY
  if (!apiKey) throw new Error('THE_ODDS_API_KEY not set')

  const allGames: RankedGame[] = []

  // Get today's date range (EST)
  const now = new Date()
  const todayStart = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date(todayStart)
  todayEnd.setHours(23, 59, 59, 999)

  for (let i = 0; i < SPORTS.length; i++) {
    const sport = SPORTS[i]
    try {
      const url = `${BASE_URL}/sports/${sport}/odds/?apiKey=${apiKey}&regions=us&markets=h2h&oddsFormat=decimal`
      const res = await fetch(url)

      if (!res.ok) {
        console.log(`Skipping ${sport}: ${res.status}`)
        continue
      }

      const games: OddsGame[] = await res.json()

      // Filter to today's games only (EST)
      const todaysGames = games.filter(g => {
        const gameTime = new Date(g.commence_time)
        const gameEST = new Date(gameTime.toLocaleString('en-US', { timeZone: 'America/New_York' }))
        return gameEST >= todayStart && gameEST <= todayEnd
      })

      for (const game of todaysGames) {
        allGames.push({
          external_id: game.id,
          sport: SPORT_MAP[sport] || sport,
          home_team: game.home_team,
          away_team: game.away_team,
          home_team_abbr: abbreviate(game.home_team),
          away_team_abbr: abbreviate(game.away_team),
          commence_time: game.commence_time,
          competitiveness: getCompetitiveness(game),
          sport_priority: i, // lower = higher priority sport
        })
      }
    } catch (err) {
      console.error(`Error fetching ${sport}:`, err)
    }
  }

  return allGames
}

// Pick the best 7 games from all available
export function pickTop7(games: RankedGame[]): RankedGame[] {
  if (games.length <= 7) return games.sort((a, b) => new Date(a.commence_time).getTime() - new Date(b.commence_time).getTime())

  // Score each game:
  // - Competitiveness weight: 60%
  // - Sport diversity bonus: 20% (prefer mix of sports)
  // - Prime time bonus: 20% (games 6pm-10pm EST)
  const scored = games.map(g => {
    const gameHour = new Date(g.commence_time).getHours()
    const primeTimeBonus = (gameHour >= 18 && gameHour <= 22) ? 0.2 : 0

    // Base score
    const score = (g.competitiveness * 0.6) + primeTimeBonus + ((1 - g.sport_priority / SPORTS.length) * 0.2)

    return { ...g, score }
  })

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score)

  // Pick top 7 but ensure sport diversity (max 3 from same sport)
  const selected: (typeof scored[0])[] = []
  const sportCount: Record<string, number> = {}

  for (const game of scored) {
    if (selected.length >= 7) break
    const count = sportCount[game.sport] || 0
    if (count >= 3) continue // max 3 per sport
    selected.push(game)
    sportCount[game.sport] = count + 1
  }

  // If we don't have 7, fill from remaining
  if (selected.length < 7) {
    for (const game of scored) {
      if (selected.length >= 7) break
      if (!selected.find(s => s.external_id === game.external_id)) {
        selected.push(game)
      }
    }
  }

  // Sort by game time
  return selected.sort((a, b) => new Date(a.commence_time).getTime() - new Date(b.commence_time).getTime())
}

// Fetch scores for games
export async function fetchScores(sportKey: string): Promise<any[]> {
  const apiKey = process.env.THE_ODDS_API_KEY
  if (!apiKey) throw new Error('THE_ODDS_API_KEY not set')

  // Map our short code back to API key
  const reverseMap: Record<string, string> = {}
  for (const [apiKey, short] of Object.entries(SPORT_MAP)) {
    reverseMap[short] = apiKey
  }

  const fullKey = reverseMap[sportKey]
  if (!fullKey) return []

  const url = `${BASE_URL}/sports/${fullKey}/scores/?apiKey=${apiKey}&daysFrom=1`
  const res = await fetch(url)
  if (!res.ok) return []
  return res.json()
}
