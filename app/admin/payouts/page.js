'use client'
import { Fragment, useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import { KpiCard, Panel, StatusBadge } from '@/components/admin/AdminUI'
import { IconWallet, IconClock, IconChevronDown } from '@/components/admin/Icons'

const todayDhaka = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' })

const inputClass = 'rounded-lg border-2 border-line-soft bg-white px-2.5 py-1.5 text-[13px] font-semibold text-charcoal focus:border-emerald focus:outline-none'

export default function AdminPayoutsPage() {
  const [authorized, setAuthorized] = useState(false)
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState([])
  const [amountInputs, setAmountInputs] = useState({})
  const [noteInputs, setNoteInputs] = useState({})
  const [model, setModel] = useState('daily_fee')
  const [feeInput, setFeeInput] = useState('20')
  const [rateInput, setRateInput] = useState('10')
  const [limitInput, setLimitInput] = useState('60')
  const [expanded, setExpanded] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)
  const channelRef = useRef(null)
  const router = useRouter()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profile } = await supabase.from('profiles').select('*').eq('user_id', user.id).single()
      if (!profile || !profile.is_admin) { router.push('/dashboard'); return }
      setAuthorized(true)

      await loadSettings()
      await loadData()
      subscribeToRides()
      setLoading(false)
    }
    load()
    return () => { if (channelRef.current) supabase.removeChannel(channelRef.current) }
  }, [])

  const loadSettings = async () => {
    const { data } = await supabase.from('settings').select('key, value')
      .in('key', ['payment_model', 'daily_fee', 'commission_rate', 'owed_limit'])
    const map = {}
    ;(data || []).forEach((s) => { map[s.key] = s.value })
    setModel(map.payment_model || 'daily_fee')
    setFeeInput(map.daily_fee ?? '20')
    setRateInput(map.commission_rate ?? '10')
    setLimitInput(map.owed_limit ?? '60')
  }

  const loadData = async () => {
    const { data: drivers } = await supabase.from('profiles').select('*').eq('role', 'driver')
    const { data: charges, error: chargesError } = await supabase
      .from('driver_day_charges').select('*').order('day', { ascending: false })
    const { data: payments } = await supabase.from('commission_payments').select('*')

    if (chargesError) {
      setError('The daily-fee database part is not installed yet (' + chargesError.message + '). Run the SQL steps first.')
    } else {
      setError('')
    }

    const today = todayDhaka()
    const built = (drivers || []).map((d) => {
      const days = (charges || []).filter((c) => c.driver_id === d.user_id)
      const feeOwed = days.filter((c) => c.model === 'daily_fee').reduce((s, c) => s + (c.charge || 0), 0)
      const commissionOwed = days.filter((c) => c.model === 'commission').reduce((s, c) => s + (c.charge || 0), 0)
      const totalPaid = (payments || []).filter((p) => p.driver_id === d.user_id).reduce((s, p) => s + p.amount, 0)
      const todayDay = days.find((c) => c.day === today) || null
      return { ...d, days, feeOwed, commissionOwed, totalPaid, outstanding: feeOwed + commissionOwed - totalPaid, todayDay }
    })

    built.sort((a, b) => b.outstanding - a.outstanding)
    setRows(built)
  }

  const subscribeToRides = () => {
    const channel = supabase
      .channel('admin-payouts-' + Math.random().toString(36).slice(2))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rides' }, (payload) => {
        if (payload.new.status === 'completed') loadData()
      })
      .subscribe()
    channelRef.current = channel
  }

  const switchModel = async (next) => {
    if (next === model) return
    const label = next === 'daily_fee' ? 'Daily fee' : 'Commission'
    if (!window.confirm(`Switch to "${label}"? It applies from each driver's next day. Days already started keep their terms.`)) return
    const { error: updateError } = await supabase.from('settings').update({ value: next }).eq('key', 'payment_model')
    if (updateError) { setNotice('Could not switch: ' + updateError.message); return }
    setModel(next)
    setNotice(`Switched to ${label}.`)
  }

  const saveSettings = async () => {
    if ([feeInput, rateInput, limitInput].some((v) => String(v).trim() === '')) { setNotice('Please fill all three boxes.'); return }
    const fee = Number(feeInput)
    const rate = Number(rateInput)
    const limit = Number(limitInput)
    if (!(fee >= 0) || !(rate >= 0 && rate <= 100) || !(limit >= 0)) { setNotice('Please enter valid numbers (commission must be 0 to 100).'); return }
    setSaving(true)
    for (const [key, value] of [['daily_fee', fee], ['commission_rate', rate], ['owed_limit', limit]]) {
      const { error: updateError } = await supabase.from('settings').update({ value: String(value) }).eq('key', key)
      if (updateError) { setNotice('Could not save: ' + updateError.message); setSaving(false); return }
    }
    setNotice("Settings saved. New values apply from each driver's next day.")
    setSaving(false)
  }

  const recordPayment = async (driverId) => {
    const amount = Number(amountInputs[driverId])
    if (!amount || amount <= 0) return
    const { error: insertError } = await supabase.from('commission_payments').insert({ driver_id: driverId, amount, note: noteInputs[driverId] || '' })
    if (insertError) { setNotice('Could not record payment: ' + insertError.message); return }
    setAmountInputs((prev) => ({ ...prev, [driverId]: '' }))
    setNoteInputs((prev) => ({ ...prev, [driverId]: '' }))
    await loadData()
  }

  if (loading) return <p className="mt-16 text-center text-charcoal/60">Loading...</p>
  if (!authorized) return null

  const totalOutstanding = rows.reduce((s, r) => s + Math.max(0, r.outstanding), 0)
  const totalCharged = rows.reduce((s, r) => s + r.feeOwed + r.commissionOwed, 0)
  const totalPaidAll = rows.reduce((s, r) => s + r.totalPaid, 0)
  const activeToday = rows.filter((r) => r.todayDay).length

  const options = [
    { value: 'daily_fee', title: 'Daily fee', text: 'Each driver pays a fixed amount for every day he goes online.' },
    { value: 'commission', title: 'Commission', text: 'Each driver pays a percentage of what he earned that day.' },
  ]

  return (
    <div className="space-y-5">
      <p className="max-w-3xl text-[13px] text-charcoal/55">
        This is a manual ledger. Payments are collected in person or via bKash/Nagad outside the app.
        Use Record whenever a driver pays. Each day is locked to the model in force when the driver first
        went online that day, so switching only affects each driver&apos;s next day.
      </p>

      {error && <p className="rounded-xl bg-danger/10 px-4 py-3 text-[13px] font-semibold text-danger">{error}</p>}
      {notice && (
        <p className="flex items-center justify-between gap-3 rounded-xl border-2 border-emerald/30 bg-mint px-4 py-3 text-[13px] font-semibold text-emerald-dark">
          <span>{notice}</span>
          <button onClick={() => setNotice('')} className="text-[12px] font-bold underline">Dismiss</button>
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {options.map((o) => (
          <button
            key={o.value}
            onClick={() => switchModel(o.value)}
            className={`rounded-2xl border-2 p-4 text-left transition-colors ${model === o.value ? 'border-emerald bg-mint' : 'border-line-soft bg-white hover:border-line'}`}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-[15px] font-bold text-charcoal">{o.title}</p>
              {model === o.value && <StatusBadge tone="emerald">Active</StatusBadge>}
            </div>
            <p className="mt-1 text-[12.5px] text-charcoal/60">{o.text}</p>
          </button>
        ))}
      </div>

      <Panel title="Settings">
        <div className="flex flex-wrap items-end gap-4">
          <label className="block">
            <span className="mb-1 block text-[12.5px] font-bold text-charcoal/55">Daily fee (৳)</span>
            <input type="number" value={feeInput} onChange={(e) => setFeeInput(e.target.value)} className={`${inputClass} w-28 font-num`} />
          </label>
          <label className="block">
            <span className="mb-1 block text-[12.5px] font-bold text-charcoal/55">Commission (% of a day)</span>
            <input type="number" value={rateInput} onChange={(e) => setRateInput(e.target.value)} className={`${inputClass} w-28 font-num`} />
          </label>
          <label className="block">
            <span className="mb-1 block text-[12.5px] font-bold text-charcoal/55">Block at owed (৳, 0 = never)</span>
            <input type="number" value={limitInput} onChange={(e) => setLimitInput(e.target.value)} className={`${inputClass} w-28 font-num`} />
          </label>
          <button
            onClick={saveSettings}
            disabled={saving}
            className="rounded-lg bg-emerald px-5 py-2.5 text-[13px] font-bold text-white active:bg-emerald-dark disabled:opacity-50"
          >
            Save settings
          </button>
        </div>
      </Panel>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <KpiCard
          icon={<IconWallet size={16} />}
          label="Total outstanding"
          value={`৳${totalOutstanding}`}
          tone={totalOutstanding > 0 ? 'amber' : 'emerald'}
        />
        <KpiCard icon={<IconWallet size={16} />} label="Total charged" value={`৳${totalCharged}`} />
        <KpiCard icon={<IconWallet size={16} />} label="Total paid" value={`৳${totalPaidAll}`} tone="emerald" />
        <KpiCard icon={<IconClock size={16} />} label="Online today" value={activeToday} />
      </div>

      <Panel flush>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b-2 border-line-soft text-[12px] font-bold text-charcoal/45">
                <th className="px-5 py-3">Driver</th>
                <th className="px-5 py-3">Today</th>
                <th className="px-5 py-3">Days</th>
                <th className="px-5 py-3">Daily fees</th>
                <th className="px-5 py-3">Commission</th>
                <th className="px-5 py-3">Paid</th>
                <th className="px-5 py-3">Outstanding</th>
                <th className="px-5 py-3">Record payment</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <Fragment key={d.user_id}>
                  <tr className="border-b border-line-soft">
                    <td className="px-5 py-3">
                      <button
                        onClick={() => setExpanded(expanded === d.user_id ? null : d.user_id)}
                        className="flex items-center gap-1.5 text-left"
                      >
                        <IconChevronDown size={14} className={`shrink-0 text-charcoal/40 transition-transform ${expanded === d.user_id ? 'rotate-180' : ''}`} />
                        <span>
                          <span className="block text-[13.5px] font-bold text-charcoal">{d.name}</span>
                          <span className="block font-num text-[12px] font-semibold text-charcoal/45">{d.phone}</span>
                        </span>
                      </button>
                    </td>
                    <td className="px-5 py-3">
                      {d.todayDay ? (
                        <StatusBadge tone={d.todayDay.model === 'daily_fee' ? 'emerald' : 'amber'}>
                          {d.todayDay.model === 'daily_fee' ? `Fee ৳${d.todayDay.fee_amount}` : `${d.todayDay.commission_rate}% of ৳${d.todayDay.earnings}`}
                        </StatusBadge>
                      ) : (
                        <span className="text-[13px] text-charcoal/30">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 font-num text-[13px] font-semibold text-charcoal/70">{d.days.length}</td>
                    <td className="px-5 py-3 font-num text-[13px] font-semibold text-charcoal/70">৳{d.feeOwed}</td>
                    <td className="px-5 py-3 font-num text-[13px] font-semibold text-charcoal/70">৳{d.commissionOwed}</td>
                    <td className="px-5 py-3 font-num text-[13px] font-semibold text-charcoal/70">৳{d.totalPaid}</td>
                    <td className="px-5 py-3">
                      <StatusBadge tone={d.outstanding > 0 ? 'red' : 'emerald'}>৳{Math.max(0, d.outstanding)}</StatusBadge>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          placeholder="Amount"
                          value={amountInputs[d.user_id] || ''}
                          onChange={(e) => setAmountInputs((prev) => ({ ...prev, [d.user_id]: e.target.value }))}
                          className={`${inputClass} w-24 font-num`}
                        />
                        <input
                          placeholder="Note (optional)"
                          value={noteInputs[d.user_id] || ''}
                          onChange={(e) => setNoteInputs((prev) => ({ ...prev, [d.user_id]: e.target.value }))}
                          className={`${inputClass} w-40`}
                        />
                        <button
                          onClick={() => recordPayment(d.user_id)}
                          className="whitespace-nowrap rounded-lg bg-emerald px-3.5 py-2 text-[12.5px] font-bold text-white active:bg-emerald-dark"
                        >
                          Record
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expanded === d.user_id && (
                    <tr className="border-b border-line-soft bg-offwhite">
                      <td colSpan="8" className="px-5 py-3">
                        {d.days.length === 0 ? (
                          <p className="text-[13px] font-semibold text-charcoal/45">No days recorded yet.</p>
                        ) : (
                          <div className="max-h-60 divide-y divide-line-soft overflow-y-auto">
                            {d.days.map((c) => (
                              <div key={c.id} className="flex items-center gap-4 py-2 text-[13px]">
                                <span className="w-28 font-num font-semibold text-charcoal/70">{c.day}</span>
                                <StatusBadge tone={c.model === 'daily_fee' ? 'emerald' : 'amber'}>
                                  {c.model === 'daily_fee' ? 'Daily fee' : `Commission ${c.commission_rate}%`}
                                </StatusBadge>
                                <span className="flex-1 font-num font-semibold text-charcoal/55">
                                  {c.model === 'commission' ? `Earned ৳${c.earnings}` : ''}
                                </span>
                                <span className="font-num font-extrabold text-charcoal">৳{c.charge}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan="8" className="px-5 py-10 text-center text-[13px] font-semibold text-charcoal/40">No drivers yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  )
}