'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../../lib/supabase'

export default function Squadre() {
  const [teams, setTeams] = useState([])
  const [owners, setOwners] = useState({})
  const [q, setQ] = useState('')

  useEffect(() => {
    let alive = true
    ;(async () => {
      const [{ data: t }, { data: p }] = await Promise.all([
        supabase.from('teams').select('id,name,logo_url,owner_id').order('name'),
        supabase.from('profiles').select('id,display_name,username'),
      ])
      if (!alive) return
      setTeams(t || [])
      const m = {}
      ;(p || []).forEach(x => { m[x.id] = x })
      setOwners(m)
    })()
    return () => { alive = false }
  }, [])

  const list = teams.filter(t => t.name.toLowerCase().includes(q.toLowerCase()))

  return (
    <main>
      <h1>Squadre</h1>
      <p className="sub">Logo, nome e detentore. Clicca per il dettaglio.</p>
      <div className="card">
        <input placeholder="Cerca squadra..." value={q} onChange={e => setQ(e.target.value)} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 12 }}>
        {list.map(t => {
          const o = t.owner_id ? owners[t.owner_id] : null
          return (
          <Link key={t.id} href={`/squadre/${t.id}`} prefetch style={{ textDecoration: 'none' }}>
            <div className="card" style={{ textAlign: 'center', margin: 0 }}>
              {t.logo_url
                ? <img src={t.logo_url} alt="" loading="lazy" style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover' }} />
                : <div className="big-avatar" style={{ width: 64, height: 64, margin: '0 auto', fontSize: '1.5rem' }}>{t.name[0]}</div>}
              <div style={{ fontWeight: 800, marginTop: 8 }}>{t.name}</div>
              <div className="small" style={{ color: 'var(--muted)' }}>
                {t.owner_id ? `gestita da: ${o ? (o.display_name || '') + (o.username ? ' @' + o.username : '') : '...'}` : 'libera'}
              </div>
            </div>
          </Link>
          )
        })}
      </div>
      {list.length === 0 && <p className="empty">Nessuna squadra.</p>}
    </main>
  )
}
