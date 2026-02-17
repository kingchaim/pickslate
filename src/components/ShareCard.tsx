'use client'

import { DailyScore, Profile, Streak } from '@/types'
import { formatDate } from '@/lib/dates'
import { getPerformanceLabel, getStreakEmoji, getStreakLabel, getLeaderboardTitle } from '@/lib/points'

interface ShareCardProps {
  score: DailyScore
  profile: Profile
  streak: Streak | null
  date: string
  rank?: number
  totalMembers?: number
}

export default function ShareCard({ score, profile, streak, date, rank, totalMembers }: ShareCardProps) {
  const pct = score.total_picks > 0
    ? Math.round((score.correct_picks / score.total_picks) * 100)
    : 0
  const label = getPerformanceLabel(score.correct_picks, score.total_picks)
  const streakEmoji = getStreakEmoji(streak?.current_streak || 0)

  const streakLabel = getStreakLabel(streak?.current_streak || 0)
  const leaderboardTitle = getLeaderboardTitle(rank || 0, totalMembers || 0)

  // Generate the colored blocks (like Wordle)
  const blocks = Array.from({ length: score.total_picks }, (_, i) => {
    return i < score.correct_picks ? '🟩' : '🟥'
  })

  const shareText = `🍆 PICKSLATE — ${formatDate(date)}

${score.correct_picks}/${score.total_picks} — ${label}
${blocks.join('')}
${streak && streak.current_streak >= 3 ? `${streakEmoji} ${streakLabel} (${streak.current_streak} day streak)` : ''}
+${score.total_points} pts${leaderboardTitle ? ` · ${leaderboardTitle}` : ''}

pickslate.vercel.app/join/DICKS`

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          text: shareText,
        })
      } catch {
        // User cancelled
      }
    } else {
      await navigator.clipboard.writeText(shareText)
      // Show toast
      const toast = document.createElement('div')
      toast.className = 'toast'
      toast.textContent = 'Copied to clipboard!'
      document.body.appendChild(toast)
      setTimeout(() => toast.remove(), 2000)
    }
  }

  return (
    <div id="share-card" className="share-card p-6 max-w-sm mx-auto">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <div className="text-2xl font-black" style={{ fontFamily: 'var(--font-display)' }}>
            <span className="text-[var(--fire)]">PICK</span>
            <span>SLATE</span>
          </div>
          <div className="text-xs text-[var(--text-muted)] mt-1">{formatDate(date)}</div>
        </div>
        {rank && totalMembers && (
          <div className="text-right">
            <div className="text-xs text-[var(--text-muted)]">Rank</div>
            <div className="text-lg font-black" style={{ fontFamily: 'var(--font-mono)' }}>
              #{rank}
              <span className="text-xs text-[var(--text-muted)]">/{totalMembers}</span>
            </div>
          </div>
        )}
      </div>

      {/* Score */}
      <div className="text-center mb-6">
        <div className="text-6xl font-black mb-1" style={{ fontFamily: 'var(--font-display)' }}>
          {score.correct_picks}/{score.total_picks}
        </div>
        <div className="text-sm font-bold text-[var(--fire)]">
          {label}
        </div>
      </div>

      {/* Blocks */}
      <div className="flex justify-center gap-1.5 mb-6">
        {blocks.map((block, i) => (
          <div
            key={i}
            className={`w-8 h-8 rounded-md flex items-center justify-center text-sm ${
              block === '🟩'
                ? 'bg-[var(--neon-green)] bg-opacity-20 border border-[var(--neon-green)] border-opacity-40'
                : 'bg-[var(--neon-red)] bg-opacity-20 border border-[var(--neon-red)] border-opacity-40'
            }`}
          >
            {block === '🟩' ? '✓' : '✗'}
          </div>
        ))}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="text-center">
          <div className="text-xs text-[var(--text-muted)]">Points</div>
          <div className="text-lg font-bold text-[var(--fire)]" style={{ fontFamily: 'var(--font-mono)' }}>
            +{score.total_points}
          </div>
        </div>
        <div className="text-center">
          <div className="text-xs text-[var(--text-muted)]">Streak</div>
          <div className="text-lg font-bold" style={{ fontFamily: 'var(--font-mono)' }}>
            {streak?.current_streak || 0} {streakEmoji}
          </div>
          {streakLabel && (
            <div className="text-[10px] text-[var(--fire)] font-semibold mt-0.5">{streakLabel}</div>
          )}
        </div>
        <div className="text-center">
          <div className="text-xs text-[var(--text-muted)]">Accuracy</div>
          <div className="text-lg font-bold" style={{ fontFamily: 'var(--font-mono)' }}>
            {pct}%
          </div>
        </div>
      </div>

      {/* Player + Title */}
      <div className="text-center mb-4">
        <div className="text-sm font-semibold text-[var(--text-secondary)]">
          {profile.display_name}
        </div>
        {leaderboardTitle && (
          <div className="text-xs text-[var(--fire)] font-bold mt-1">
            {leaderboardTitle}
          </div>
        )}
      </div>

      {/* Share button */}
      <button
        onClick={handleShare}
        className="w-full py-3 bg-[var(--fire)] text-white font-bold rounded-xl transition-all hover:brightness-110 active:scale-[0.98] glow-fire"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        SHARE 🔥
      </button>
    </div>
  )
}
