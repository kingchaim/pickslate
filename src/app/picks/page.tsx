'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'
import type { Game, Pick, Slate, Profile, Streak } from '@/types'
import { getTodayEST } from '@/lib/dates'
import { POINTS, calculatePoints, getStreakEmoji } from '@/lib/points'
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
  const [activityCount, setActivityCount] = useState(0)
  const [activityNames, setActivityNames] = useState<string[]>([])

  // New premium UX state
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [onboardingDismissed, setOnboardingDismissed] = useState(true)
  const [justPickedGameId, setJustPickedGameId] = useState<string | null>(null)
  const [showSaved, setShowSaved] = useState(false)
  const [showCelebration, setShowCelebration] = useState(false)
  const [celebrationDismissed, setCelebrationDismissed] = useState(false)
  const [streak, setStreak] = useState<Streak | null>(null)

  // Initialize onboarding state from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const dismissed = localStorage.getItem('pickslate_onboarding_dismissed')
      if (!dismissed) {
        // First-time user: show expanded
        setShowOnboarding(true)
        setOnboardingDismissed(false)
      } else {
        // Returning user: collapsed pill
        setShowOnboarding(false)
        setOnboardingDismissed(true)
      }
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
      try {
        const res = await fetch('/api/ensure-profile', { method: 'POST' })
        if (res.ok) {
          const { profile } = await res.json()
          profileData = profile
        }
      } catch {}
    }
    setProfile(profileData)

    // Fetch streak data
    const { data: streakData } = await supabase
      .from('streaks')
      .select('*')
      .eq('user_id', authUser.id)
      .single()
    if (streakData) setStreak(streakData)

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

  // Track allPicked and trigger celebration
  useEffect(() => {
    const nowAllPicked = games.length > 0 && picks.size === games.length
    setAllPicked(nowAllPicked)
    if (nowAllPicked && !celebrationDismissed && picks.size > 0) {
      setShowCelebration(true)
    }
  }, [picks, games, celebrationDismissed])

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
        setShowCelebration(false)
      }
      return
    }

    // Haptic feedback (Android only, gracefully ignored elsewhere)
    try {
      if (navigator.vibrate) navigator.vibrate(10)
    } catch {}

    // Set justPicked for bounce animation
    setJustPickedGameId(gameId)
    setTimeout(() => setJustPickedGameId(null), 400)

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

      // Flash "Saved" indicator
      setShowSaved(true)
      setTimeout(() => setShowSaved(false), 1500)
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
  const currentStreak = streak?.current_streak || 0
  const streakEmoji = getStreakEmoji(currentStreak)

  // Calculate potential points
  const potentialPoints = (() => {
    if (games.length === 0) return 0
    const { total_points } = calculatePoints(picks.size, games.length, currentStreak)
    return total_points
  })()

  const perfectPoints = (() => {
    if (games.length === 0) return 0
    const { total_points } = calculatePoints(games.length, games.length, currentStreak)
    return total_points
  })()

  const activityText = (() => {
    if (activityCount <= 1) return null
    const othersCount = activityCount - 1
    if (activityNames.length > 0 && othersCount <= 2) {
      return `${activityNames.join(' and ')}${othersCount > activityNames.length ? ` and ${othersCount - activityNames.length} other` : ''} playing today`
    }
    return `${activityNames[0] || 'Someone'} and ${othersCount - 1} others are playing today`
  })()

  const handleDismissOnboarding = () => {
    setShowOnboarding(false)
    setOnboardingDismissed(true)
    localStorage.setItem('pickslate_onboarding_dismissed', '1')
  }

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
              {/* Streak display */}
              {currentStreak >= 3 && (
                <div className="text-[10px] text-[var(--fire)] font-semibold mt-0.5">
                  {streakEmoji} {currentStreak} day streak
                </div>
              )}
            </div>
          </div>

          {/* Progress bar — upgraded */}
          {slate && (
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs text-[var(--text-muted)]">
                  {picks.size}/{games.length} picked
                </span>
                {allPicked ? (
                  <span className="text-xs text-[var(--neon-green)] font-semibold animate-pulse">
                    All picked ✓
                  </span>
                ) : picks.size > 0 ? (
                  <span className="text-[10px] text-[var(--text-muted)]">
                    Potential: +{potentialPoints} pts
                  </span>
                ) : null}
              </div>
              <div className="h-1.5 bg-[var(--bg-card)] rounded-full overflow-hidden relative">
                <div
                  className={`h-full rounded-full transition-all duration-700 ease-out relative overflow-hidden ${
                    allPicked
                      ? 'bg-[var(--neon-green)]'
                      : 'bg-gradient-to-r from-[var(--fire)] to-[#ff8c00]'
                  }`}
                  style={{ width: `${games.length > 0 ? (picks.size / games.length) * 100 : 0}%` }}
                >
                  <div className="shimmer-overlay" />
                </div>
              </div>
              {/* Potential / perfect points */}
              <div className="flex justify-between items-center mt-1.5">
                {/* Social teaser */}
                {activityText ? (
                  <p className="text-[10px] text-[var(--text-muted)]">
                    {activityText}
                  </p>
                ) : <span />}
                {allPicked && (
                  <span className="text-[10px] font-semibold text-[var(--gold)]">
                    If perfect: +{perfectPoints} pts
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Combined Onboarding + Scoring Card */}
          {slate && (
            <>
              {showOnboarding ? (
                <div className="onboarding-card bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl px-4 py-4 mb-4">
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-xs font-bold text-[var(--text-primary)]" style={{ fontFamily: 'var(--font-display)' }}>
                      How to play & scoring
                    </span>
                    <button
                      onClick={handleDismissOnboarding}
                      className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-sm flex-shrink-0"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Numbered steps */}
                  <div className="space-y-2 mb-3">
                    <div className="flex items-start gap-2">
                      <span className="text-[10px] font-bold text-[var(--fire)] bg-[var(--fire)] bg-opacity-10 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
                      <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                        Pick the winner of each game — saves automatically
                      </p>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-[10px] font-bold text-[var(--fire)] bg-[var(--fire)] bg-opacity-10 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
                      <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                        Locks at tip-off — tap again to deselect before lock
                      </p>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-[10px] font-bold text-[var(--fire)] bg-[var(--fire)] bg-opacity-10 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
                      <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                        Perfect slate = bonus points
                      </p>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="border-t border-[var(--border-subtle)] my-3" />

                  {/* Scoring breakdown */}
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
              ) : onboardingDismissed ? (
                <div className="mb-4">
                  <button
                    onClick={() => setShowOnboarding(true)}
                    className="text-[10px] font-medium text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-full px-3 py-1"
                  >
                    How to play & scoring
                  </button>
                </div>
              ) : null}
            </>
          )}

          {/* Celebration banner */}
          {showCelebration && !celebrationDismissed && slate?.status === 'open' && (
            <div className="celebration-banner rounded-xl px-4 py-3 mb-4 flex items-center justify-between origin-top">
              <div>
                <p className="text-sm font-black tracking-wider" style={{ fontFamily: 'var(--font-display)' }}>
                  SLATE COMPLETE
                </p>
                <p className="text-[10px] font-medium opacity-80 mt-0.5">
                  All {games.length} picks locked in. Good luck!
                </p>
              </div>
              <button
                onClick={() => {
                  setShowCelebration(false)
                  setCelebrationDismissed(true)
                }}
                className="text-black opacity-60 hover:opacity-100 text-sm flex-shrink-0 ml-2"
              >
                ✕
              </button>
            </div>
          )}

          {/* "Saved" indicator — flashes top-right */}
          {showSaved && (
            <div className="save-indicator" style={{ position: 'fixed', top: 16, right: 16, zIndex: 50 }}>
              ✓ Saved
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
                justPicked={justPickedGameId === game.id}
              />
            ))}
          </div>

          {/* Lock picks button — text updated */}
          {slate && slate.status === 'open' && allPicked && (
            <div className="fixed bottom-20 left-0 right-0 px-4 z-40">
              <div className="max-w-lg mx-auto">
                <button
                  onClick={handleLockPicks}
                  disabled={saving}
                  className="w-full py-4 bg-[var(--fire)] text-white font-bold rounded-2xl text-lg transition-all hover:brightness-110 active:scale-[0.98] glow-fire animate-pulse-fire relative overflow-hidden"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  <span className="relative z-10">
                    {saving ? 'LOCKING...' : 'ALL LOCKED IN'}
                  </span>
                  <div className="shimmer-overlay" />
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
