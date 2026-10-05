'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../lib/supabase'
import { computeStandings } from '../lib/standings'

export default function Home() {
  const [champs, setChamps] = useState([])
  const [champMeta, setChampMeta] = useState(null)
  const [sel, setSel] = useState('')
  const [rows, setRows] = useState([])
  const [claimed, setClaimed] = useState({})
  const [logos, setLogos] = useState({})
  const [src, setSrc] = useState('live')
  const [err, setErr] = useState('')
  const [logged, setLogged] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setLogged(!!session?.user))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setLogged(!!s?.user))
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    supabase.from('championships').select('id,name').order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) return setErr(error.message)
        setChamps(data || []); if (data?.[0]) setSel(data[0].id)
      })
  }, [])

  useEffect(() => {
    if (!sel) return
    ;(async () => {
      // FIX classifica ferma: prima leggeva solo la vista standings (ferma perché le
      // approvazioni vanno in match_proposals). Ora ricalcolo LIVE dalle approvate.
      const [{ data: champ }, { data: teams }, { data: approved, error: eProp }] = await Promise.all([
        supabase.from('championships').select('*').eq('id', sel).single(),
        supabase.from('championship_teams').select('team_id, teams(id,name,owner_id,logo_url)').eq('championship_id', sel),
        supabase.from('match_proposals').select('*').eq('championship_id', sel).eq('status', 'approved'),
      ])
      const teamList = (teams || []).map(t => t.teams).filter(Boolean)
      const m = {}
      const logos = {}
      teamList.forEach(t => { if (t.owner_id) m[t.id] = true; if (t.logo_url) logos[t.id] = t.logo_url })
      setClaimed(m)
      setLogos(logos)
      setChampMeta(champ || null)

      if (!eProp && approved && approved.length > 0) {
        // LIVE: ogni approvazione admin aggiorna subito
        setRows(computeStandings(teamList, approved, champ?.points_win ?? 2, champ?.points_loss ?? 0))
        setSrc(`live (${approved.length} approvate)`)
        return
      }
      // Fallback: vecchia vista standings (se non ci sono ancora approvate)
      const { data, error } = await supabase.from('standings').select('*').eq('championship_id', sel)
        .order('league_points', { ascending: false })
        .order('sets_diff', { ascending: false })
        .order('points_diff', { ascending: false })
      if (error) { setErr(error.message); return }
      // se la vista è vuota ma ci sono squadre iscritte, mostrale a 0 (b serve ad a: non sembra "rotto")
      if ((data || []).length === 0 && teamList.length > 0) {
        setRows(teamList.map(t => ({
          team_id: t.id, team_name: t.name, played: 0, wins: 0, losses: 0,
          sets_diff: 0, points_diff: 0, league_points: 0,
        })))
        setSrc('iscritte (nessuna approvata)')
      } else {
        setRows(data || [])
        setSrc('vista standings')
      }
    })()
  }, [sel])

  return (
    <main>
      <h1>Classifica</h1>
      <p className="sub">Si aggiorna da sola a ogni approvazione admin. Fonte: {src}.</p>
      {logged === false && (
        <div className="card welcome">
          <h2>Prima volta qui?</h2>
          <p className="sub">Crea un account gratis in 10 secondi o accedi con Google per seguire squadre e risultati.</p>
          <div className="row">
            <Link href="/login?mode=signup" prefetch><button>Crea account gratis</button></Link>
            <Link href="/login" prefetch><button className="alt">Accedi con Google / Email</button></Link>
          </div>
        </div>
      )}
      {err && <p className="msg err">Errore dal database: {err}</p>}
      <div className="card">
        {champs.length > 0 && (
          <select value={sel} onChange={e => setSel(e.target.value)}>
            {champs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
        {rows.length === 0 ? (
          <p className="empty">Nessuna squadra in classifica. Crea un campionato dal pannello Admin.</p>
        ) : (
          <div className="scroll"><table>
            <thead><tr><th>#</th><th>Squadra</th><th>G</th><th>V</th><th>P</th><th>Set +/-</th><th>Pt</th></tr></thead>
            <tbody>
              {rows.map((r, i) => {
                const isClaimed = !!claimed[r.team_id]
                const logo = logos[r.team_id]
                return (
                <tr key={r.team_id}>
                  <td><span className={'pos' + (i === 0 ? ' p1' : '') + (i !== 0 && isClaimed ? ' claimed' : '') + (i === 0 && isClaimed ? ' claimed-first' : '')}>{i + 1}</span></td>
                  <td className="team"><Link href={`/squadre/${r.team_id}`} prefetch style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
                    {logo && <img src={logo} alt="" loading="lazy" style={{ width: 26, height: 26, borderRadius: '50%', objectFit: 'cover' }} />}
                    {r.team_name}</Link></td><td>{r.played}</td><td>{r.wins}</td>
                  <td>{r.losses}</td><td>{r.sets_diff > 0 ? '+' : ''}{r.sets_diff}</td>
                  <td className="pts">{r.league_points}</td>
                </tr>
                )
              })}
            </tbody>
          </table></div>
        )}
      </div>
    </main>
  )
}
