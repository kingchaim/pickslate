import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    // Get the authenticated user from the request cookies
    const cookieStore = cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: CookieOptions) {
            cookieStore.set({ name, value, ...options })
          },
          remove(name: string, options: CookieOptions) {
            cookieStore.delete({ name, ...options })
          },
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Use admin client to bypass RLS
    const admin = createAdminClient()

    // Check if profile exists
    const { data: existing } = await admin
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .single()

    if (existing) {
      return NextResponse.json({ profile: existing })
    }

    // Create profile
    const { data: profile, error } = await admin
      .from('profiles')
      .insert({
        id: user.id,
        email: user.email,
        display_name: user.email?.split('@')[0] || null,
      })
      .select()
      .single()

    if (error) {
      console.error('ensure-profile error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ profile })
  } catch (err: any) {
    console.error('ensure-profile error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
