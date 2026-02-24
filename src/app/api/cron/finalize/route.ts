import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { finalizeSlate } from '@/lib/finalize'

// Runs at 11pm EST (4:00 UTC next day)
// Finalizes today's slate: calculates points, updates streaks
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Find today's slate
  const supabase = createAdminClient()
  const now = new Date()
  const estDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))
  const today = estDate.toISOString().split('T')[0]

  const { data: slate } = await supabase
    .from('slates')
    .select('id')
    .eq('date', today)
    .in('status', ['open', 'locked'])
    .single()

  if (!slate) {
    return NextResponse.json({ message: 'No slate to finalize' })
  }

  const result = await finalizeSlate(slate.id)
  return NextResponse.json(result)
}

// POST for manual trigger from admin
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  if (!body.slate_id) {
    return NextResponse.json({ error: 'slate_id required' }, { status: 400 })
  }
  const result = await finalizeSlate(body.slate_id)
  return NextResponse.json(result)
}
