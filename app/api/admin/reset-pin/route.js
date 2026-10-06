import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { randomInt } from 'crypto'

export const runtime = 'nodejs'

export async function POST(request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    return NextResponse.json({ error: 'PIN reset is not set up on the server yet.' }, { status: 500 })
  }

  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
  if (!token) {
    return NextResponse.json({ error: 'Not logged in.' }, { status: 401 })
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

  const { data: userData, error: userError } = await admin.auth.getUser(token)
  if (userError || !userData?.user) {
    return NextResponse.json({ error: 'Not logged in.' }, { status: 401 })
  }
  const caller = userData.user

  const { data: callerProfile } = await admin.from('profiles').select('is_admin').eq('user_id', caller.id).single()
  if (!callerProfile?.is_admin) {
    return NextResponse.json({ error: 'Only admins can reset PINs.' }, { status: 403 })
  }

  let body = {}
  try { body = await request.json() } catch { body = {} }
  const userId = typeof body.userId === 'string' ? body.userId : ''
  if (!userId) {
    return NextResponse.json({ error: 'Missing user.' }, { status: 400 })
  }

  const { data: target } = await admin
    .from('profiles')
    .select('user_id, name, phone, is_admin')
    .eq('user_id', userId)
    .single()
  if (!target) {
    return NextResponse.json({ error: 'User not found.' }, { status: 404 })
  }
  if (target.is_admin) {
    return NextResponse.json({ error: 'Admin accounts cannot be reset here.' }, { status: 400 })
  }

  const pin = String(randomInt(0, 1000000)).padStart(6, '0')

  const { error: updateError } = await admin.auth.admin.updateUserById(userId, { password: pin })
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  await admin.from('profiles').update({ must_change_pin: true }).eq('user_id', userId)
  await admin.from('pin_resets').insert({ admin_id: caller.id, user_id: userId })

  return NextResponse.json({ pin, name: target.name, phone: target.phone })
}