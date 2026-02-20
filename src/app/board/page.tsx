'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'
import type { Slate, Profile } from '@/types'
import { getTodayEST, formatDate } from '@/lib/dates'
import BottomNav from '@/components/BottomNav'

interface Player {
  display_name: string
  picks_count: number
  total_games: number
  locked_in: boolean
}

export default function BoardPage() {
  const router = useRouter()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [slate, setSlate] = useState<Slate | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }

    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
    setProfile(profileData)

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

    try {
      const res = await fetch(`/api/slate-activity?slate_id=${slateData.id}`)
      const data = await res.json()
      setPlayers(data.players || [])
    } catch (err) {
      console.error('Board fetch error:', err)
    }

    setLoading(false)
  }, [router])

  useEffect(() => { fetchData() }, [fetchData])

  return (
    <div className="max-w-lg mx-auto px-4 pb-24" style={{ maxWidth: '32rem', marginLeft: 'auto', marginRight: 'auto' }}>
      {loading ? (
        <div className="flex items-center justify-center min-h-screen">
          <div className="w-6 h-6 border-2 border-[var(--fire)] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Header */}
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
              <h2 className="text-xl font-bold mb-2" style={{ fontFamily: 'var(--font-display)' }}>
                No slate today
              </h2>
              <p className="text-[var(--text-secondary)] text-sm">
                Check back tomorrow.
              </p>
            </div>
          )}

          {slate && players.length === 0 && (
            <div className="text-center py-20">
              <div className="text-5xl mb-4">👀</div>
              <h2 className="text-xl font-bold mb-2" style={{ fontFamily: 'var(--font-display)' }}>
                No picks yet
              </h2>
              <p className="text-[var(--text-secondary)] text-sm">
                Be the first to make your picks.
              </p>
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
