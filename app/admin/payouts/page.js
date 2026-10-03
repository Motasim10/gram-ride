'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function AdminPayoutsPage() {
  const [authorized, setAuthorized] = useState(false)
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState([])
  const [amountInputs, setAmountInputs] = useState({})
  const [noteInputs, setNoteInputs] = useState({})
  const [commissionRatePercent, setCommissionRatePercent] = useState(10)
  const [rateInput, setRateInput] = useState('10')
  const router = useRouter()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profile } = await supabase.from('profiles').select('*').eq('user_id', user.id).single()
      if (!profile || !profile.is_admin) { router.push('/dashboard'); return }
      setAuthorized(true)

      const { data: setting } = await supabase.from('settings').select('*').eq('key', 'commission_rate').maybeSingle()
      const rate = setting ? Number(setting.value) : 10
      setCommissionRatePercent(rate)
      setRateInput(String(rate))

      await loadData(rate)
      subscribeToRides()
      setLoading(false)
    }
    load()
    return () => { if (channelRef.current) supabase.removeChannel(channelRef.current) }
  }, [])

    const channelRef = useRef(null)
    const loadData = async (fallbackRatePercent) => {
    const { data: drivers } = await supabase.from('profiles').select('*').eq('role', 'driver')
    const { data: completedRides } = await supabase.from('rides').select('driver_id, fare, commission_rate').eq('status', 'completed')
    const { data: payments } = await supabase.from('commission_payments').select('*')

    const built = (drivers || []).map((d) => {
      const driverRides = (completedRides || []).filter((r) => r.driver_id === d.user_id)
      const earnings = driverRides.reduce((s, r) => s + (r.fare || 0), 0)
      const commissionOwed = driverRides.reduce((s, r) => {
        const rideRate = r.commission_rate != null ? r.commission_rate : fallbackRatePercent
        return s + Math.round((r.fare || 0) * (rideRate / 100))
      }, 0)
      const totalPaid = (payments || []).filter((p) => p.driver_id === d.user_id).reduce((s, p) => s + p.amount, 0)
      return { ...d, earnings, commissionOwed, totalPaid, outstanding: commissionOwed - totalPaid }
    })

    built.sort((a, b) => b.outstanding - a.outstanding)
    setRows(built)
  }

  const saveRate = async () => {
    const newRate = Number(rateInput)
    if (!newRate || newRate <= 0) return
    await supabase.from('settings').update({ value: String(newRate) }).eq('key', 'commission_rate')
    setCommissionRatePercent(newRate)
    await loadData(newRate)
  }

    const subscribeToRides = () => {
    const channel = supabase
      .channel('admin-payouts-' + Math.random().toString(36).slice(2))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rides' }, (payload) => {
        if (payload.new.status === 'completed') loadData(commissionRatePercent)
      })
      .subscribe()
    channelRef.current = channel
  }

  const recordPayment = async (driverId) => {
    const amount = Number(amountInputs[driverId])
    if (!amount || amount <= 0) return
    await supabase.from('commission_payments').insert({ driver_id: driverId, amount, note: noteInputs[driverId] || '' })
    setAmountInputs((prev) => ({ ...prev, [driverId]: '' }))
    setNoteInputs((prev) => ({ ...prev, [driverId]: '' }))
    await loadData(commissionRatePercent)
  }

  if (loading) return <p style={{ textAlign: 'center', marginTop: 80 }}>Loading...</p>
  if (!authorized) return null

  const totalOutstanding = rows.reduce((s, r) => s + Math.max(0, r.outstanding), 0)

  return (
    <div style={{ maxWidth: 800, margin: '40px auto', fontFamily: 'sans-serif', padding: '0 16px' }}>
      <Link href="/admin">← Back to Dashboard</Link>
      <h1>Driver Payouts</h1>
      <p style={{ fontSize: 13, color: '#888' }}>
        This is a manual ledger — commission is collected in person or via bKash/Nagad outside the app.
        Use "Record Payment" whenever a driver pays their commission.
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <label style={{ fontSize: 14 }}>Commission rate:</label>
        <input type="number" value={rateInput} onChange={(e) => setRateInput(e.target.value)} style={{ width: 70, padding: 6 }} />
        <span>%</span>
        <button onClick={saveRate} style={{ padding: '6px 12px' }}>Save Rate</button>
      </div>
      <div style={{ border: '1px solid #ccc', borderRadius: 8, padding: 12, marginBottom: 20, background: totalOutstanding > 0 ? '#fff5f5' : '#f5fff5' }}>
        <p style={{ margin: 0, fontWeight: 'bold' }}>Total Outstanding Across All Drivers: ৳{totalOutstanding}</p>
      </div>

      {rows.length === 0 && <p style={{ color: '#888' }}>No drivers yet.</p>}
      {rows.map((d) => (
        <div key={d.user_id} style={{ border: '1px solid #ccc', borderRadius: 8, padding: 12, marginBottom: 10 }}>
          <p style={{ margin: 0, fontWeight: 'bold' }}>{d.name} <span style={{ fontWeight: 'normal', color: '#888', fontSize: 13 }}>{d.phone}</span></p>
          <p style={{ margin: '4px 0', fontSize: 13 }}>
            Earnings: ৳{d.earnings} · Commission owed: ৳{d.commissionOwed} · Paid: ৳{d.totalPaid}
          </p>
          <p style={{ margin: '2px 0 8px', fontWeight: 'bold', color: d.outstanding > 0 ? '#c00' : 'green' }}>
            Outstanding: ৳{Math.max(0, d.outstanding)}
          </p>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <input type="number" placeholder="Amount" value={amountInputs[d.user_id] || ''}
              onChange={(e) => setAmountInputs((prev) => ({ ...prev, [d.user_id]: e.target.value }))}
              style={{ width: 90, padding: 6 }} />
            <input placeholder="Note (optional)" value={noteInputs[d.user_id] || ''}
              onChange={(e) => setNoteInputs((prev) => ({ ...prev, [d.user_id]: e.target.value }))}
              style={{ flex: 1, minWidth: 120, padding: 6 }} />
            <button onClick={() => recordPayment(d.user_id)} style={{ padding: '6px 12px' }}>Record Payment</button>
          </div>
        </div>
      ))}
    </div>
  )
}