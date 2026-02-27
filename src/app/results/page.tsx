'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'
import BottomNav from '@/components/BottomNav'
import ShareCard from '@/components/ShareCard'
import GameCard from '@/components/GameCard'
import type { DailyScore, Profile, Streak, Game, Pick } from '@/types'
import { formatDate } from '@/lib/dates'
import { buildDailyLeaderboard, type DailyLeaderboardEntry } from '@/lib/daily-leaderboard'

const RANK_ICONS = ['👑', '🥈', '🥉']

export default function ResultsPage() {
  const supabase = createClient()
  const router = useRouter()
  const [score, setScore] = useState<DailyScore | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [streak, setStreak] = useState<Streak | null>(null)
  const [loading, setLoading] = useState(true)
  const [slateDate, setSlateDate] = useState('')
  const [games, setGames] = useState<Game[]>([])
  const [picks, setPicks] = useState<Map<string, Pick>>(new Map())
  const [groupCode, setGroupCode] = useState<string | undefined>(undefined)
  const [leaderboard, setLeaderboard] = useState<DailyLeaderboardEntry[]>([])
  const [currentUserId, setCurrentUserId] = useState('')

  useEffect(() => {
    const fetchResults = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      setCurrentUserId(user.id)

      const [{ data: profileData }, { data: slateData }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('slates').select('*').eq('status', 'finalized').order('date', { ascending: false }).limit(1).single(),
      ])
      setProfile(profileData)

      if (!slateData) { setLoading(false); return }
      setSlateDate(slateData.date)

      const [{ data: streakData }, { data: gamesData }, { data: allPicks }, { data: memberData }, { data: allScores }] = await Promise.all([
        supabase.from('streaks').select('*').eq('user_id', user.id).single(),
        supabase.from('games').select('*').eq('slate_id', slateData.id).order('commence_time'),
        supabase.from('picks').select('*').eq('slate_id', slateData.id),
        supabase.from('group_members').select('groups(invite_code)').eq('user_id', user.id).limit(1).single(),
        supabase.from('daily_scores').select('*, profiles(display_name)').eq('slate_id', slateData.id),
      ])

      setStreak(streakData)
      setGames(gamesData || [])
      setScore(allScores?.find((s: any) => s.user_id === user.id) ?? null)

      const userPicks = new Map<string, Pick>()
      ;(allPicks as Pick[] | null)?.filter(p => p.user_id === user.id).forEach(p => userPicks.set(p.game_id, p))
      setPicks(userPicks)

      if (memberData?.groups) setGroupCode((memberData.groups as any).invite_code)

      setLeaderboard(buildDailyLeaderboard(allScores || [], (allPicks || []) as Pick[], gamesData || []))
      setLoading(false)
    }

    fetchResults()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-6 h-6 border-2 border-[var(--fire)] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!score || !profile) {
    return (
      <div className="max-w-lg mx-auto px-4 pb-24">
        <div className="pt-6 pb-6">
          <div className="text-2xl font-black" style={{ fontFamily: 'var(--font-display)' }}>
            <span className="text-[var(--fire)]">RE</span><span>SULTS</span>
          </div>
        </div>
        <div className="text-center py-20">
          <div className="text-5xl mb-4">📊</div>
          <h2 className="text-xl font-bold mb-2" style={{ fontFamily: 'var(--font-display)' }}>No results yet</h2>
          <p className="text-[var(--text-secondary)] text-sm">Results appear after a slate is finalized.</p>
        </div>
        <BottomNav isAdmin={profile?.is_admin} />
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto px-4 pb-24">
      <div className="pt-6 pb-4">
        <div className="text-2xl font-black" style={{ fontFamily: 'var(--font-display)' }}>
          <span className="text-[var(--fire)]">RE</span><span>SULTS</span>
        </div>
        <p className="text-xs text-[var(--text-muted)] mt-0.5">{formatDate(slateDate)}</p>
      </div>

      <div className="mb-8">
        <ShareCard score={score} profile={profile} streak={streak} date={slateDate} picks={picks} games={games} groupCode={groupCode} />
      </div>

      {leaderboard.length > 0 && (
        <div className="mb-8">
          <h3 className="text-sm font-bold text-[var(--text-muted)] uppercase tracking-wider mb-3" style={{ fontFamily: 'var(--font-display)' }}>
            How Everyone Did
          </h3>
          <div className="space-y-2">
            {leaderboard.map((entry, index) => {
              const isMe = entry.user_id === currentUserId
              return (
                <div
                  key={entry.user_id}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-all animate-slide-up stagger-${Math.min(index + 1, 7)} ${
                    isMe
                      ? 'bg-[var(--fire)] bg-opacity-5 border-[var(--fire)] border-opacity-30'
                      : 'bg-[var(--bg-card)] border-[var(--border-subtle)]'
                  }`}
                >
                  <div className="w-6 text-center flex-shrink-0">
                    {RANK_ICONS[index]
                      ? <span className="text-lg">{RANK_ICONS[index]}</span>
                      : <span className="text-xs font-bold text-[var(--text-muted)]" style={{ fontFamily: 'var(--font-mono)' }}>{index + 1}</span>}
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
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="text-xs font-bold" style={{ fontFamily: 'var(--font-mono)' }}>
                        {entry.correct_picks}/{entry.total_picks}
                      </span>
                      <span className="text-xs tracking-tight">{entry.blocks.join('')}</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className={`text-base font-black ${isMe ? 'text-white' : 'text-[var(--fire)]'}`} style={{ fontFamily: 'var(--font-mono)' }}>
                      {entry.total_points}
                    </div>
                    <div className="text-[10px] text-[var(--text-muted)]">pts</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="mb-4">
        <h3 className="text-sm font-bold text-[var(--text-muted)] uppercase tracking-wider" style={{ fontFamily: 'var(--font-display)' }}>
          Your Picks
        </h3>
      </div>

      <div className="space-y-3">
        {games.map((game, index) => (
          <GameCard
            key={game.id}
            game={game}
            pick={picks.get(game.id)}
            onPick={() => {}}
            index={index}
            finalized={true}
          />
        ))}
      </div>

      <BottomNav isAdmin={profile?.is_admin} />
    </div>
  )
}
