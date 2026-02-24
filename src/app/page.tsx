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

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
  }

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
        <div className="w-full max-w-sm animate-slide-up">
          <button
            onClick={handleGoogleLogin}
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

          <form onSubmit={handleLogin}>
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
        </div>
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
