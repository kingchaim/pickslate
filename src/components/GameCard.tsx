'use client'

import { Game, Pick, SPORT_EMOJIS } from '@/types'
import { formatTime, isGameLocked, timeUntil } from '@/lib/dates'

interface GameCardProps {
  game: Game
  pick?: Pick
  onPick: (gameId: string, selection: 'home' | 'away') => void
  index: number
  finalized?: boolean
}

export default function GameCard({ game, pick, onPick, index, finalized }: GameCardProps) {
  const locked = isGameLocked(game.commence_time)
  const sportEmoji = SPORT_EMOJIS[game.sport] || '🎮'

  const getTeamClass = (side: 'home' | 'away') => {
    if (finalized && pick) {
      if (pick.pick === side && pick.is_correct) return 'correct'
      if (pick.pick === side && !pick.is_correct) return 'incorrect'
    }
    if (pick?.pick === side) return side === 'home' ? 'selected-home' : 'selected-away'
    return ''
  }

  const handleClick = (side: 'home' | 'away') => {
    if (locked && !finalized) return
    if (finalized) return
    onPick(game.id, side)
  }

  return (
    <div
      className={`pick-card bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-2xl p-4 animate-slide-up stagger-${index + 1} ${
        locked && !finalized ? 'locked' : ''
      } ${getTeamClass(pick?.pick || 'home')}`}
    >
      {/* Header */}
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs">{sportEmoji}</span>
          <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
            {game.sport.toUpperCase()}
          </span>
        </div>
        <div className="text-right">
          {game.status === 'final' ? (
            <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Final</span>
          ) : locked ? (
            <span className="text-[10px] font-bold text-[var(--neon-red)] uppercase">Locked</span>
          ) : (
            <span className="text-[10px] font-mono text-[var(--text-muted)]">
              {formatTime(game.commence_time)} · {timeUntil(game.commence_time)}
            </span>
          )}
        </div>
      </div>

      {/* Matchup */}
      <div className="flex items-center gap-3">
        {/* Away team */}
        <button
          onClick={() => handleClick('away')}
          disabled={locked && !finalized}
          className={`flex-1 py-3 px-3 rounded-xl text-center transition-all ${
            pick?.pick === 'away'
              ? 'bg-[var(--fire)] bg-opacity-10 border-2 border-[var(--fire)]'
              : 'bg-[var(--bg-primary)] border-2 border-transparent hover:border-[var(--border-subtle)]'
          } ${
            finalized && game.winner === 'away'
              ? '!border-[var(--neon-green)] !bg-opacity-5'
              : ''
          } ${
            finalized && pick?.pick === 'away' && game.winner !== 'away'
              ? '!border-[var(--neon-red)] !bg-opacity-5 opacity-50'
              : ''
          } disabled:cursor-default`}
        >
          <div className="text-sm font-bold" style={{ fontFamily: 'var(--font-display)' }}>
            {game.away_team_abbr || game.away_team}
          </div>
          {game.status === 'final' && game.away_score !== null && (
            <div className="text-lg font-black mt-1" style={{ fontFamily: 'var(--font-mono)' }}>
              {game.away_score}
            </div>
          )}
        </button>

        {/* VS */}
        <div className="text-[10px] font-bold text-[var(--text-muted)] flex-shrink-0">
          {pick?.pick === 'away' && finalized && pick.is_correct ? '✅' :
           pick?.pick === 'away' && finalized && !pick.is_correct ? '❌' :
           pick?.pick === 'home' && finalized && pick.is_correct ? '✅' :
           pick?.pick === 'home' && finalized && !pick.is_correct ? '❌' :
           'VS'}
        </div>

        {/* Home team */}
        <button
          onClick={() => handleClick('home')}
          disabled={locked && !finalized}
          className={`flex-1 py-3 px-3 rounded-xl text-center transition-all ${
            pick?.pick === 'home'
              ? 'bg-[var(--fire)] bg-opacity-10 border-2 border-[var(--fire)]'
              : 'bg-[var(--bg-primary)] border-2 border-transparent hover:border-[var(--border-subtle)]'
          } ${
            finalized && game.winner === 'home'
              ? '!border-[var(--neon-green)] !bg-opacity-5'
              : ''
          } ${
            finalized && pick?.pick === 'home' && game.winner !== 'home'
              ? '!border-[var(--neon-red)] !bg-opacity-5 opacity-50'
              : ''
          } disabled:cursor-default`}
        >
          <div className="text-sm font-bold" style={{ fontFamily: 'var(--font-display)' }}>
            {game.home_team_abbr || game.home_team}
          </div>
          {game.status === 'final' && game.home_score !== null && (
            <div className="text-lg font-black mt-1" style={{ fontFamily: 'var(--font-mono)' }}>
              {game.home_score}
            </div>
          )}
        </button>
      </div>

      {/* Pick indicator */}
      {pick && !finalized && (
        <div className="mt-2 text-center">
          <span className="text-[10px] font-semibold text-[var(--fire)] uppercase tracking-wider">
            → {pick.pick === 'home' ? (game.home_team_abbr || game.home_team) : (game.away_team_abbr || game.away_team)}
          </span>
        </div>
      )}
    </div>
  )
}
