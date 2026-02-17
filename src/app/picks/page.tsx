'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'
import type { Game, Pick, Slate, Profile } from '@/types'
import { getTodayEST } from '@/lib/dates'
import GameCard from '@/components/GameCard'
import BottomNav from '@/components/BottomNav'

export default function PicksPage() {
  const supabase = createClient()
  const router = useRouter()

  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [slate, setSlate] = useState<Slate | null>(null)
  const [games, setGames] = useState<Game[]>([])
  const [picks, setPicks] = useState<Map<string, Pick>>(new Map())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [allPicked, setAllPicked] = useState(false)
  const [toast, setToast] = useState('')

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  const fetchData = useCallback(async () => {
    // Get user
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) {
      router.push('/')
      return
    }
    setUser(authUser)

    // Get profile
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .single()
    setProfile(profileData)

    // Get today's slate
    const today = getTodayEST()
    const { data: slateData } = await supabase
      .from('slates')
      .select('*')
      .eq('date', today)
      .single()

    if (!slateData) {
      setSlate(null)
      setLoading(false)
      return
    }
    setSlate(slateData)

    // Get games for this slate
    const { data: gamesData } = await supabase
      .from('games')
      .select('*')
      .eq('slate_id', slateData.id)
      .order('commence_time', { ascending: true })
    setGames(gamesData || [])

    // Get user's picks for this slate
    const { data: picksData } = await supabase
      .from('picks')
      .select('*')
      .eq('slate_id', slateData.id)
      .eq('user_id', authUser.id)

    const picksMap = new Map<string, Pick>()
    picksData?.forEach(p => picksMap.set(p.game_id, p))
    setPicks(picksMap)

    setLoading(false)
  }, [supabase, router])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    setAllPicked(games.length > 0 && picks.size === games.length)
  }, [picks, games])

  const handlePick = async (gameId: string, selection: 'home' | 'away') => {
    if (!user || !slate) return

    const existingPick = picks.get(gameId)

    // Toggle off if clicking same pick
    if (existingPick?.pick === selection) {
      // Remove pick
      await supabase.from('picks').delete().eq('id', existingPick.id)
      const newPicks = new Map(picks)
      newPicks.delete(gameId)
      setPicks(newPicks)
      return
    }

    // Upsert pick
    const pickData = {
      user_id: user.id,
      game_id: gameId,
      slate_id: slate.id,
      pick: selection,
    }

    if (existingPick) {
      await supabase.from('picks').update({ pick: selection }).eq('id', existingPick.id)
      const newPicks = new Map(picks)
      newPicks.set(gameId, { ...existingPick, pick: selection })
      setPicks(newPicks)
    } else {
      const { data } = await supabase.from('picks').insert(pickData).select().single()
      if (data) {
        const newPicks = new Map(picks)
        newPicks.set(gameId, data)
        setPicks(newPicks)
      }
    }
  }

  const handleLockPicks = async () => {
    if (!allPicked) return
    setSaving(true)
    showToast('Picks locked! Good luck 🔥')
    setSaving(false)
  }

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
      <div className="pt-6 pb-4 flex justify-between items-center">
        <div>
          <div className="text-2xl font-black" style={{ fontFamily: 'var(--font-display)' }}>
            <span className="text-[var(--fire)]">PICK</span>
            <span>SLATE</span>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            {slate ? `Today's slate · ${games.length} games` : 'No slate today'}
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs text-[var(--text-muted)]">Hey,</div>
          <div className="text-sm font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
            {profile?.display_name}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      {slate && (
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-[var(--text-muted)]">
              {picks.size}/{games.length} picked
            </span>
            {allPicked && (
              <span className="text-xs text-[var(--neon-green)] font-semibold animate-pulse">
                All picked ✓
              </span>
            )}
          </div>
          <div className="h-1 bg-[var(--bg-card)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--fire)] rounded-full transition-all duration-500 ease-out"
              style={{ width: `${(picks.size / games.length) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* No slate */}
      {!slate && (
        <div className="text-center py-20">
          <div className="text-5xl mb-4">😴</div>
          <h2 className="text-xl font-bold mb-2" style={{ fontFamily: 'var(--font-display)' }}>
            No slate today
          </h2>
          <p className="text-[var(--text-secondary)] text-sm">
            Check back tomorrow for a fresh slate.
          </p>
        </div>
      )}

      {/* Finalized slate */}
      {slate?.status === 'finalized' && (
        <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-2xl p-4 mb-6 text-center">
          <p className="text-sm font-bold text-[var(--fire)]" style={{ fontFamily: 'var(--font-display)' }}>
            TODAY&apos;S SLATE IS FINALIZED
          </p>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Check the Results tab to see how you did →
          </p>
        </div>
      )}

      {/* Games */}
      <div className="space-y-3">
        {games.map((game, index) => (
          <GameCard
            key={game.id}
            game={game}
            pick={picks.get(game.id)}
            onPick={handlePick}
            index={index}
            finalized={slate?.status === 'finalized'}
          />
        ))}
      </div>

      {/* Lock picks button */}
      {slate && slate.status === 'open' && allPicked && (
        <div className="fixed bottom-20 left-0 right-0 px-4 z-40">
          <div className="max-w-lg mx-auto">
            <button
              onClick={handleLockPicks}
              disabled={saving}
              className="w-full py-4 bg-[var(--fire)] text-white font-bold rounded-2xl text-lg transition-all hover:brightness-110 active:scale-[0.98] glow-fire animate-pulse-fire"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {saving ? 'LOCKING...' : 'PICKS LOCKED ✓'}
            </button>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && <div className="toast">{toast}</div>}

      <BottomNav isAdmin={profile?.is_admin} />
    </div>
  )
}
