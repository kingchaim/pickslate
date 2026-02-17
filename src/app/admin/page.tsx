'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'
import BottomNav from '@/components/BottomNav'
import type { Slate, Game, Profile } from '@/types'
import { getTodayEST, formatTime } from '@/lib/dates'

export default function AdminPage() {
  const supabase = createClient()
  const router = useRouter()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [slate, setSlate] = useState<Slate | null>(null)
  const [games, setGames] = useState<Game[]>([])
  const [actionLoading, setActionLoading] = useState('')
  const [log, setLog] = useState<string[]>([])

  const addLog = (msg: string) => setLog(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev])

  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupCode, setNewGroupCode] = useState('')

  const fetchData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }

    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (!profileData?.is_admin) {
      router.push('/picks')
      return
    }
    setProfile(profileData)

    const today = getTodayEST()
    const { data: slateData } = await supabase
      .from('slates')
      .select('*')
      .eq('date', today)
      .single()
    setSlate(slateData)

    if (slateData) {
      const { data: gamesData } = await supabase
        .from('games')
        .select('*')
        .eq('slate_id', slateData.id)
        .order('commence_time')
      setGames(gamesData || [])
    }

    setLoading(false)
  }, [supabase, router])

  useEffect(() => { fetchData() }, [fetchData])

  const triggerFetchSlate = async () => {
    setActionLoading('fetch')
    addLog('Fetching today\'s games from The Odds API...')
    try {
      const res = await fetch('/api/cron/fetch-slate', { method: 'POST' })
      const data = await res.json()
      addLog(data.message || JSON.stringify(data))
      if (data.games) {
        data.games.forEach((g: string) => addLog(`  → ${g}`))
      }
      fetchData()
    } catch (err: any) {
      addLog(`ERROR: ${err.message}`)
    }
    setActionLoading('')
  }

  const triggerCheckScores = async () => {
    setActionLoading('scores')
    addLog('Checking scores...')
    try {
      const res = await fetch('/api/cron/check-scores', {
        headers: { 'Authorization': `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET || 'manual'}` }
      })
      const data = await res.json()
      addLog(data.message || JSON.stringify(data))
      if (data.updates) {
        data.updates.forEach((u: string) => addLog(`  → ${u}`))
      }
      fetchData()
    } catch (err: any) {
      addLog(`ERROR: ${err.message}`)
    }
    setActionLoading('')
  }

  const triggerFinalize = async () => {
    if (!slate) return
    setActionLoading('finalize')
    addLog('Finalizing slate and calculating points...')
    try {
      const res = await fetch('/api/cron/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slate_id: slate.id }),
      })
      const data = await res.json()
      addLog(data.message || JSON.stringify(data))
      if (data.results) {
        data.results.forEach((r: string) => addLog(`  → ${r}`))
      }
      fetchData()
    } catch (err: any) {
      addLog(`ERROR: ${err.message}`)
    }
    setActionLoading('')
  }

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) return
    const { error } = await supabase.from('groups').insert({
      name: newGroupName,
      invite_code: newGroupCode.toUpperCase(),
      created_by: profile.id,
    })
    if (error) {
      addLog(`Group error: ${error.message}`)
    } else {
      addLog(`Group "${newGroupName}" created! Invite code: ${newGroupCode.toUpperCase()}`)
      setNewGroupName('')
      setNewGroupCode('')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-6 h-6 border-2 border-[var(--fire)] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const finalCount = games.filter(g => g.status === 'final').length
  const liveCount = games.filter(g => g.status === 'live').length

  return (
    <div className="max-w-lg mx-auto px-4 pb-24">
      {/* Header */}
      <div className="pt-6 pb-4">
        <div className="text-2xl font-black" style={{ fontFamily: 'var(--font-display)' }}>
          <span className="text-[var(--fire)]">AD</span><span>MIN</span>
        </div>
        <p className="text-xs text-[var(--text-muted)] mt-0.5">Automated controls</p>
      </div>

      {/* Slate Status */}
      <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-2xl p-4 mb-4">
        <div className="flex justify-between items-center mb-3">
          <span className="text-sm font-bold" style={{ fontFamily: 'var(--font-display)' }}>Today&apos;s Slate</span>
          <span className={`text-xs font-bold px-2 py-1 rounded ${
            slate?.status === 'finalized' ? 'bg-green-500/20 text-green-400' :
            slate?.status === 'locked' ? 'bg-yellow-500/20 text-yellow-400' :
            slate ? 'bg-blue-500/20 text-blue-400' : 'bg-red-500/20 text-red-400'
          }`}>
            {slate?.status?.toUpperCase() || 'NO SLATE'}
          </span>
        </div>

        {slate && (
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-lg font-bold" style={{ fontFamily: 'var(--font-mono)' }}>{games.length}</div>
              <div className="text-[10px] text-[var(--text-muted)]">Games</div>
            </div>
            <div>
              <div className="text-lg font-bold text-yellow-400" style={{ fontFamily: 'var(--font-mono)' }}>{liveCount}</div>
              <div className="text-[10px] text-[var(--text-muted)]">Live</div>
            </div>
            <div>
              <div className="text-lg font-bold text-green-400" style={{ fontFamily: 'var(--font-mono)' }}>{finalCount}</div>
              <div className="text-[10px] text-[var(--text-muted)]">Final</div>
            </div>
          </div>
        )}
      </div>

      {/* Games list */}
      {games.length > 0 && (
        <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-2xl p-4 mb-4">
          <div className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-3">Games</div>
          <div className="space-y-2">
            {games.map(g => (
              <div key={g.id} className="flex justify-between items-center text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-[var(--text-muted)] uppercase w-10">{g.sport}</span>
                  <span className="font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
                    {g.away_team_abbr} @ {g.home_team_abbr}
                  </span>
                </div>
                <div className="text-right">
                  {g.status === 'final' ? (
                    <span className="text-xs text-green-400 font-mono">
                      {g.away_score}-{g.home_score} ✓
                    </span>
                  ) : g.status === 'live' ? (
                    <span className="text-xs text-yellow-400 font-mono">
                      {g.away_score}-{g.home_score} LIVE
                    </span>
                  ) : (
                    <span className="text-xs text-[var(--text-muted)] font-mono">
                      {formatTime(g.commence_time)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="space-y-3 mb-6">
        <button
          onClick={triggerFetchSlate}
          disabled={!!actionLoading}
          className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {actionLoading === 'fetch' ? 'FETCHING...' : '🔄 FETCH TODAY\'S SLATE'}
        </button>

        <button
          onClick={triggerCheckScores}
          disabled={!!actionLoading || !slate}
          className="w-full py-3 bg-yellow-600 text-white font-bold rounded-xl transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {actionLoading === 'scores' ? 'CHECKING...' : '📊 CHECK SCORES NOW'}
        </button>

        <button
          onClick={triggerFinalize}
          disabled={!!actionLoading || !slate || slate.status === 'finalized'}
          className="w-full py-3 bg-green-600 text-white font-bold rounded-xl transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {actionLoading === 'finalize' ? 'FINALIZING...' : '✅ FINALIZE & AWARD POINTS'}
        </button>
      </div>

      {/* Create Group */}
      <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-2xl p-4 mb-4">
        <div className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-3">Create Group</div>
        <form onSubmit={handleCreateGroup} className="space-y-3">
          <input
            type="text"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            placeholder="Group name"
            required
            className="w-full px-3 py-2.5 bg-[var(--bg-primary)] border border-[var(--border-subtle)] rounded-xl text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--fire)]"
          />
          <input
            type="text"
            value={newGroupCode}
            onChange={(e) => setNewGroupCode(e.target.value)}
            placeholder="Invite code (e.g. DICKS)"
            required
            className="w-full px-3 py-2.5 bg-[var(--bg-primary)] border border-[var(--border-subtle)] rounded-xl text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--fire)] uppercase"
            style={{ fontFamily: 'var(--font-mono)' }}
          />
          <button
            type="submit"
            className="w-full py-2.5 bg-[var(--fire)] text-white font-bold rounded-xl text-sm"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            CREATE GROUP
          </button>
        </form>
      </div>

      {/* Log */}
      {log.length > 0 && (
        <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-2xl p-4">
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Log</span>
            <button onClick={() => setLog([])} className="text-xs text-[var(--text-muted)] underline">Clear</button>
          </div>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {log.map((l, i) => (
              <div key={i} className="text-xs text-[var(--text-secondary)] font-mono leading-relaxed">
                {l}
              </div>
            ))}
          </div>
        </div>
      )}

      <BottomNav isAdmin={true} />
    </div>
  )
}
