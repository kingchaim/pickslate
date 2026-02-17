export interface Profile {
  id: string
  display_name: string | null
  email: string | null
  is_admin: boolean
  created_at: string
}

export interface Group {
  id: string
  name: string
  invite_code: string
  created_by: string
  created_at: string
}

export interface GroupMember {
  id: string
  group_id: string
  user_id: string
  joined_at: string
  profiles?: Profile
}

export interface Slate {
  id: string
  date: string
  status: 'open' | 'locked' | 'finalized'
  created_at: string
  games?: Game[]
}

export interface Game {
  id: string
  slate_id: string
  external_id: string | null
  sport: string
  home_team: string
  away_team: string
  home_team_abbr: string | null
  away_team_abbr: string | null
  commence_time: string
  home_score: number | null
  away_score: number | null
  winner: 'home' | 'away' | null
  status: 'upcoming' | 'live' | 'final'
}

export interface Pick {
  id: string
  user_id: string
  game_id: string
  slate_id: string
  pick: 'home' | 'away'
  is_correct: boolean | null
  locked_at: string
}

export interface DailyScore {
  id: string
  user_id: string
  slate_id: string
  correct_picks: number
  total_picks: number
  base_points: number
  performance_points: number
  perfect_bonus: number
  streak_bonus: number
  total_points: number
  profiles?: Profile
}

export interface Streak {
  id: string
  user_id: string
  current_streak: number
  longest_streak: number
  last_played_date: string | null
}

export interface LeaderboardEntry {
  user_id: string
  display_name: string
  total_points: number
  total_correct: number
  total_games: number
  current_streak: number
  days_played: number
}

// Sport mapping for display
export const SPORT_LABELS: Record<string, string> = {
  nba: 'NBA',
  nfl: 'NFL',
  nhl: 'NHL',
  mlb: 'MLB',
  ncaab: 'NCAAB',
  ncaaf: 'NCAAF',
  epl: 'EPL',
  mls: 'MLS',
}

export const SPORT_EMOJIS: Record<string, string> = {
  nba: '🏀',
  nfl: '🏈',
  nhl: '🏒',
  mlb: '⚾',
  ncaab: '🏀',
  ncaaf: '🏈',
  epl: '⚽',
  mls: '⚽',
}
