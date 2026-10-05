'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function Partite() {
  const [user, setUser] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [champs, setChamps] = useState([])
  const [selChamp, setSelChamp] = useState('')
  const [teams, setTeams] = useState([])
  const [links, setLinks] = useState([])
  const [myTeams, setMyTeams] = useState([])
  const [teamA, setTeamA] = useState('')
  const [teamB, setTeamB] = useState('')
  const [scoreA, setScoreA] = useState('')
  const [scoreB, setScoreB] = useState('')
  const [props, setProps] = useState([])
  const [fixtures, setFixtures] = useState([])
  const [msg, setMsg] = useState('')
  const [needSql, setNeedSql] = useState(false)

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const u = session?.user || null
      setUser(u)
      if (u) {
        const { data: prof } = await supabase.from('profiles').select('role').eq('id', u.id).single()
        setIsAdmin(prof?.role === 'admin')
        const m = await supabase.from('teams').select('id,name').eq('owner_id', u.id)
        if (!m.error) {
          setMyTeams(m.data || [])
          if (m.data?.[0]) setTeamA(m.data[0].id)
        }
      }
      const c = await supabase.from('championships').select('id,name').order('created_at', { ascending: false })
      if (!c.error) { setChamps(c.data || []); if (c.data?.[0]) setSelChamp(c.data[0].id) }
      const t = await supabase.from('teams').select('id,name,owner_id').order('name')
      if (!t.error) setTeams(t.data || [])
    })()
  }, [])

  useEffect(() => {
    if (!selChamp) return
    supabase.from('championship_teams').select('team_id').eq('championship_id', selChamp)
      .then(({ data }) => setLinks((data || []).map(d => d.team_id)))
    supabase.from('match_proposals').select('*').eq('championship_id', selChamp).order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error && error.message.includes('does not exist')) setNeedSql(true)
        else setProps(data || [])
      })
    supabase.from('fixtures').select('*').eq('championship_id', selChamp).order('scheduled_at', { ascending: true })
      .then(({ data }) => { if (data) setFixtures(data) })
  }, [selChamp])

  const teamsInChamp = teams.filter(t => links.includes(t.id))
  const nameOf = id => teams.find(t => t.id === id)?.name || id?.slice(0, 6)
  // solo rivendicate possono proporre (già salvato owner_id, qui solo enforcement UI)
  const canPropose = isAdmin || myTeams.length > 0

  async function proponi() {
    setMsg('')
    if (!user) { setMsg('Devi accedere per proporre un risultato.'); return }
    if (!canPropose) { setMsg('Devi prima farti assegnare una squadra dall\u2019admin.'); return }
    if (!teamA || !teamB || teamA === teamB) { setMsg('Scegli due squadre diverse.'); return }
    if (scoreA === '' || scoreB === '') { setMsg('Inserisci entrambi i punteggi.'); return }
    const mine = isAdmin || myTeams.some(t => t.id === teamA || t.id === teamB)
    if (!mine) { setMsg('Puoi proporre solo partite della TUA squadra rivendicata.'); return }
    const { error } = await supabase.from('match_proposals').insert({
      championship_id: selChamp, team_a_id: teamA, team_b_id: teamB,
      score_a: parseInt(scoreA), score_b: parseInt(scoreB),
      proposed_by: user.id, status: 'pending'
    })
    if (error) { setMsg('Errore: ' + error.message); return }
    setMsg('Proposto! Resta in attesa finché l\u2019admin approva.')
    setScoreA(''); setScoreB('')
    const r = await supabase.from('match_proposals').select('*').eq('championship_id', selChamp).order('created_at', { ascending: false })
    if (!r.error) setProps(r.data || [])
  }

  const label = s => s === 'pending' ? 'in attesa' : s === 'approved' ? 'approvato' : 'rifiutato'

  return (
    <main>
      <h1>Partite</h1>
      <p className="sub">Solo chi ha rivendicato una squadra può proporre. L'admin approva e solo allora vale.</p>
      {needSql && <div className="card"><p className="msg err">Tabella risultati non ancora creata. Esegui MIGRAZIONE2.sql su Supabase.</p></div>}
      <div className="card">
        <select value={selChamp} onChange={e => setSelChamp(e.target.value)}>
          {champs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {!user
          ? <p className="empty">Accedi per proporre un risultato. <a href="/login">Accedi</a></p>
          : !canPropose
          ? <p className="empty">Nessuna squadra rivendicata: chiedi all'admin di assegnartene una via email.</p>
          : (
            <div className="row">
              <select value={teamA} onChange={e => setTeamA(e.target.value)}>
                <option value="">— tua squadra —</option>
                {(isAdmin ? teamsInChamp : myTeams.filter(t => links.includes(t.id)).concat(myTeams.filter(t => !links.includes(t.id)))).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <input style={{ maxWidth: 90 }} placeholder="Tu" value={scoreA} onChange={e => setScoreA(e.target.value)} type="number" min="0" />
              <span>—</span>
              <input style={{ maxWidth: 90 }} placeholder="Avv" value={scoreB} onChange={e => setScoreB(e.target.value)} type="number" min="0" />
              <select value={teamB} onChange={e => setTeamB(e.target.value)}>
                <option value="">— avversario —</option>
                {teamsInChamp.filter(t => t.id !== teamA).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <button onClick={proponi}>Proponi risultato</button>
            </div>
          )}
        {msg && <p className="msg">{msg}</p>}
      </div>
      <div className="card">
        <h2>Calendario ({fixtures.length})</h2>
        {fixtures.length === 0 ? <p className="empty">Calendario non ancora generato dall'admin.</p> :
          fixtures.map(f => (
            <div key={f.id} className="match-card">
              <div className="match-top">
                <span className="match-teams">T{f.round_no} · {nameOf(f.home_id)} vs {nameOf(f.away_id)}</span>
                <span className="proposer">{f.scheduled_at ? new Date(f.scheduled_at).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}</span>
              </div>
            </div>
          ))}
      </div>
      <div className="card">
        <h2>Risultati ({props.length})</h2>
        {props.length === 0 ? <p className="empty">Nessun risultato proposto.</p> :
          props.map(p => (
            <div key={p.id} className="match-card">
              <div className="match-top">
                <span className="match-teams">{nameOf(p.team_a_id)} vs {nameOf(p.team_b_id)}</span>
                <span className="match-score">{p.score_a} - {p.score_b}</span>
              </div>
              <div className="match-meta">
                <span className={'pill ' + p.status}>{label(p.status)}</span>
                <span className="proposer">{new Date(p.created_at).toLocaleDateString('it-IT')}</span>
              </div>
            </div>
          ))}
        <p className="sub small" style={{ marginTop: 8 }}>Giallo = in attesa, verde = approvato e valido, rosso = rifiutato.</p>
      </div>
    </main>
  )
}
