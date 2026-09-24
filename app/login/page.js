'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter, useSearchParams } from 'next/navigation'
import { useLanguage } from '@/lib/i18n'

export default function Login() {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t } = useLanguage()

  const attemptLogin = async (email, password) => {
    setError('')
    setLoading(true)
    const { error: loginError } = await supabase.auth.signInWithPassword({ email, password })
    if (loginError) {
      setError(loginError.message)
      setLoading(false)
      return
    }
    router.push('/dashboard')
  }

  useEffect(() => {
    const email = searchParams.get('email')
    const password = searchParams.get('password')
    if (email && password) {
      attemptLogin(email, password)
    }
  }, [])

  const handleLogin = async (e) => {
    e.preventDefault()
    const formData = new FormData(e.target)
    await attemptLogin(formData.get('email'), formData.get('password'))
  }

  return (
    <div style={{ maxWidth: 400, margin: '80px auto', fontFamily: 'sans-serif' }}>
      <h1>{t('login')}</h1>
      <form onSubmit={handleLogin}>
        <div style={{ marginBottom: 12 }}>
          <label>{t('email')}</label><br/>
          <input name="email" type="email" required style={{ width: '100%', padding: 8 }} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label>{t('password')}</label><br/>
          <input name="password" type="password" required style={{ width: '100%', padding: 8 }} />
        </div>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <button type="submit" disabled={loading} style={{ padding: 10, width: '100%' }}>
          {loading ? t('loggingIn') : t('logInButton')}
        </button>
      </form>
    </div>
  )
}