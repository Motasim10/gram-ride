'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import { Panel, EmptyState } from '@/components/admin/AdminUI'
import { IconMapPin } from '@/components/admin/Icons'

function FareInput({ value, onCommit }) {
  const [local, setLocal] = useState(value ?? '')
  useEffect(() => { setLocal(value ?? '') }, [value])
  return (
    <input
      type="number"
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => { if (String(local) !== String(value ?? '')) onCommit(local) }}
      onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur() }}
      className={`w-16 rounded-lg border-2 px-1.5 py-1.5 text-center font-num text-[13px] font-semibold text-charcoal focus:border-emerald focus:outline-none ${local !== '' ? 'border-emerald/40 bg-mint' : 'border-line-soft bg-white'}`}
    />
  )
}

export default function AdminRoutesPage() {
  const [authorized, setAuthorized] = useState(false)
  const [loading, setLoading] = useState(true)
  const [routes, setRoutes] = useState([])
  const [stopsByRoute, setStopsByRoute] = useState({})
  const [faresByRoute, setFaresByRoute] = useState({})
  const [newRouteName, setNewRouteName] = useState('')
  const [newStopInputs, setNewStopInputs] = useState({})
  const [openRouteId, setOpenRouteId] = useState(null)
  const router = useRouter()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profile } = await supabase.from('profiles').select('*').eq('user_id', user.id).single()
      if (!profile || !profile.is_admin) { router.push('/dashboard'); return }
      setAuthorized(true)

      await loadAll()
      setLoading(false)
    }
    load()
  }, [])

  const loadAll = async () => {
    const { data: routeRows } = await supabase.from('routes').select('*').order('id')
    const { data: stopRows } = await supabase.from('route_stops').select('*').order('position')
    const { data: fareRows } = await supabase.from('route_fares').select('*')

    const stops = {}
    ;(stopRows || []).forEach((s) => { (stops[s.route_id] = stops[s.route_id] || []).push(s) })
    const fares = {}
    ;(fareRows || []).forEach((f) => {
      fares[f.route_id] = fares[f.route_id] || {}
      fares[f.route_id][`${f.from_stop_id}|${f.to_stop_id}`] = f.fare_per_seat
    })

    setRoutes(routeRows || [])
    setStopsByRoute(stops)
    setFaresByRoute(fares)
  }

  const addRoute = async () => {
    const name = newRouteName.trim()
    if (!name) return
    const { data } = await supabase.from('routes').insert({ name }).select().single()
    setNewRouteName('')
    await loadAll()
    if (data) setOpenRouteId(data.id)
  }

  const deleteRoute = async (route) => {
    if (!window.confirm(`Delete route "${route.name}" and all its stops and fares?`)) return
    await supabase.from('routes').delete().eq('id', route.id)
    if (openRouteId === route.id) setOpenRouteId(null)
    await loadAll()
  }

  const addStop = async (routeId) => {
    const name = (newStopInputs[routeId] || '').trim()
    if (!name) return
    const existing = stopsByRoute[routeId] || []
    const nextPos = existing.length > 0 ? Math.max(...existing.map((s) => s.position)) + 1 : 1
    await supabase.from('route_stops').insert({ route_id: routeId, name, position: nextPos })
    setNewStopInputs((prev) => ({ ...prev, [routeId]: '' }))
    await loadAll()
  }

  const deleteStop = async (stop) => {
    if (!window.confirm(`Delete stop "${stop.name}"? Any fares involving it will be removed.`)) return
    await supabase.from('route_stops').delete().eq('id', stop.id)
    await loadAll()
  }

  const moveStop = async (routeId, index, direction) => {
    const list = stopsByRoute[routeId] || []
    const current = list[index]
    const other = list[index + direction]
    if (!current || !other) return
    await supabase.from('route_stops').update({ position: other.position }).eq('id', current.id)
    await supabase.from('route_stops').update({ position: current.position }).eq('id', other.id)
    await loadAll()
  }

  const updateFare = async (routeId, fromId, toId, rawValue) => {
    const fare = Number(rawValue)
    if (!rawValue || fare <= 0) {
      await supabase.from('route_fares').delete()
        .eq('route_id', routeId).eq('from_stop_id', fromId).eq('to_stop_id', toId)
    } else {
      await supabase.from('route_fares').upsert(
        { route_id: routeId, from_stop_id: fromId, to_stop_id: toId, fare_per_seat: fare },
        { onConflict: 'route_id,from_stop_id,to_stop_id' }
      )
    }
    await loadAll()
  }

  if (loading) return <p className="mt-16 text-center text-charcoal/60">Loading...</p>
  if (!authorized) return null

  const inputClass = 'rounded-lg border-2 border-line-soft bg-white px-3 py-2.5 text-[13.5px] font-semibold text-charcoal focus:border-emerald focus:outline-none'
  const smallButton = 'flex h-8 w-8 items-center justify-center rounded-lg border-2 border-line-soft text-[13px] font-bold text-charcoal/60 hover:bg-offwhite disabled:opacity-30'

  return (
    <div className="space-y-5">
      <p className="max-w-3xl text-[13px] text-charcoal/55">
        A route is one road in one direction, with stops in order (e.g. Nanupur → Hazari → Azadi Bazar).
        Passengers can ride from any stop to any later stop. For the opposite direction, create a separate route.
        Leave a fare box empty to make that pair unavailable.
      </p>

      <Panel>
        <div className="flex flex-wrap gap-3">
          <input
            value={newRouteName}
            onChange={(e) => setNewRouteName(e.target.value)}
            placeholder="New route name (e.g. Nanupur → Azadi Bazar)"
            className={`${inputClass} min-w-[240px] flex-1`}
          />
          <button
            onClick={addRoute}
            className="rounded-lg bg-emerald px-5 py-2.5 text-[13px] font-bold text-white active:bg-emerald-dark"
          >
            Add route
          </button>
        </div>
      </Panel>

      {routes.length === 0 && <EmptyState icon={<IconMapPin size={28} />} text="No routes yet. Add your first one above." />}

      <div className="space-y-4">
        {routes.map((route) => {
          const stops = stopsByRoute[route.id] || []
          const fares = faresByRoute[route.id] || {}
          const isOpen = openRouteId === route.id
          return (
            <div key={route.id} className="rounded-2xl border-2 border-line-soft bg-white">
              <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-mint text-emerald">
                    <IconMapPin size={18} />
                  </div>
                  <div>
                    <p className="text-[15px] font-bold text-charcoal">{route.name}</p>
                    <p className="text-[12px] font-semibold text-charcoal/45">{stops.length} stop{stops.length !== 1 ? 's' : ''}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setOpenRouteId(isOpen ? null : route.id)}
                    className="rounded-lg border-2 border-emerald px-4 py-2 text-[12.5px] font-bold text-emerald hover:bg-mint"
                  >
                    {isOpen ? 'Close' : 'Edit'}
                  </button>
                  <button
                    onClick={() => deleteRoute(route)}
                    className="rounded-lg border-2 border-danger/40 px-4 py-2 text-[12.5px] font-bold text-danger hover:bg-danger/5"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {isOpen && (
                <div className="space-y-6 border-t-2 border-line-soft px-5 py-5">
                  <div>
                    <p className="mb-3 text-[14px] font-bold text-charcoal">Stops (in order)</p>
                    {stops.length === 0 && <p className="mb-3 text-[13px] text-charcoal/45">No stops yet.</p>}
                    <div className="space-y-2">
                      {stops.map((s, i) => (
                        <div key={s.id} className="flex items-center gap-3 rounded-xl border-2 border-line-soft bg-offwhite px-3 py-2">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-mint font-num text-[12.5px] font-bold text-emerald-dark">
                            {i + 1}
                          </span>
                          <span className="flex-1 text-[13.5px] font-bold text-charcoal">{s.name}</span>
                          <button onClick={() => moveStop(route.id, i, -1)} disabled={i === 0} className={smallButton} aria-label="Move up">↑</button>
                          <button onClick={() => moveStop(route.id, i, 1)} disabled={i === stops.length - 1} className={smallButton} aria-label="Move down">↓</button>
                          <button onClick={() => deleteStop(s)} className={`${smallButton} border-danger/30 text-danger hover:bg-danger/5`} aria-label="Delete stop">✕</button>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-3">
                      <input
                        value={newStopInputs[route.id] || ''}
                        onChange={(e) => setNewStopInputs((prev) => ({ ...prev, [route.id]: e.target.value }))}
                        onKeyDown={(e) => { if (e.key === 'Enter') addStop(route.id) }}
                        placeholder="Add next stop"
                        className={`${inputClass} min-w-[200px] flex-1`}
                      />
                      <button
                        onClick={() => addStop(route.id)}
                        className="rounded-lg bg-emerald px-5 py-2.5 text-[13px] font-bold text-white active:bg-emerald-dark"
                      >
                        Add stop
                      </button>
                    </div>
                  </div>

                  <div>
                    <p className="mb-3 text-[14px] font-bold text-charcoal">Fare per seat (৳)</p>
                    {stops.length < 2 ? (
                      <p className="text-[13px] text-charcoal/45">Add at least 2 stops to set fares.</p>
                    ) : (
                      <div className="overflow-x-auto rounded-xl border-2 border-line-soft">
                        <table className="w-full border-collapse text-left">
                          <thead className="bg-offwhite">
                            <tr>
                              <th className="whitespace-nowrap px-3 py-2.5 text-[12px] font-bold text-charcoal/45">From ↓ / To →</th>
                              {stops.slice(1).map((to) => (
                                <th key={to.id} className="whitespace-nowrap px-3 py-2.5 text-center text-[12px] font-bold text-charcoal/60">{to.name}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {stops.slice(0, -1).map((from, i) => (
                              <tr key={from.id}>
                                <td className="whitespace-nowrap border-t border-line-soft px-3 py-2 text-[13px] font-bold text-charcoal">{from.name}</td>
                                {stops.slice(1).map((to, offset) => {
                                  const j = offset + 1
                                  if (j <= i) {
                                    return (
                                      <td key={to.id} className="border-t border-line-soft bg-offwhite p-2 text-center text-charcoal/25">—</td>
                                    )
                                  }
                                  return (
                                    <td key={to.id} className="border-t border-line-soft p-2 text-center">
                                      <FareInput
                                        value={fares[`${from.id}|${to.id}`]}
                                        onCommit={(v) => updateFare(route.id, from.id, to.id, v)}
                                      />
                                    </td>
                                  )
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}