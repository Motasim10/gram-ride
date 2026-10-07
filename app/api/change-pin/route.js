import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { normalizePin } from '@/lib/phoneAuth'

export const runtime = 'nodejs'

export async function POST(request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !anonKey || !serviceKey) {
    return NextResponse.json({ code: 'server', error: 'PIN change is not set up on the server yet.' }, { status: 500 })
  }

  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
  if (!token) {
    return NextResponse.json({ code: 'auth', error: 'Not logged in.' }, { status: 401 })
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

  const { data: userData, error: userError } = await admin.auth.getUser(token)
  if (userError || !userData?.user) {
    return NextResponse.json({ code: 'auth', error: 'Not logged in.' }, { status: 401 })
  }
  const user = userData.user

  const { data: profile } = await admin.from('profiles').select('is_admin').eq('user_id', user.id).single()
  if (profile?.is_admin) {
    return NextResponse.json({ code: 'admin', error: 'Admin accounts change their password in Supabase.' }, { status: 400 })
  }

  let body = {}
  try { body = await request.json() } catch { body = {} }
  const currentPin = normalizePin(body.currentPin)
  const newPin = normalizePin(body.newPin)

  if (!/^\d{6}$/.test(newPin)) {
    return NextResponse.json({ code: 'invalid', error: 'PIN must be 6 digits.' }, { status: 400 })
  }
  if (newPin === currentPin) {
    return NextResponse.json({ code: 'same', error: 'The new PIN must be different.' }, { status: 400 })
  }

  const anon = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { error: signInError } = await anon.auth.signInWithPassword({ email: user.email, password: currentPin })
  if (signInError) {
    return NextResponse.json({ code: 'wrong_current', error: 'The current PIN is wrong.' }, { status: 400 })
  }

  const { error: updateError } = await admin.auth.admin.updateUserById(user.id, { password: newPin })
  if (updateError) {
    return NextResponse.json({ code: 'server', error: updateError.message }, { status: 500 })
  }

  await admin.from('profiles').update({ must_change_pin: false }).eq('user_id', user.id)

  return NextResponse.json({ ok: true })
}