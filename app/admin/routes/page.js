'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

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
      style={{ width: 60, padding: 6, textAlign: 'center' }}
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

  if (loading) return <p style={{ textAlign: 'center', marginTop: 80 }}>Loading...</p>
  if (!authorized) return null

  return (
    <div style={{ maxWidth: 800, margin: '40px auto', fontFamily: 'sans-serif', padding: '0 16px' }}>
      <Link href="/admin">← Back to Dashboard</Link>
      <h1>Routes & Fares</h1>
      <p style={{ fontSize: 13, color: '#888' }}>
        A route is one road in one direction, with stops in order (e.g. Nanupur → Hazari → Azadi Bazar).
        Passengers can ride from any stop to any later stop. For the opposite direction, create a separate route.
        Leave a fare box empty to make that pair unavailable.
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <input value={newRouteName} onChange={(e) => setNewRouteName(e.target.value)}
          placeholder="New route name (e.g. Nanupur → Azadi Bazar)" style={{ flex: 1, padding: 8 }} />
        <button onClick={addRoute} style={{ padding: '8px 14px' }}>Add Route</button>
      </div>

      {routes.length === 0 && <p style={{ color: '#888' }}>No routes yet. Add your first one above.</p>}

      {routes.map((route) => {
        const stops = stopsByRoute[route.id] || []
        const fares = faresByRoute[route.id] || {}
        const isOpen = openRouteId === route.id
        return (
          <div key={route.id} style={{ border: '1px solid #ccc', borderRadius: 8, padding: 12, marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <div>
                <p style={{ margin: 0, fontWeight: 'bold' }}>{route.name}</p>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: '#888' }}>{stops.length} stop{stops.length !== 1 ? 's' : ''}</p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setOpenRouteId(isOpen ? null : route.id)} style={{ padding: '6px 12px' }}>
                  {isOpen ? 'Close' : 'Edit'}
                </button>
                <button onClick={() => deleteRoute(route)} style={{ padding: '6px 12px', color: '#c00' }}>Delete</button>
              </div>
            </div>

            {isOpen && (
              <div style={{ marginTop: 16 }}>
                <h3 style={{ margin: '0 0 8px' }}>Stops (in order)</h3>
                {stops.length === 0 && <p style={{ color: '#888', fontSize: 13 }}>No stops yet.</p>}
                {stops.map((s, i) => (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid #eee', borderRadius: 6, padding: 8, marginBottom: 6 }}>
                    <span style={{ width: 24, fontWeight: 'bold', color: '#888' }}>{i + 1}</span>
                    <span style={{ flex: 1 }}>{s.name}</span>
                    <button onClick={() => moveStop(route.id, i, -1)} disabled={i === 0} style={{ padding: '4px 8px' }}>↑</button>
                    <button onClick={() => moveStop(route.id, i, 1)} disabled={i === stops.length - 1} style={{ padding: '4px 8px' }}>↓</button>
                    <button onClick={() => deleteStop(s)} style={{ padding: '4px 8px', color: '#c00' }}>✕</button>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 8, marginTop: 8, marginBottom: 20 }}>
                  <input value={newStopInputs[route.id] || ''}
                    onChange={(e) => setNewStopInputs((prev) => ({ ...prev, [route.id]: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === 'Enter') addStop(route.id) }}
                    placeholder="Add next stop" style={{ flex: 1, padding: 8 }} />
                  <button onClick={() => addStop(route.id)} style={{ padding: '8px 14px' }}>Add Stop</button>
                </div>

                <h3 style={{ margin: '0 0 8px' }}>Fare per seat (৳)</h3>
                {stops.length < 2 ? (
                  <p style={{ color: '#888', fontSize: 13 }}>Add at least 2 stops to set fares.</p>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          <th style={{ border: '1px solid #ccc', padding: 8, fontSize: 12 }}>From ↓ / To →</th>
                          {stops.slice(1).map((to) => (
                            <th key={to.id} style={{ border: '1px solid #ccc', padding: 8, fontSize: 12 }}>{to.name}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {stops.slice(0, -1).map((from, i) => (
                          <tr key={from.id}>
                            <td style={{ border: '1px solid #ccc', padding: 8, fontWeight: 'bold', fontSize: 13 }}>{from.name}</td>
                            {stops.slice(1).map((to, offset) => {
                              const j = offset + 1
                              if (j <= i) {
                                return <td key={to.id} style={{ border: '1px solid #ccc', padding: 4, background: '#f5f5f5', textAlign: 'center', color: '#bbb' }}>—</td>
                              }
                              return (
                                <td key={to.id} style={{ border: '1px solid #ccc', padding: 4 }}>
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
            )}
          </div>
        )
      })}
    </div>
  )
}