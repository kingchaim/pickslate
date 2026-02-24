'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Slate, Profile, Pick } from '@/types'
import { getTodayEST, formatDate } from '@/lib/dates'
import { getPerformanceLabel } from '@/lib/points'
import { buildDailyLeaderboard, type DailyLeaderboardEntry } from '@/lib/daily-leaderboard'
import BottomNav from '@/components/BottomNav'

interface Player {
  display_name: string
  picks_count: number
  total_games: number
  locked_in: boolean
}

const RANK_ICONS = ['👑', '🥈', '🥉']

export default function BoardPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [slate, setSlate] = useState<Slate | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState('')
  const [finalizedSlate, setFinalizedSlate] = useState<Slate | null>(null)
  const [leaderboard, setLeaderboard] = useState<DailyLeaderboardEntry[]>([])

  const fetchData = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }
    setCurrentUserId(user.id)

    const today = getTodayEST()
    const [{ data: profileData }, { data: slateData }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('slates').select('*').eq('date', today).single(),
    ])
    setProfile(profileData)

    if (slateData && (slateData.status === 'open' || slateData.status === 'locked')) {
      setSlate(slateData)
      try {
        const res = await fetch(`/api/slate-activity?slate_id=${slateData.id}`)
        const data = await res.json()
        setPlayers(data.players || [])
      } catch (err) {
        console.error('Board fetch error:', err)
      }
      setLoading(false)
      return
    }

    const { data: recentFinalized } = await supabase
      .from('slates')
      .select('*')
      .eq('status', 'finalized')
      .order('date', { ascending: false })
      .limit(1)
      .single()

    if (!recentFinalized) {
      setSlate(slateData)
      setLoading(false)
      return
    }

    setFinalizedSlate(recentFinalized)

    const [{ data: scores }, { data: allPicks }, { data: gamesData }] = await Promise.all([
      supabase.from('daily_scores').select('*, profiles(display_name)').eq('slate_id', recentFinalized.id),
      supabase.from('picks').select('*').eq('slate_id', recentFinalized.id),
      supabase.from('games').select('*').eq('slate_id', recentFinalized.id).order('commence_time'),
    ])

    setLeaderboard(buildDailyLeaderboard(scores || [], (allPicks || []) as Pick[], gamesData || []))
    setLoading(false)
  }, [router])

  useEffect(() => { fetchData() }, [fetchData])

  return (
    <div className="max-w-lg mx-auto px-4 pb-24" style={{ maxWidth: '32rem', marginLeft: 'auto', marginRight: 'auto' }}>
      {loading ? (
        <div className="flex items-center justify-center min-h-screen">
          <div className="w-6 h-6 border-2 border-[var(--fire)] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : finalizedSlate ? (
        <>
          <div className="pt-6 pb-4">
            <div className="text-2xl font-black" style={{ fontFamily: 'var(--font-display)' }}>
              <span className="text-[var(--fire)]">RE</span><span>SULTS</span>
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              {formatDate(finalizedSlate.date)}
            </p>
          </div>

          {leaderboard.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-5xl mb-4">📊</div>
              <h2 className="text-xl font-bold mb-2" style={{ fontFamily: 'var(--font-display)' }}>No results yet</h2>
              <p className="text-[var(--text-secondary)] text-sm">Results appear after a slate is finalized.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {leaderboard.map((entry, index) => {
                const isMe = entry.user_id === currentUserId
                return (
                  <div
                    key={entry.user_id}
                    className={`flex items-center gap-3 p-3 rounded-2xl border transition-all animate-slide-up stagger-${Math.min(index + 1, 7)} ${
                      isMe
                        ? 'bg-[var(--fire)] bg-opacity-5 border-[var(--fire)] border-opacity-30'
                        : 'bg-[var(--bg-card)] border-[var(--border-subtle)]'
                    }`}
                  >
                    <div className="w-7 text-center flex-shrink-0">
                      {RANK_ICONS[index]
                        ? <span className="text-lg">{RANK_ICONS[index]}</span>
                        : <span className="text-sm font-bold text-[var(--text-muted)]" style={{ fontFamily: 'var(--font-mono)' }}>{index + 1}</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-sm truncate" style={{ fontFamily: 'var(--font-display)' }}>
                          {entry.display_name}
                        </span>
                        {isMe && (
                          <span className="text-[10px] font-bold text-[var(--fire)] bg-[var(--fire)] bg-opacity-10 px-1.5 py-0.5 rounded flex-shrink-0">
                            YOU
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 mt-1">
                        <span className="text-xs font-bold" style={{ fontFamily: 'var(--font-mono)' }}>
                          {entry.correct_picks}/{entry.total_picks}
                        </span>
                        <span className="text-xs tracking-tight">{entry.blocks.join('')}</span>
                      </div>
                      <div className="text-[10px] text-[var(--fire)] font-bold mt-0.5">
                        {getPerformanceLabel(entry.correct_picks, entry.total_picks)}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-lg font-black text-[var(--fire)]" style={{ fontFamily: 'var(--font-mono)' }}>
                        {entry.total_points}
                      </div>
                      <div className="text-[10px] text-[var(--text-muted)]">pts</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <div className="mt-6 text-center">
            <Link
              href="/leaderboard"
              className="text-sm text-[var(--fire)] font-semibold hover:underline"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              View all-time standings →
            </Link>
          </div>
        </>
      ) : (
        <>
          <div className="pt-6 pb-4">
            <div className="text-2xl font-black" style={{ fontFamily: 'var(--font-display)' }}>
              <span className="text-[var(--fire)]">TO</span><span>DAY</span>
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              {slate ? `${players.length} playing · ${formatDate(slate.date)}` : 'No slate today'}
            </p>
          </div>

          {!slate && (
            <div className="text-center py-20">
              <div className="text-5xl mb-4">😴</div>
              <h2 className="text-xl font-bold mb-2" style={{ fontFamily: 'var(--font-display)' }}>No slate today</h2>
              <p className="text-[var(--text-secondary)] text-sm">Check back tomorrow.</p>
            </div>
          )}

          {slate && players.length === 0 && (
            <div className="text-center py-20">
              <div className="text-5xl mb-4">👀</div>
              <h2 className="text-xl font-bold mb-2" style={{ fontFamily: 'var(--font-display)' }}>No picks yet</h2>
              <p className="text-[var(--text-secondary)] text-sm">Be the first to make your picks.</p>
            </div>
          )}

          {players.length > 0 && (
            <div className="space-y-2">
              {players.map((player, i) => (
                <div
                  key={i}
                  className={`bg-[var(--bg-card)] border rounded-xl px-4 py-3 flex items-center justify-between ${
                    player.locked_in ? 'border-[var(--fire)]' : 'border-[var(--border-subtle)]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-full bg-[var(--bg-primary)] border border-[var(--border-subtle)] flex items-center justify-center text-xs font-bold"
                      style={{ fontFamily: 'var(--font-mono)' }}
                    >
                      {player.display_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-sm font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
                        {player.display_name}
                      </div>
                      <div className="text-[10px] text-[var(--text-muted)]" style={{ fontFamily: 'var(--font-mono)' }}>
                        {player.picks_count}/{player.total_games} picked
                      </div>
                    </div>
                  </div>
                  {player.locked_in && (
                    <span className="text-[10px] font-bold text-black uppercase tracking-wider px-2 py-1 bg-[var(--fire)] rounded-lg">
                      Locked in
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <BottomNav isAdmin={profile?.is_admin} />
    </div>
  )
}
