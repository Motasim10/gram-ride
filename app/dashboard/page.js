'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function Dashboard() {
  const [profile, setProfile] = useState(null)
  const router = useRouter()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      const { data } = await supabase.from('profiles').select('*').eq('user_id', user.id).single()
      setProfile(data)
    }
    load()
  }, [])

  if (!profile) return <p style={{ textAlign: 'center', marginTop: 80 }}>Loading...</p>

  return (
    <div style={{ maxWidth: 400, margin: '80px auto', fontFamily: 'sans-serif' }}>
      <h1>Welcome, {profile.name}! 🎉</h1>
      <p>You're logged in as a {profile.role}.</p>
      {profile.role === 'passenger' ? (
        <Link href="/passenger"><button style={{ padding: 10, width: '100%', marginTop: 12 }}>Request a Ride</button></Link>
      ) : (
        <Link href="/driver"><button style={{ padding: 10, width: '100%', marginTop: 12 }}>View Ride Requests</button></Link>
      )}
    </div>
  )
}