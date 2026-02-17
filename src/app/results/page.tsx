'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'
import BottomNav from '@/components/BottomNav'
import ShareCard from '@/components/ShareCard'
import GameCard from '@/components/GameCard'
import type { DailyScore, Profile, Streak, Game, Pick } from '@/types'
import { getTodayEST, formatDate } from '@/lib/dates'

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

  useEffect(() => {
    const fetchResults = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }

      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      setProfile(profileData)

      // Get most recent finalized slate
      const { data: slateData } = await supabase
        .from('slates')
        .select('*')
        .eq('status', 'finalized')
        .order('date', { ascending: false })
        .limit(1)
        .single()

      if (!slateData) {
        setLoading(false)
        return
      }

      setSlateDate(slateData.date)

      const { data: scoreData } = await supabase
        .from('daily_scores')
        .select('*')
        .eq('slate_id', slateData.id)
        .eq('user_id', user.id)
        .single()
      setScore(scoreData)

      const { data: streakData } = await supabase
        .from('streaks')
        .select('*')
        .eq('user_id', user.id)
        .single()
      setStreak(streakData)

      const { data: gamesData } = await supabase
        .from('games')
        .select('*')
        .eq('slate_id', slateData.id)
        .order('commence_time')
      setGames(gamesData || [])

      const { data: picksData } = await supabase
        .from('picks')
        .select('*')
        .eq('slate_id', slateData.id)
        .eq('user_id', user.id)

      const picksMap = new Map<string, Pick>()
      picksData?.forEach((p: Pick) => picksMap.set(p.game_id, p))
      setPicks(picksMap)

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
        <ShareCard score={score} profile={profile} streak={streak} date={slateDate} />
      </div>

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
