import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { finalizeSlate } from '@/lib/finalize'

// Runs at 11pm EST (4:00 UTC next day)
// Finalizes any non-finalized slate (catches orphaned slates too)
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()

  // Find any non-finalized slate, not just today's
  const { data: slates } = await supabase
    .from('slates')
    .select('id, date')
    .in('status', ['open', 'locked'])
    .order('date', { ascending: true })

  if (!slates || slates.length === 0) {
    return NextResponse.json({ message: 'No slates to finalize' })
  }

  const results: string[] = []
  for (const slate of slates) {
    const result = await finalizeSlate(slate.id)
    results.push(`${slate.date}: ${result.message}`)
  }

  return NextResponse.json({ message: results.join('; '), results })
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
