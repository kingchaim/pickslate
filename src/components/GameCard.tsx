'use client'

import { Game, Pick, SPORT_EMOJIS } from '@/types'
import { formatTime, isGameLocked, timeUntil } from '@/lib/dates'

interface GameCardProps {
  game: Game
  pick?: Pick
  onPick: (gameId: string, selection: 'home' | 'away') => void
  index: number
  finalized?: boolean
  justPicked?: boolean
}

function LockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}

export default function GameCard({ game, pick, onPick, index, finalized, justPicked }: GameCardProps) {
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
      className={`pick-card relative bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-2xl p-4 animate-slide-up stagger-${index + 1} ${
        locked && !finalized ? 'locked' : ''
      } ${getTeamClass(pick?.pick || 'home')} ${justPicked ? 'just-picked' : ''}`}
    >
      {/* Lock icon overlay for locked games */}
      {locked && !finalized && (
        <div className="lock-overlay text-[var(--text-muted)]">
          <LockIcon />
        </div>
      )}

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
            <span className="text-[10px] font-bold text-[var(--neon-red)] uppercase flex items-center gap-1">
              <LockIcon /> Locked
            </span>
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
          className={`flex-1 py-3 px-3 rounded-xl text-center transition-all duration-200 ${
            pick?.pick === 'away'
              ? 'bg-[var(--fire)] bg-opacity-10 border-2 border-[var(--fire)] glow-pulse'
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
            {game.away_team}
          </div>
          <div className="text-[10px] text-[var(--text-muted)]" style={{ fontFamily: 'var(--font-mono)' }}>
            {game.away_team_abbr}
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
          className={`flex-1 py-3 px-3 rounded-xl text-center transition-all duration-200 ${
            pick?.pick === 'home'
              ? 'bg-[var(--fire)] bg-opacity-10 border-2 border-[var(--fire)] glow-pulse'
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
            {game.home_team}
          </div>
          <div className="text-[10px] text-[var(--text-muted)]" style={{ fontFamily: 'var(--font-mono)' }}>
            {game.home_team_abbr}
          </div>
          {game.status === 'final' && game.home_score !== null && (
            <div className="text-lg font-black mt-1" style={{ fontFamily: 'var(--font-mono)' }}>
              {game.home_score}
            </div>
          )}
        </button>
      </div>

      {/* Pick indicator — fire-colored divider lines */}
      {pick && !finalized && (
        <div className="mt-2 flex items-center justify-center gap-2">
          <div className="flex-1 h-px bg-gradient-to-r from-transparent to-[var(--fire)]" />
          <span className="text-[10px] font-semibold text-[var(--fire)] uppercase tracking-wider">
            {pick.pick === 'home' ? game.home_team : game.away_team}
          </span>
          <div className="flex-1 h-px bg-gradient-to-l from-transparent to-[var(--fire)]" />
        </div>
      )}
    </div>
  )
}
