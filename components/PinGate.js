'use client'
import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

const SKIP = ['/', '/login', '/signup', '/change-pin']

export default function PinGate() {
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    if (SKIP.includes(pathname) || pathname.startsWith('/admin')) return
    let active = true
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('profiles').select('must_change_pin').eq('user_id', user.id).single()
      if (active && data?.must_change_pin) router.replace('/change-pin')
    }
    check()
    return () => { active = false }
  }, [pathname])

  return null
}