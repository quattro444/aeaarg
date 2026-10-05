'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { computeStandings } from '../../../lib/standings'

export default function SquadraDettaglio({ params }) {
  const [team, setTeam] = useState(null)
  const [owner, setOwner] = useState(null)
  const [stats, setStats] = useState(null)
  const [next, setNext] = useState([])
  const [last, setLast] = useState([])
  const [user, setUser] = useState(null)
  const [isStaff, setIsStaff] = useState(false)
  const [logoUrl, setLogoUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [msg, setMsg] = useState('')

  async function load() {
    const { data: { session } } = await supabase.auth.getSession()
    const u = session?.user || null
    setUser(u)
    if (u) {
      const { data: prof } = await supabase.from('profiles').select('role').eq('id', u.id).single()
      setIsStaff(prof?.role === 'admin' || prof?.role === 'moderator')
    }
    const { data: t } = await supabase.from('teams').select('*').eq('id', params.id).single()
    if (!t) return
    setTeam(t)
    setLogoUrl(t.logo_url || '')
    if (t.owner_id) {
      const { data: p } = await supabase.from('profiles').select('display_name,username,avatar_url').eq('id', t.owner_id).single()
      if (p) setOwner(p)
    }
    // stats live dalle approvate + prossime/ultime
    const { data: appr } = await supabase.from('match_proposals').select('*').eq('status', 'approved')
    const all = (appr || []).filter(p => p.team_a_id === params.id || p.team_b_id === params.id)
    if (all.length) {
      const table = computeStandings([{ id: t.id, name: t.name }].concat(
        [...new Set(all.flatMap(p => [p.team_a_id, p.team_b_id]))]
          .filter(id => id !== t.id).map(id => ({ id, name: id }))
      ), all)
      setStats(table.find(r => r.team_id === t.id) || null)
    } else setStats({ played: 0, wins: 0, losses: 0, league_points: 0 })
    const { data: fx } = await supabase.from('fixtures').select('*')
      .or(`home_id.eq.${params.id},away_id.eq.${params.id}`).order('scheduled_at', { ascending: true }).limit(5)
    if (fx) setNext(fx)
    const { data: pr } = await supabase.from('match_proposals').select('*')
      .or(`team_a_id.eq.${params.id},team_b_id.eq.${params.id}`).eq('status', 'approved')
      .order('created_at', { ascending: false }).limit(5)
    if (pr) setLast(pr)
  }

  useEffect(() => { load() }, [params.id])

  const canEdit = user && team && (isStaff || team.owner_id === user.id)

  async function saveLogo() {
    setMsg('')
    const { error } = await supabase.from('teams').update({ logo_url: logoUrl.trim() || null }).eq('id', team.id)
    if (error) { setMsg('Errore: ' + error.message); return }
    setMsg('Logo aggiornato.')
    load()
  }

  async function upload(e) {
    const f = e.target.files?.[0]
    if (!f) return
    setUploading(true); setMsg('')
    const path = `${team.id}/${Date.now()}_${f.name}`
    const { error } = await supabase.storage.from('team-logos').upload(path, f, { upsert: true })
    if (error) { setUploading(false); setMsg('Upload fallito (esegui MIGRAZIONE4.sql?): ' + error.message); return }
    const { data } = supabase.storage.from('team-logos').getPublicUrl(path)
    setLogoUrl(data.publicUrl)
    await supabase.from('teams').update({ logo_url: data.publicUrl }).eq('id', team.id)
    setUploading(false); setMsg('Immagine caricata.')
    load()
  }

  if (!team) return <main><p className="sub">Caricamento squadra...</p></main>

  return (
    <main style={{ maxWidth: 640 }}>
      <div className="card" style={{ background: 'linear-gradient(135deg,#0E3A6B,#0A2A4F)', color: '#fff', border: 'none' }}>
        <div className="profile-top">
          <div className="big-avatar" style={{ borderColor: '#FF7A1A', background: '#fff', color: '#0E3A6B' }}>
            {team.logo_url ? <img src={team.logo_url} alt="" /> : team.name[0]}
          </div>
          <div>
            <h1 style={{ fontSize: '1.8rem' }}>{team.name}</h1>
            <p className="sub" style={{ color: '#cbd5e1', margin: 0 }}>
              {owner ? `gestita da ${owner.display_name || ''} ${owner.username ? '@' + owner.username : ''}` : 'squadra libera'}
            </p>
          </div>
        </div>
        {stats && (
          <div style={{ display: 'flex', gap: 18, fontWeight: 800 }}>
            <span>G {stats.played}</span><span>V {stats.wins}</span><span>P {stats.losses}</span><span>Pt {stats.league_points}</span>
          </div>
        )}
      </div>

      {canEdit && (
        <div className="card">
          <h2>Logo squadra</h2>
          <p className="sub">Tu (proprietario) o admin potete cambiarlo. Futuro: verrà usato in notizie e classifica.</p>
          <input placeholder="https://... oppure carica sotto" value={logoUrl} onChange={e => setLogoUrl(e.target.value)} />
          <div className="row">
            <button onClick={saveLogo}>Salva URL</button>
            <label className="alt" style={{ border: '1px solid var(--line)', borderRadius: 10, padding: '10px 18px', fontWeight: 700, cursor: 'pointer' }}>
              {uploading ? 'Carico...' : 'Carica immagine'}
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={upload} />
            </label>
          </div>
          {msg && <p className="msg">{msg}</p>}
        </div>
      )}

      <div className="card">
        <h2>Prossime partite</h2>
        {next.length === 0 ? <p className="sub">Nessuna in calendario.</p> :
          next.map(f => <div key={f.id} className="match-card"><span>{new Date(f.scheduled_at).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span></div>)}
      </div>
      <div className="card">
        <h2>Ultimi risultati</h2>
        {last.length === 0 ? <p className="sub">Nessun risultato approvato.</p> :
          last.map(p => <div key={p.id} className="match-card"><span className="match-score">{p.score_a} - {p.score_b}</span></div>)}
      </div>
    </main>
  )
}
