'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useRouter, useParams } from 'next/navigation'
import type { Group } from '@/types'

export default function JoinGroup() {
  const params = useParams()
  const code = (params.code as string)?.toUpperCase()
  const router = useRouter()
  const supabase = createClient()

  const [group, setGroup] = useState<Group | null>(null)
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    // Check if group exists
    const fetchGroup = async () => {
      const { data } = await supabase
        .from('groups')
        .select('*')
        .eq('invite_code', code)
        .single()

      if (data) {
        setGroup(data)
      } else {
        setError('Group not found')
      }

      // Check if user is already logged in
      const { data: { user } } = await supabase.auth.getUser()
      if (user && data) {
        // Auto-join and redirect
        await supabase.from('group_members').upsert({
          group_id: data.id,
          user_id: user.id,
        }, { onConflict: 'group_id,user_id' })
        router.push('/picks')
        return
      }

      setChecking(false)
    }

    fetchGroup()
  }, [code])

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/join/${code}`,
      },
    })

    if (authError) {
      setError(authError.message)
    } else {
      setSent(true)
    }
    setLoading(false)
  }

  if (checking) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-6 h-6 border-2 border-[var(--fire)] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error === 'Group not found') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center">
        <div className="text-4xl mb-4">🤷</div>
        <h1 className="text-xl font-bold mb-2" style={{ fontFamily: 'var(--font-display)' }}>
          Group not found
        </h1>
        <p className="text-[var(--text-secondary)]">
          Check your invite link and try again.
        </p>
        <a href="/" className="text-[var(--fire)] text-sm mt-4 underline underline-offset-4">
          Go home
        </a>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6">
      <div className="text-center mb-10 animate-fade-in">
        <div className="inline-block mb-6">
          <div className="text-4xl font-black tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
            <span className="text-[var(--fire)]">PICK</span>
            <span className="text-[var(--text-primary)]">SLATE</span>
          </div>
        </div>

        <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-2xl p-6 mb-6">
          <p className="text-[var(--text-muted)] text-xs uppercase tracking-widest mb-2">
            You&apos;re invited to join
          </p>
          <h1 className="text-2xl font-black" style={{ fontFamily: 'var(--font-display)' }}>
            {group?.name}
          </h1>
        </div>
      </div>

      {!sent ? (
        <form onSubmit={handleJoin} className="w-full max-w-sm animate-slide-up">
          <div className="space-y-4">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              className="w-full px-4 py-4 bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--fire)] transition-colors text-center text-lg"
              style={{ fontFamily: 'var(--font-mono)' }}
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-[var(--fire)] text-white font-bold rounded-xl text-lg transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50 glow-fire"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {loading ? 'Sending...' : `JOIN ${group?.name?.toUpperCase()} →`}
            </button>
          </div>
          <p className="text-[var(--text-muted)] text-xs text-center mt-4">
            We&apos;ll email you a magic link to get in.
          </p>
        </form>
      ) : (
        <div className="text-center animate-slide-up">
          <div className="text-4xl mb-4">📬</div>
          <h2 className="text-xl font-bold mb-2">Check your email</h2>
          <p className="text-[var(--text-secondary)]">
            Click the link, then you&apos;re in.
          </p>
        </div>
      )}
    </div>
  )
}
