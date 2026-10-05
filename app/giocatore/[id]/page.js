'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'

export default function Giocatore({ params }) {
  const [p, setP] = useState(null)
  const [teams, setTeams] = useState([])
  const [err, setErr] = useState('')

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', params.id).single()
      if (error) { setErr('Profilo non visibile: ' + error.message); return }
      setP(data)
      const t = await supabase.from('teams').select('id,name').eq('owner_id', params.id)
      if (!t.error) setTeams(t.data || [])
    })()
  }, [params.id])

  if (err) return <main><div className="card"><p className="msg err">{err}</p></div></main>
  if (!p) return <main><p className="sub">Caricamento...</p></main>
  const initial = (p.display_name || p.username || 'U')[0].toUpperCase()

  return (
    <main className="narrow" style={{ maxWidth: 560 }}>
      <div className="card">
        <div className="profile-top">
          <div className="big-avatar">{p.avatar_url ? <img src={p.avatar_url} alt="" /> : initial}</div>
          <div>
            <h1 style={{ fontSize: '1.5rem' }}>{p.display_name || 'Giocatore'}</h1>
            {p.username && <p className="sub" style={{ margin: 0, fontWeight: 800 }}>@{p.username}</p>}
            <span className={'badge' + (p.role === 'admin' ? ' admin' : '')}>{p.role === 'admin' ? 'Admin' : 'Giocatore'}</span>
          </div>
        </div>
        {p.bio && <p style={{ whiteSpace: 'pre-wrap' }}>{p.bio}</p>}
        <h2>Squadre detenute ({teams.length})</h2>
        {teams.length === 0
          ? <p className="sub">Nessuna squadra assegnata.</p>
          : <ul className="list">{teams.map(t => <li key={t.id}>{t.name}</li>)}</ul>}
        <p className="sub small">Vista pubblica: in futuro qui appariranno anche le sue notizie.</p>
      </div>
    </main>
  )
}
