'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
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
  const [desc, setDesc] = useState('')
  const [uploading, setUploading] = useState(false)
  const [msg, setMsg] = useState('')
  const [bad, setBad] = useState(false)

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
    setDesc(t.description || '')
    if (t.owner_id) {
      const { data: p } = await supabase.from('profiles').select('display_name,username,avatar_url').eq('id', t.owner_id).single()
      if (p) setOwner(p)
    } else setOwner(null)
    const { data: appr } = await supabase.from('match_proposals').select('*').eq('status', 'approved')
    const all = (appr || []).filter(p => p.team_a_id === params.id || p.team_b_id === params.id)
    if (all.length) {
      const table = computeStandings([{ id: t.id, name: t.name }].concat(
        [...new Set(all.flatMap(p => [p.team_a_id, p.team_b_id]))]
          .filter(id => id !== t.id).map(id => ({ id, name: id }))
      ), all)
      setStats(table.find(r => r.team_id === t.id) || null)
    } else setStats({ played: 0, wins: 0, losses: 0, league_points: 0 })
    const { data: fx } = await supabase.from('fixtures').select('*, home:home_id, away:away_id')
      .or(`home_id.eq.${params.id},away_id.eq.${params.id}`).order('scheduled_at', { ascending: true }).limit(5)
    if (fx) setNext(fx)
    const { data: pr } = await supabase.from('match_proposals').select('*')
      .or(`team_a_id.eq.${params.id},team_b_id.eq.${params.id}`).eq('status', 'approved')
      .order('created_at', { ascending: false }).limit(5)
    if (pr) setLast(pr)
  }

  useEffect(() => { load() }, [params.id])

  const isOwner = user && team && team.owner_id === user.id
  const canEdit = user && team && (isStaff || isOwner)

  async function salva() {
    setMsg(''); setBad(false)
    const { error } = await supabase.from('teams').update({
      logo_url: logoUrl.trim() || null,
      description: desc.trim().slice(0, 300) || null,
    }).eq('id', team.id)
    if (error) {
      setBad(true)
      if (error.message.includes('row-level security'))
        setMsg('Non hai i permessi: esegui MIGRAZIONE5.sql su Supabase, poi riprova. Solo proprietario o admin.')
      else setMsg('Errore: ' + error.message)
      return
    }
    setMsg('Squadra aggiornata.')
    load()
  }

  async function upload(e) {
    const f = e.target.files?.[0]
    if (!f) return
    setUploading(true); setMsg(''); setBad(false)
    const path = `${team.id}/${Date.now()}_${f.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    const { error } = await supabase.storage.from('team-logos').upload(path, f, { upsert: true })
    if (error) { setUploading(false); setBad(true); setMsg('Upload fallito (MIGRAZIONE4.sql?): ' + error.message); return }
    const { data } = supabase.storage.from('team-logos').getPublicUrl(path)
    setLogoUrl(data.publicUrl)
    const { error: e2 } = await supabase.from('teams').update({ logo_url: data.publicUrl }).eq('id', team.id)
    setUploading(false)
    if (e2) { setBad(true); setMsg('Caricata ma non salvata (MIGRAZIONE5.sql?): ' + e2.message); return }
    setMsg('Immagine caricata.')
    load()
  }

  if (!team) return <main><p className="sub">Caricamento squadra...</p></main>

  return (
    <main style={{ maxWidth: 680 }}>
      <Link href="/squadre" prefetch className="small" style={{ textDecoration: 'none' }}>← Tutte le squadre</Link>
      {/* hero moderno, non finto-AI: pulito, niente gradienti pesanti */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ background: '#0B2B52', color: '#fff', padding: '22px 22px 18px' }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <div style={{ width: 76, height: 76, borderRadius: 20, background: '#fff', display: 'grid', placeItems: 'center', fontSize: '2rem', fontWeight: 900, color: '#0B2B52', overflow: 'hidden', flexShrink: 0 }}>
              {team.logo_url ? <img src={team.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : team.name[0]}
            </div>
            <div style={{ minWidth: 0 }}>
              <h1 style={{ fontSize: '1.6rem', margin: 0 }}>{team.name}</h1>
              <p style={{ margin: '4px 0 0', color: '#cbd5e1', fontSize: '.9rem' }}>
                {owner ? <>gestita da <b style={{ color: '#fff' }}>{owner.display_name || 'utente'}</b>{owner.username ? ` @${owner.username}` : ''}</> : 'squadra libera — nessun detentore'}
              </p>
            </div>
          </div>
          {stats && (
            <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
              {[['G', stats.played], ['V', stats.wins], ['P', stats.losses], ['Pt', stats.league_points]].map(([k, v]) => (
                <div key={k} style={{ background: 'rgba(255,255,255,.12)', borderRadius: 12, padding: '8px 14px', fontWeight: 800 }}>{k} <span style={{ color: '#FFB25E' }}>{v}</span></div>
              ))}
            </div>
          )}
        </div>
        <div style={{ padding: '16px 22px' }}>
          {team.description
            ? <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{team.description}</p>
            : <p className="sub" style={{ margin: 0 }}>{canEdit ? 'Aggiungi una descrizione qui sotto.' : 'Nessuna descrizione.'}</p>}
        </div>
      </div>

      {canEdit && (
        <div className="card">
          <h2>Gestisci squadra {isOwner && !isStaff ? '(sei il proprietario)' : ''}</h2>
          <label className="small">Descrizione (max 300)</label>
          <textarea value={desc} onChange={e => setDesc(e.target.value.slice(0, 300))} rows={3}
            placeholder="Es. Squadra del quartiere, allenamenti lun/mer."
            style={{ font: 'inherit', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--line)', width: '100%' }} />
          <label className="small">Logo (URL o upload)</label>
          <input placeholder="https://..." value={logoUrl} onChange={e => setLogoUrl(e.target.value)} />
          <div className="row">
            <button onClick={salva}>Salva</button>
            <label style={{ border: '1px solid var(--line)', borderRadius: 12, padding: '11px 20px', fontWeight: 800, cursor: 'pointer', background: '#fff' }}>
              {uploading ? 'Carico...' : 'Carica immagine'}
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={upload} />
            </label>
          </div>
          {msg && <p className={'msg' + (bad ? ' err' : '')}>{msg}</p>}
        </div>
      )}
      {!canEdit && msg && <p className="msg">{msg}</p>}

      <div className="card">
        <h2>Prossime partite</h2>
        {next.length === 0 ? <p className="sub">Nessuna in calendario.</p> :
          next.map(f => <div key={f.id} className="match-card"><span>{f.scheduled_at ? new Date(f.scheduled_at).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'da definire'}</span></div>)}
      </div>
      <div className="card">
        <h2>Ultimi risultati</h2>
        {last.length === 0 ? <p className="sub">Nessun risultato approvato.</p> :
          last.map(p => <div key={p.id} className="match-card"><span className="match-score">{p.score_a} - {p.score_b}</span></div>)}
      </div>
    </main>
  )
}
