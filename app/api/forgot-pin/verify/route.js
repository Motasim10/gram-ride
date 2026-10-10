// FILE: app/api/forgot-pin/verify/route.js   (new file)
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { normalizePhone, normalizePin } from '@/lib/phoneAuth'

const admin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })

const hash = (phone, code) =>
  crypto.createHash('sha256').update(`${phone}:${code}:${process.env.SUPABASE_SERVICE_ROLE_KEY}`).digest('hex')

export async function POST(req) {
  const body = await req.json().catch(() => ({}))
  const phone = normalizePhone(body.phone || '')
  const code = String(body.code || '').trim()
  const newPin = normalizePin(body.newPin || '')
  const bad = (m) => NextResponse.json({ error: m }, { status: 400 })
  if (!phone || !/^\d{6}$/.test(code) || !newPin) return bad('check')

  const db = admin()
  const { data: otp } = await db.from('pin_otps').select('*').eq('phone', phone)
    .eq('used', false).order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (!otp || new Date(otp.expires_at) < new Date() || otp.attempts >= 5) {
    return bad('expired')
  }
  if (otp.code_hash !== hash(phone, code)) {
    await db.from('pin_otps').update({ attempts: otp.attempts + 1 }).eq('id', otp.id)
    return bad('wrong')
  }

  const { data: profile } = await db.from('profiles').select('user_id, role').eq('phone', phone).maybeSingle()
  if (!profile || profile.role === 'admin') return bad('expired')

  const { error } = await db.auth.admin.updateUserById(profile.user_id, { password: newPin })
  if (error) return bad('failed')
  await db.from('profiles').update({ must_change_pin: false }).eq('user_id', profile.user_id)
  await db.from('pin_otps').update({ used: true }).eq('id', otp.id)
  return NextResponse.json({ ok: true })
}