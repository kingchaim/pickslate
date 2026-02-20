'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'
import type { Game, Pick, Slate, Profile } from '@/types'
import { getTodayEST } from '@/lib/dates'
import { POINTS } from '@/lib/points'
import GameCard from '@/components/GameCard'
import BottomNav from '@/components/BottomNav'

export default function PicksPage() {
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
  const [showHowItWorks, setShowHowItWorks] = useState(false)
  const [showScoring, setShowScoring] = useState(false)
  const [activityCount, setActivityCount] = useState(0)
  const [activityNames, setActivityNames] = useState<string[]>([])

  useEffect(() => {
    if (typeof window !== 'undefined' && !localStorage.getItem('pickslate_hiw_dismissed')) {
      setShowHowItWorks(true)
    }
  }, [])

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  const fetchData = useCallback(async () => {
    const supabase = createClient()

    // Get user
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) {
      router.push('/')
      return
    }
    setUser(authUser)

    // Get profile (ensure it exists — trigger may have missed this user)
    let { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .single()

    if (!profileData) {
      const { data: newProfile } = await supabase
        .from('profiles')
        .upsert({
          id: authUser.id,
          email: authUser.email,
          display_name: authUser.email?.split('@')[0] || null,
        }, { onConflict: 'id' })
        .select()
        .single()
      profileData = newProfile
    }
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
    const { data: picksData, error: picksError } = await supabase
      .from('picks')
      .select('*')
      .eq('slate_id', slateData.id)
      .eq('user_id', authUser.id)

    if (picksError) {
      console.error('Error loading picks:', picksError)
    }

    const picksMap = new Map<string, Pick>()
    picksData?.forEach(p => picksMap.set(p.game_id, p))
    setPicks(picksMap)

    // Fetch social activity
    try {
      const res = await fetch(`/api/slate-activity?slate_id=${slateData.id}`)
      if (res.ok) {
        const activity = await res.json()
        setActivityCount(activity.count)
        setActivityNames(activity.names || [])
      }
    } catch {}

    setLoading(false)
  }, [router])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    setAllPicked(games.length > 0 && picks.size === games.length)
  }, [picks, games])

  const handlePick = async (gameId: string, selection: 'home' | 'away') => {
    if (!user || !slate) return
    const supabase = createClient()

    const existingPick = picks.get(gameId)

    // Toggle off if clicking same pick
    if (existingPick?.pick === selection) {
      const { error } = await supabase.from('picks').delete().eq('id', existingPick.id)
      if (!error) {
        const newPicks = new Map(picks)
        newPicks.delete(gameId)
        setPicks(newPicks)
      }
      return
    }

    // Optimistic state update — show orange immediately
    const optimisticPick: Pick = {
      id: existingPick?.id || crypto.randomUUID(),
      user_id: user.id,
      game_id: gameId,
      slate_id: slate.id,
      pick: selection,
      is_correct: null,
      locked_at: existingPick?.locked_at || new Date().toISOString(),
    }
    const prevPicks = new Map(picks)
    const newPicks = new Map(picks)
    newPicks.set(gameId, optimisticPick)
    setPicks(newPicks)

    // Sync with DB
    const { data, error } = await supabase
      .from('picks')
      .upsert(
        {
          user_id: user.id,
          game_id: gameId,
          slate_id: slate.id,
          pick: selection,
        },
        { onConflict: 'user_id,game_id' }
      )
      .select()
      .single()

    if (data) {
      // Replace optimistic pick with actual server data
      const syncedPicks = new Map(picks)
      syncedPicks.set(gameId, data)
      setPicks(syncedPicks)
    } else if (error) {
      console.error('Pick error:', error)
      // Revert optimistic update
      setPicks(prevPicks)
      showToast(`Pick error: ${error.message || error.code || JSON.stringify(error)}`)
    }
  }

  const handleLockPicks = async () => {
    if (!allPicked) return
    setSaving(true)
    showToast('Picks locked! Good luck 🔥')
    setSaving(false)
  }

  const displayName = profile?.display_name || user?.email?.split('@')[0] || ''

  const activityText = (() => {
    if (activityCount <= 1) return null
    const othersCount = activityCount - 1
    if (activityNames.length > 0 && othersCount <= 2) {
      return `${activityNames.join(' and ')}${othersCount > activityNames.length ? ` and ${othersCount - activityNames.length} other` : ''} playing today`
    }
    return `${activityNames[0] || 'Someone'} and ${othersCount - 1} others are playing today`
  })()

  return (
    <div className="max-w-lg mx-auto px-4 pb-24" style={{ maxWidth: '32rem', marginLeft: 'auto', marginRight: 'auto' }}>
      {loading ? (
        <div className="flex items-center justify-center min-h-screen">
          <div className="w-6 h-6 border-2 border-[var(--fire)] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
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
                {displayName}
              </div>
            </div>
          </div>

          {/* Progress bar */}
          {slate && (
            <div className="mb-4">
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
                  style={{ width: `${games.length > 0 ? (picks.size / games.length) * 100 : 0}%` }}
                />
              </div>
              {/* Social teaser */}
              {activityText && (
                <p className="text-[10px] text-[var(--text-muted)] mt-2">
                  {activityText}
                </p>
              )}
            </div>
          )}

          {/* How it works */}
          {showHowItWorks && (
            <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl px-4 py-3 mb-4 flex items-start gap-3">
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed flex-1">
                <span className="font-semibold text-[var(--text-primary)]">How it works:</span>{' '}
                Pick the winner of each game before tip-off. Get points for every correct pick. Perfect slate = bonus points. Compete with friends on the leaderboard.
              </p>
              <button
                onClick={() => {
                  setShowHowItWorks(false)
                  localStorage.setItem('pickslate_hiw_dismissed', '1')
                }}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-sm flex-shrink-0 mt-0.5"
              >
                ✕
              </button>
            </div>
          )}

          {/* Scoring explainer */}
          {slate && (
            <div className="mb-4">
              <button
                onClick={() => setShowScoring(!showScoring)}
                className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors flex items-center gap-1"
              >
                <span>{showScoring ? '▾' : '▸'}</span>
                <span>How scoring works</span>
              </button>
              {showScoring && (
                <div className="mt-2 bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl px-4 py-3">
                  <div className="space-y-2 text-xs text-[var(--text-secondary)]" style={{ fontFamily: 'var(--font-mono)' }}>
                    <div className="flex justify-between">
                      <span>Base participation</span>
                      <span className="text-[var(--text-primary)]">+{POINTS.BASE_PARTICIPATION} pts</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Per correct pick</span>
                      <span className="text-[var(--text-primary)]">+{POINTS.PER_CORRECT} pts</span>
                    </div>
                    <div className="border-t border-[var(--border-subtle)] my-1" />
                    <div className="flex justify-between">
                      <span>5/7 correct</span>
                      <span className="text-[var(--gold)]">+{POINTS.THRESHOLD_5_OF_7} bonus</span>
                    </div>
                    <div className="flex justify-between">
                      <span>6/7 correct</span>
                      <span className="text-[var(--gold)]">+{POINTS.THRESHOLD_6_OF_7} bonus</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Perfect 7/7</span>
                      <span className="text-[var(--gold)]">+{POINTS.PERFECT_7_OF_7} bonus</span>
                    </div>
                    <div className="border-t border-[var(--border-subtle)] my-1" />
                    <div className="flex justify-between">
                      <span>3-day streak</span>
                      <span className="text-[var(--fire)]">+{POINTS.STREAK_3}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>7-day streak</span>
                      <span className="text-[var(--fire)]">+{POINTS.STREAK_7}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>14-day streak</span>
                      <span className="text-[var(--fire)]">+{POINTS.STREAK_14}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>30-day streak</span>
                      <span className="text-[var(--fire)]">+{POINTS.STREAK_30}</span>
                    </div>
                  </div>
                </div>
              )}
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
        </>
      )}

      <BottomNav isAdmin={profile?.is_admin} />
    </div>
  )
}
