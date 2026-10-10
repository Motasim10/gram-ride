// FILE: app/forgot-pin/page.js   (replace the whole file)
'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useLanguage } from '@/lib/i18n'
import HeaderActions from '@/components/ui/HeaderActions'

const TEXT = {
  en: {
    title: 'Forgot Your PIN?',
    sub: 'We will send a code by SMS.',
    phone: 'Phone number (01XXXXXXXXX)',
    send: 'Send code',
    sent: 'If this number is registered, a 6-digit code was sent by SMS.',
    code: '6-digit code',
    newPin: 'New PIN',
    confirmPin: 'Confirm new PIN',
    save: 'Set new PIN',
    resend: 'Send a new code',
    back: 'Back to login',
    pinLen: 'PIN must be 6 digits.',
    mismatch: 'The two PINs do not match.',
    invalid: 'Enter a valid phone number.',
    check: 'Check the phone, code and new PIN.',
    expired: 'Code expired or not valid. Ask for a new code.',
    wrong: 'Wrong code.',
    failed: 'Could not change the PIN. Try again.',
    other: 'Something went wrong. Try again.',
  },
  bn: {
    title: 'পিন ভুলে গেছেন?',
    sub: 'আমরা এসএমএসে একটি কোড পাঠাব।',
    phone: 'ফোন নম্বর (01XXXXXXXXX)',
    send: 'কোড পাঠান',
    sent: 'নম্বরটি নিবন্ধিত হলে এসএমএসে ৬ সংখ্যার কোড গেছে।',
    code: '৬ সংখ্যার কোড',
    newPin: 'নতুন পিন',
    confirmPin: 'নতুন পিন আবার দিন',
    save: 'নতুন পিন সেট করুন',
    resend: 'নতুন কোড পাঠান',
    back: 'লগইনে ফিরুন',
    pinLen: 'পিন ৬ সংখ্যার হতে হবে।',
    mismatch: 'দুটি পিন মেলেনি।',
    invalid: 'সঠিক ফোন নম্বর দিন।',
    check: 'ফোন নম্বর, কোড ও নতুন পিন ঠিক আছে কিনা দেখুন।',
    expired: 'কোডের মেয়াদ শেষ বা কোডটি সঠিক নয়। নতুন কোড নিন।',
    wrong: 'কোডটি ভুল।',
    failed: 'পিন বদলানো যায়নি। আবার চেষ্টা করুন।',
    other: 'কিছু একটা ভুল হয়েছে। আবার চেষ্টা করুন।',
  },
}

export default function ForgotPinPage() {
  const router = useRouter()
  const { lang } = useLanguage()
  const T = lang === 'en' ? TEXT.en : TEXT.bn
  const [step, setStep] = useState(1)
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [pin, setPin] = useState('')
  const [pin2, setPin2] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const post = async (url, body) => {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    return { ok: r.ok, data: await r.json().catch(() => ({})) }
  }
  const errKey = (data) => (T[data.error] ? data.error : 'other')

  const sendCode = async () => {
    setBusy(true); setMsg('')
    const { ok, data } = await post('/api/forgot-pin/request', { phone })
    setBusy(false)
    if (!ok) return setMsg(errKey(data))
    setStep(2)
    setMsg('sent')
  }

  const resetPin = async () => {
    if (!/^\d{6}$/.test(pin)) return setMsg('pinLen')
    if (pin !== pin2) return setMsg('mismatch')
    setBusy(true); setMsg('')
    const { ok, data } = await post('/api/forgot-pin/verify', { phone, code, newPin: pin })
    setBusy(false)
    if (!ok) return setMsg(errKey(data))
    router.replace('/login')
  }

  const input = 'w-full rounded-xl border border-gray-300 px-4 py-3 text-base outline-none focus:border-emerald-700'
  const btn = 'w-full rounded-xl bg-emerald-700 py-3 font-semibold text-white disabled:opacity-50'

  return (
    <main className="mx-auto max-w-md p-5">
      <div className="mb-3 flex justify-end"><HeaderActions /></div>
      <h1 className="mb-1 text-2xl font-bold">{T.title}</h1>
      <p className="mb-5 text-sm text-gray-600">{T.sub}</p>
      <div className="space-y-3">
        <input className={input} inputMode="tel" placeholder={T.phone} value={phone}
          onChange={(e) => setPhone(e.target.value)} disabled={step === 2} />
        {step === 1 && (
          <button className={btn} disabled={busy || !phone} onClick={sendCode}>{T.send}</button>
        )}
        {step === 2 && (
          <>
            <input className={input} inputMode="numeric" maxLength={6} placeholder={T.code}
              value={code} onChange={(e) => setCode(e.target.value)} />
            <input className={input} type="password" inputMode="numeric" maxLength={6} placeholder={T.newPin}
              value={pin} onChange={(e) => setPin(e.target.value)} />
            <input className={input} type="password" inputMode="numeric" maxLength={6} placeholder={T.confirmPin}
              value={pin2} onChange={(e) => setPin2(e.target.value)} />
            <button className={btn} disabled={busy || !code || !pin} onClick={resetPin}>{T.save}</button>
            <button className="w-full text-sm text-emerald-700 underline" onClick={() => { setStep(1); setCode(''); setMsg('') }}>
              {T.resend}
            </button>
          </>
        )}
        {msg && <p className="text-sm text-gray-700">{T[msg]}</p>}
        <Link href="/login" className="block pt-2 text-center text-sm text-gray-600 underline">{T.back}</Link>
      </div>
    </main>
  )
}