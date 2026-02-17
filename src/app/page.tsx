'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'

export default function Home() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [checking, setChecking] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        router.push('/picks')
      } else {
        setChecking(false)
      }
    })
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      alert(error.message)
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

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6">
      {/* Hero */}
      <div className="text-center mb-12 animate-fade-in">
        <div className="inline-block mb-6">
          <div className="text-5xl font-black tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
            <span className="text-[var(--fire)]">PICK</span>
            <span className="text-[var(--text-primary)]">SLATE</span>
          </div>
        </div>
        <p className="text-[var(--text-secondary)] text-lg max-w-sm mx-auto leading-relaxed">
          7 games. Pick winners. Flex on your friends.
        </p>
        <p className="text-[var(--text-muted)] text-sm mt-2">
          Takes 30 seconds. Updated daily.
        </p>
      </div>

      {/* Login */}
      {!sent ? (
        <form onSubmit={handleLogin} className="w-full max-w-sm animate-slide-up">
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
              {loading ? 'Sending...' : 'GET IN →'}
            </button>
          </div>
          <p className="text-[var(--text-muted)] text-xs text-center mt-4">
            We&apos;ll send you a magic link. No password needed.
          </p>
        </form>
      ) : (
        <div className="text-center animate-slide-up">
          <div className="text-4xl mb-4">📬</div>
          <h2 className="text-xl font-bold mb-2" style={{ fontFamily: 'var(--font-display)' }}>
            Check your email
          </h2>
          <p className="text-[var(--text-secondary)]">
            Click the link to get in.
          </p>
          <button
            onClick={() => setSent(false)}
            className="text-[var(--fire)] text-sm mt-4 underline underline-offset-4"
          >
            Try a different email
          </button>
        </div>
      )}

      {/* Footer */}
      <div className="absolute bottom-8 text-center">
        <p className="text-[var(--text-muted)] text-xs">
          Have an invite code?{' '}
          <a href="/join/DICKS" className="text-[var(--fire)] underline underline-offset-2">
            Join a group
          </a>
        </p>
      </div>
    </div>
  )
}
