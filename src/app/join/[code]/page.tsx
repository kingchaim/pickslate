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

  const handleGoogleJoin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/join/${code}`,
      },
    })
  }

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
        <div className="w-full max-w-sm animate-slide-up">
          <button
            onClick={handleGoogleJoin}
            className="w-full py-4 bg-white text-[#333] font-semibold rounded-xl text-lg transition-all hover:bg-gray-50 active:scale-[0.98] flex items-center justify-center gap-3 border border-gray-200"
          >
            <svg width="20" height="20" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
            Continue with Google
          </button>

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-[var(--border-subtle)]" />
            <span className="text-xs text-[var(--text-muted)]">or</span>
            <div className="flex-1 h-px bg-[var(--border-subtle)]" />
          </div>

          <form onSubmit={handleJoin}>
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
        </div>
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
