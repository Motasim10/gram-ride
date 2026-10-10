'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

export default function StaffLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const login = async (e) => {
    e.preventDefault()
    setBusy(true); setError('')
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
    if (err) return setError('Wrong email or password.')
    router.replace('/admin')
  }

  const input = 'w-full rounded-xl border border-gray-300 px-4 py-3 text-base outline-none focus:border-emerald-700'
  return (
    <main className="mx-auto max-w-md p-5">
      <h1 className="mb-5 text-2xl font-bold">Admin login</h1>
      <form onSubmit={login} className="space-y-3">
        <input className={input} type="email" autoComplete="email" placeholder="Email"
          value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className={input} type="password" autoComplete="current-password" placeholder="Password"
          value={password} onChange={(e) => setPassword(e.target.value)} />
        <button className="w-full rounded-xl bg-emerald-700 py-3 font-semibold text-white disabled:opacity-50"
          disabled={busy || !email || !password}>Log in</button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>
    </main>
  )
}