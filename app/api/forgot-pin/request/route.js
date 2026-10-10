// FILE: app/api/forgot-pin/request/route.js   (new file)
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { normalizePhone } from '@/lib/phoneAuth'
import { sendSms } from '@/lib/sms'

const admin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })

const hash = (phone, code) =>
  crypto.createHash('sha256').update(`${phone}:${code}:${process.env.SUPABASE_SERVICE_ROLE_KEY}`).digest('hex')

export async function POST(req) {
  const { phone: raw } = await req.json().catch(() => ({}))
  const phone = normalizePhone(raw || '')
  // Always give the same answer, so nobody can discover which numbers are registered.
  const same = NextResponse.json({ ok: true })
  if (!phone) return NextResponse.json({ error: 'invalid' }, { status: 400 })

  const db = admin()

  // Rate limit: max 3 codes per number per hour, and 1 per minute.
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { data: recent } = await db.from('pin_otps').select('created_at').eq('phone', phone)
    .gte('created_at', since).order('created_at', { ascending: false })
  if (recent && recent.length >= 3) return same
  if (recent && recent[0] && Date.now() - new Date(recent[0].created_at).getTime() < 60 * 1000) return same

  // Only registered, non-admin phones get a code.
  const { data: profile } = await db.from('profiles').select('user_id, role').eq('phone', phone).maybeSingle()
  if (!profile || profile.role === 'admin') return same

  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0')
  await db.from('pin_otps').insert({
    phone,
    code_hash: hash(phone, code),
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  })
  await sendSms(phone, `Gram Ride code: ${code}. Valid for 10 minutes. Do not share it with anyone.`)
  return same
}