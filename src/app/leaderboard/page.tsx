'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'
import BottomNav from '@/components/BottomNav'
import type { Profile } from '@/types'
import { getStreakEmoji, getLeaderboardTitle } from '@/lib/points'

interface LeaderboardEntry {
  user_id: string
  display_name: string
  total_points: number
  days_played: number
  current_streak: number
  total_correct: number
  total_games: number
}

export default function LeaderboardPage() {
  const supabase = createClient()
  const router = useRouter()
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string>('')
  const [profile, setProfile] = useState<Profile | null>(null)

  useEffect(() => {
    const fetchLeaderboard = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      setCurrentUserId(user.id)

      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      setProfile(profileData)

      // Get all daily scores with profiles
      const { data: scores } = await supabase
        .from('daily_scores')
        .select('user_id, total_points, correct_picks, total_picks, profiles(display_name)')

      // Get streaks
      const { data: streaks } = await supabase
        .from('streaks')
        .select('user_id, current_streak')

      if (!scores) { setLoading(false); return }

      // Aggregate by user
      const userMap = new Map<string, LeaderboardEntry>()

      scores.forEach((s: any) => {
        const existing = userMap.get(s.user_id) || {
          user_id: s.user_id,
          display_name: s.profiles?.display_name || 'Unknown',
          total_points: 0,
          days_played: 0,
          current_streak: 0,
          total_correct: 0,
          total_games: 0,
        }
        existing.total_points += s.total_points
        existing.days_played += 1
        existing.total_correct += s.correct_picks
        existing.total_games += s.total_picks
        userMap.set(s.user_id, existing)
      })

      // Add streaks
      streaks?.forEach((s: any) => {
        const entry = userMap.get(s.user_id)
        if (entry) entry.current_streak = s.current_streak
      })

      // Sort by total points
      const sorted = Array.from(userMap.values()).sort((a, b) => b.total_points - a.total_points)
      setEntries(sorted)
      setLoading(false)
    }

    fetchLeaderboard()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-6 h-6 border-2 border-[var(--fire)] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto px-4 pb-24">
      {/* Header */}
      <div className="pt-6 pb-6">
        <div className="text-2xl font-black" style={{ fontFamily: 'var(--font-display)' }}>
          <span className="text-[var(--fire)]">LEADER</span>
          <span>BOARD</span>
        </div>
        <p className="text-xs text-[var(--text-muted)] mt-0.5">All-time standings</p>
      </div>

      {entries.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-5xl mb-4">🏆</div>
          <h2 className="text-xl font-bold mb-2" style={{ fontFamily: 'var(--font-display)' }}>
            No scores yet
          </h2>
          <p className="text-[var(--text-secondary)] text-sm">
            Play today&apos;s slate to get on the board.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry, index) => {
            const isMe = entry.user_id === currentUserId
            const pct = entry.total_games > 0
              ? Math.round((entry.total_correct / entry.total_games) * 100)
              : 0

            return (
              <div
                key={entry.user_id}
                className={`flex items-center gap-4 p-4 rounded-2xl border transition-all animate-slide-up stagger-${Math.min(index + 1, 7)} ${
                  isMe
                    ? 'bg-[var(--fire)] bg-opacity-5 border-[var(--fire)] border-opacity-30'
                    : 'bg-[var(--bg-card)] border-[var(--border-subtle)]'
                }`}
              >
                {/* Rank */}
                <div className="w-8 text-center flex-shrink-0">
                  {index === 0 ? (
                    <span className="text-xl">👑</span>
                  ) : index === 1 ? (
                    <span className="text-lg">🥈</span>
                  ) : index === 2 ? (
                    <span className="text-lg">🥉</span>
                  ) : (
                    <span className="text-sm font-bold text-[var(--text-muted)]" style={{ fontFamily: 'var(--font-mono)' }}>
                      {index + 1}
                    </span>
                  )}
                </div>

                {/* Name & stats */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm truncate" style={{ fontFamily: 'var(--font-display)' }}>
                      {entry.display_name}
                    </span>
                    {isMe && (
                      <span className="text-[10px] font-bold text-[var(--fire)] bg-[var(--fire)] bg-opacity-10 px-1.5 py-0.5 rounded">
                        YOU
                      </span>
                    )}
                    {entry.current_streak >= 3 && (
                      <span className="text-xs">
                        {getStreakEmoji(entry.current_streak)} {entry.current_streak}
                      </span>
                    )}
                  </div>
                  {getLeaderboardTitle(index + 1, entries.length) && (
                    <div className="text-[10px] font-bold text-[var(--fire)] mt-0.5">
                      {getLeaderboardTitle(index + 1, entries.length)}
                    </div>
                  )}
                  <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
                    {entry.total_correct}/{entry.total_games} ({pct}%) · {entry.days_played}d played
                  </div>
                </div>

                {/* Points */}
                <div className="text-right flex-shrink-0">
                  <div className="text-lg font-black text-[var(--fire)]" style={{ fontFamily: 'var(--font-mono)' }}>
                    {entry.total_points.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-[var(--text-muted)]">pts</div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <BottomNav isAdmin={profile?.is_admin} />
    </div>
  )
}
