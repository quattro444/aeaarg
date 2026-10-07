'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { SUPERADMIN_EMAIL, isSuperadmin } from '../../lib/roles'

function ProposalRow({ p, a, b, onApprove, onReject, onSave, onDel }) {
  const [sa, setSa] = useState(p.score_a)
  const [sb, setSb] = useState(p.score_b)
  return (
    <div className="match-card">
      <div className="match-top">
        <span className="match-teams">{a} vs {b}</span>
        <span className="match-score">{p.score_a} - {p.score_b}</span>
      </div>
      <div className="match-meta">
        <span className={'pill ' + p.status}>{p.status === 'pending' ? 'in attesa' : p.status === 'approved' ? 'approvato' : 'rifiutato'}</span>
        <div className="admin-actions">
          <input type="number" min="0" value={sa} onChange={e => setSa(e.target.value)} style={{ maxWidth: 70 }} />
          <span>-</span>
          <input type="number" min="0" value={sb} onChange={e => setSb(e.target.value)} style={{ maxWidth: 70 }} />
          <button className="mini" onClick={() => onSave(sa, sb)}>Correggi</button>
        </div>
      </div>
      <div className="admin-actions">
        {p.status === 'pending' && (
          <>
            <button className="mini btn-ok" onClick={onApprove}>Approva</button>
            <button className="mini danger" onClick={onReject}>Rifiuta</button>
          </>
        )}
        <button className="mini danger" onClick={onDel}>Elimina</button>
      </div>
    </div>
  )
}

export default function Admin() {
  const [ok, setOk] = useState(null)
  const [user, setUser] = useState(null)
  const [teams, setTeams] = useState([])
  const [champs, setChamps] = useState([])
  const [links, setLinks] = useState([]) // championship_teams con team name
  const [teamName, setTeamName] = useState('')
  const [champName, setChampName] = useState('')
  const [selChamp, setSelChamp] = useState('')
  const [selTeam, setSelTeam] = useState('')
  const [assignTeam, setAssignTeam] = useState('')
  const [assignMail, setAssignMail] = useState('')
  const [proposals, setProposals] = useState([])
  const [owners, setOwners] = useState({}) // profile_id -> {email, display_name}
  const [allProfiles, setAllProfiles] = useState([])
  const [myRole, setMyRole] = useState(null)
  const [roleMail, setRoleMail] = useState('')
  const [roleVal, setRoleVal] = useState('moderator')
  const [fixtures, setFixtures] = useState([])
  const [calDays, setCalDays] = useState([1, 3, 5])
  const [calTime, setCalTime] = useState('19:00')
  const [calStart, setCalStart] = useState(new Date().toISOString().slice(0, 10))
  const [msg, setMsg] = useState('')
  const [bad, setBad] = useState(false)
  const say = (m, b = false) => { setMsg(m); setBad(b) }

  async function load() {
    const { data: { session } } = await supabase.auth.getSession()
    const u = session?.user
    if (!u) return setOk(false)
    setUser(u)
    // auto-crea profilo se manca
    let { data: prof } = await supabase.from('profiles').select('role').eq('id', u.id).single()
    if (!prof) {
      await supabase.from('profiles').insert({ id: u.id, role: 'user' })
      setOk(false); return
    }
    setMyRole(prof.role)
    // moderatori: entrano ma vedono solo risultati/calendario (b serve ad a: futuri moderatori news)
    if (prof.role !== 'admin' && prof.role !== 'moderator' && !isSuperadmin(u.email)) { setOk(false); return }
    setOk(true)

    const t = await supabase.from('teams').select('*').order('name')
    if (!t.error) setTeams(t.data || [])
    const c = await supabase.from('championships').select('*').order('created_at', { ascending: false })
    if (!c.error) {
      setChamps(c.data || [])
      if (c.data?.[0] && !selChamp) setSelChamp(c.data[0].id)
    }
    const l = await supabase.from('championship_teams').select('championship_id, team_id, teams(name)')
    if (!l.error) setLinks(l.data || [])
    // proposte risultati (se la tabella esiste)
    const pr = await supabase.from('match_proposals').select('*').order('created_at', { ascending: false }).limit(50)
    if (!pr.error) setProposals(pr.data || [])
    // proprietari: mail + nome per mostrare chi ha preso cosa (già salvato, qui solo display)
    const ow = await supabase.from('profiles').select('id,email,display_name,username,role')
    if (!ow.error) {
      const m = {}
      ;(ow.data || []).forEach(p => { m[p.id] = p })
      setOwners(m)
      setAllProfiles(ow.data || [])
    }
    const fx = await supabase.from('fixtures').select('*').order('scheduled_at', { ascending: true }).limit(200)
    if (!fx.error) setFixtures(fx.data || [])
  }

  useEffect(() => { load() }, [])

  // ---- SQUADRE ----
  async function addTeam() {
    const name = teamName.trim().replace(/\s+/g, ' ')
    if (!name) return say('Scrivi un nome squadra.', true)
    if (teams.some(t => t.name.toLowerCase() === name.toLowerCase()))
      return say('Squadra già esistente.', true)
    const { error } = await supabase.from('teams').insert({ name })
    if (error) return say('Errore squadra: ' + error.message, true)
    say('Squadra aggiunta'); setTeamName(''); load()
  }

  async function delTeam(id, name) {
    if (!confirm(`Eliminare la squadra "${name}"? Verrà rimossa anche dai campionati.`)) return
    // prima rimuovi i legami, poi la squadra (onnipotente ma pulito)
    await supabase.from('championship_teams').delete().eq('team_id', id)
    const { error } = await supabase.from('teams').delete().eq('id', id)
    if (error) return say('Errore eliminazione: ' + error.message, true)
    say('Squadra eliminata'); load()
  }

  // ---- CAMPIONATI ----
  async function addChamp() {
    const name = champName.trim()
    if (!name) return say('Scrivi un nome campionato.', true)
    const { data, error } = await supabase.from('championships').insert({ name }).select().single()
    if (error) return say('Errore campionato: ' + error.message, true)
    // NON aggiunge più tutte le squadre in automatico: l'admin sceglie chi includere
    say(`Campionato "${data.name}" creato. Ora aggiungi le squadre sotto.`)
    setChampName(''); setSelChamp(data.id); load()
  }

  async function delChamp(id, name) {
    if (!confirm(`Eliminare il campionato "${name}" e tutti i suoi legami?`)) return
    await supabase.from('championship_teams').delete().eq('championship_id', id)
    const { error } = await supabase.from('championships').delete().eq('id', id)
    if (error) return say('Errore eliminazione: ' + error.message, true)
    say('Campionato eliminato'); setSelChamp(''); load()
  }

  // ---- LEGAMI ----
  async function addTeamToChamp() {
    if (!selChamp || !selTeam) return say('Scegli campionato e squadra.', true)
    const { error } = await supabase.from('championship_teams').insert({ championship_id: selChamp, team_id: selTeam })
    if (error) {
      if (error.message.includes('duplicate') || error.code === '23505')
        return say('Squadra già nel campionato.', true)
      return say('Errore legame: ' + error.message + ' (controlla RLS su Supabase)', true)
    }
    say('Squadra aggiunta al campionato'); load()
  }

  async function removeTeamFromChamp(championship_id, team_id) {
    const { error } = await supabase.from('championship_teams').delete()
      .eq('championship_id', championship_id).eq('team_id', team_id)
    if (error) return say('Errore rimozione: ' + error.message, true)
    say('Squadra rimossa dal campionato'); load()
  }

  // ---- ASSEGNAZIONE VIA MAIL ----
  async function assegna() {
    if (!assignTeam || !assignMail.trim()) return say('Scegli squadra e scrivi email.', true)
    const mail = assignMail.trim().toLowerCase()
    // cerca profilo per email (richiede colonna email in profiles -> MIGRAZIONE2.sql)
    let { data: prof, error: e1 } = await supabase.from('profiles').select('id').eq('email', mail).single()
    if (e1 || !prof) {
      // fallback: prova a cercare per display? no -> spiega
      return say('Nessun profilo con quella email. L\u2019utente deve aver fatto almeno un login e devi aver eseguito MIGRAZIONE2.sql.', true)
    }
    const { error } = await supabase.from('teams').update({ owner_id: prof.id }).eq('id', assignTeam)
    if (error) return say('Errore assegnazione (esegui MIGRAZIONE2.sql per owner_id?): ' + error.message, true)
    say('Squadra assegnata a ' + mail); setAssignMail(''); load()
  }

  async function togliOwner(id) {
    const { error } = await supabase.from('teams').update({ owner_id: null }).eq('id', id)
    if (error) return say('Errore: ' + error.message, true)
    say('Proprietario rimosso'); load()
  }

  // ---- APPROVAZIONE RISULTATI (anti-imbroglio) ----
  async function setProposalStatus(id, status) {
    const { error } = await supabase.from('match_proposals').update({ status }).eq('id', id)
    if (error) return say('Errore: ' + error.message, true)
    say(status === 'approved' ? 'Risultato approvato: classifica aggiornata da sola.' : 'Risultato rifiutato.');
    load()
  }

  async function editProposal(p, sa, sb) {
    const a = parseInt(sa), b = parseInt(sb)
    if (!Number.isFinite(a) || !Number.isFinite(b)) return say('Punteggi non validi.', true)
    const { error } = await supabase.from('match_proposals').update({ score_a: a, score_b: b }).eq('id', p.id)
    if (error) return say('Errore modifica: ' + error.message, true)
    say('Risultato corretto, classifica ricalcolata.'); load()
  }

  async function delProposal(id) {
    if (!confirm('Eliminare questa proposta? La classifica si aggiorna da sola.')) return
    const { error } = await supabase.from('match_proposals').delete().eq('id', id)
    if (error) return say('Errore: ' + error.message, true)
    say('Proposta eliminata.'); load()
  }

  // ---- CALENDARIO: genera partite da giorni/orari (b serve ad a: senza date le partite sono caos) ----
  async function generaCalendario() {
    if (!selChamp) return say('Scegli un campionato.', true)
    if (calDays.length === 0) return say('Spunta almeno un giorno.', true)
    const teamIds = links.filter(l => l.championship_id === selChamp).map(l => l.team_id)
    if (teamIds.length < 2) return say('Servono almeno 2 squadre nel campionato.', true)
    if (!confirm(`Generare il calendario per ${teamIds.length} squadre? Quelle vecchie di questo campionato verranno sostituite.`)) return
    const { roundRobin, planDates } = await import('../../lib/schedule')
    const rounds = roundRobin(teamIds)
    const plan = planDates(rounds, { startDate: calStart, days: calDays, time: calTime, maxPerDay: 10 })
    // Pro: sostituzione pulita. Contro: cancella date manuali — per questo chiediamo conferma sopra.
    const del = await supabase.from('fixtures').delete().eq('championship_id', selChamp)
    if (del.error) return say('Errore pulizia: ' + del.error.message, true)
    const rows = plan.map(g => ({
      championship_id: selChamp, round_no: g.round, home_id: g.home, away_id: g.away, scheduled_at: g.scheduled_at,
    }))
    const { error } = await supabase.from('fixtures').insert(rows)
    if (error) return say('Errore calendario (esegui MIGRAZIONE3.sql?): ' + error.message, true)
    say(`Calendario creato: ${rows.length} partite in ${rounds.length} turni.`)
    load()
  }

  async function delFixture(id) {
    if (!confirm('Eliminare questa partita dal calendario?')) return
    const { error } = await supabase.from('fixtures').delete().eq('id', id)
    if (error) return say('Errore: ' + error.message, true)
    say('Partita eliminata.'); load()
  }

  async function moveFixture(id, iso) {
    const { error } = await supabase.from('fixtures').update({ scheduled_at: new Date(iso).toISOString() }).eq('id', id)
    if (error) return say('Errore data: ' + error.message, true)
    say('Data spostata.'); load()
  }

  // ---- SUPER-ADMIN: solo tua mail può dare/togliere admin e moderatori ----
  const amISuper = user && isSuperadmin(user.email)
  async function setUserRole() {
    if (!amISuper) return say('Solo il super-admin può farlo.', true)
    if (!roleMail.trim()) return say('Scrivi una email.', true)
    const mail = roleMail.trim().toLowerCase()
    const target = allProfiles.find(p => (p.email || '').toLowerCase() === mail)
    if (!target) return say('Nessun profilo con quella email (deve aver fatto login almeno una volta).', true)
    if (target.id === user.id) return say('Non puoi cambiarti il ruolo da solo (sicurezza).', true)
    const { error } = await supabase.from('profiles').update({ role: roleVal }).eq('id', target.id)
    if (error) return say('Errore ruolo: ' + error.message, true)
    say(`${mail} ora è ${roleVal}.`); setRoleMail(''); load()
  }
  async function removeStaff(id, mail) {
    if (!amISuper) return
    if (!confirm(`Togliere i poteri a ${mail}? Diventa utente semplice.`)) return
    const { error } = await supabase.from('profiles').update({ role: 'user' }).eq('id', id)
    if (error) return say('Errore: ' + error.message, true)
    say('Ruolo rimosso.'); load()
  }

  // rivendica / riassegna: per ora mostra chi è dentro e permette di gestire
  const teamsInSel = links.filter(l => l.championship_id === selChamp)

  if (ok === null) return <p className="sub">Caricamento...</p>
  if (!ok) return <div className="card narrow"><h2>Area riservata</h2><p className="sub">Serve un account admin.{user ? '' : ' Accedi prima.'}</p><a href="/login"><button>Accedi</button></a></div>

  return (
    <main>
      <h1>Pannello {myRole === 'moderator' ? 'moderatore' : 'admin'}</h1>
      <p className="sub">Onnipotente: crea, aggiunge, toglie ed elimina tutto.</p>

      {amISuper && (
        <div className="card" style={{ borderColor: '#B45309' }}>
          <h2>Accesso speciale super-admin</h2>
          <p className="sub">Solo {SUPERADMIN_EMAIL}. Aggiungi/togli admin e moderatori (futuri moderatori notizie).</p>
          <div className="row">
            <input placeholder="email utente" value={roleMail} onChange={e => setRoleMail(e.target.value)} />
            <select value={roleVal} onChange={e => setRoleVal(e.target.value)} style={{ maxWidth: 160 }}>
              <option value="moderator">moderator</option>
              <option value="admin">admin</option>
              <option value="user">user</option>
            </select>
            <button onClick={setUserRole}>Imposta ruolo</button>
          </div>
          {allProfiles.filter(p => p.role === 'admin' || p.role === 'moderator').map(p => (
            <div key={p.id} className="owner-card">
              <b>{p.email}</b>
              <span className="owner-name">{p.display_name || ''} {p.username ? '@' + p.username : ''}</span>
              <span className={'pill ' + (p.role === 'admin' ? 'approved' : 'pending')}>{p.role}</span>
              {p.id !== user.id && <button className="mini danger" onClick={() => removeStaff(p.id, p.email)}>Togli</button>}
            </div>
          ))}
        </div>
      )}

      {(myRole === 'admin' || amISuper) && (
      <>
      <div className="card">
        <h2>Squadre ({teams.length})</h2>
        {teams.length === 0 ? <p className="empty">Nessuna squadra: aggiungi la prima.</p>
          : <ul className="list">{teams.map(t => (
            <li key={t.id}>{t.name}
              <button className="mini danger" onClick={() => delTeam(t.id, t.name)} title="Elimina squadra">✕</button>
            </li>))}</ul>}
        <div className="row">
          <input placeholder="Nome squadra" value={teamName} onChange={e => setTeamName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addTeam() }} />
          <button onClick={addTeam}>Aggiungi squadra</button>
        </div>
      </div>

      <div className="card">
        <h2>Campionati ({champs.length})</h2>
        {champs.length === 0 ? <p className="empty">Nessun campionato.</p> : (
          <ul className="champs">
            {champs.map(c => (
              <li key={c.id} className={c.id === selChamp ? 'active' : ''}>
                <span onClick={() => setSelChamp(c.id)} style={{ cursor: 'pointer', fontWeight: 700 }}>{c.name}</span>
                <span className="count">{links.filter(l => l.championship_id === c.id).length} squadre</span>
                <button className="mini danger" onClick={() => delChamp(c.id, c.name)}>Elimina</button>
              </li>
            ))}
          </ul>
        )}
        <div className="row">
          <input placeholder="Nome nuovo campionato" value={champName} onChange={e => setChampName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addChamp() }} />
          <button onClick={addChamp}>Crea campionato</button>
        </div>
      </div>

      <div className="card">
        <h2>Squadre nel campionato</h2>
        <div className="row">
          <select value={selChamp} onChange={e => setSelChamp(e.target.value)}>
            <option value="">— scegli campionato —</option>
            {champs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={selTeam} onChange={e => setSelTeam(e.target.value)}>
            <option value="">— scegli squadra —</option>
            {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <button onClick={addTeamToChamp}>Aggiungi al campionato</button>
        </div>
        {selChamp && (
          teamsInSel.length === 0
            ? <p className="empty">Nessuna squadra in questo campionato. Aggiungine una sopra.</p>
            : <ul className="list">{teamsInSel.map(l => (
              <li key={l.team_id}>{l.teams?.name || l.team_id}
                <button className="mini danger" onClick={() => removeTeamFromChamp(l.championship_id, l.team_id)}>Rimuovi</button>
              </li>))}</ul>
        )}
        <p className="sub" style={{ marginTop: 10 }}>L'admin decide chi sta dentro: aggiungi o rimuovi liberamente. Eliminare una squadra la toglie ovunque.</p>
      </div>

      <div className="card">
        <h2>Assegna squadra a utente (via email)</h2>
        <p className="sub">Es. assegni FSPP Pistoiese a te. Così tutti vedono chi la detiene.</p>
        <div className="row">
          <select value={assignTeam} onChange={e => setAssignTeam(e.target.value)}>
            <option value="">— squadra —</option>
            {teams.map(t => <option key={t.id} value={t.id}>{t.name}{t.owner_id ? ' (occupata)' : ''}</option>)}
          </select>
          <input placeholder="email utente" value={assignMail} onChange={e => setAssignMail(e.target.value)} />
          <button onClick={assegna}>Assegna</button>
        </div>
        {teams.filter(t => t.owner_id).length === 0
          ? <p className="empty">Nessuna squadra rivendicata.</p>
          : teams.filter(t => t.owner_id).map(t => {
            const o = owners[t.owner_id]
            return (
              <div key={t.id} className="owner-card">
                <b>{t.name}</b>
                <span className="owner-mail">{o?.email || t.owner_id.slice(0, 8)}</span>
                {o?.display_name && <span className="owner-name">{o.display_name}</span>}
                <button className="mini danger" onClick={() => { if (confirm(`Togliere ${t.name} a ${o?.email || ''}?`)) togliOwner(t.id) }}>Togli</button>
              </div>
            )
          })}
      </div>
      </>
      )}

      <div className="card">
        <h2>Calendario campionato</h2>
        <p className="sub">Scegli giorni + orario, genero io tutte le partite (andata). Poi puoi spostare o cancellare ogni data.</p>
        <div className="row">
          <select value={selChamp} onChange={e => setSelChamp(e.target.value)}>
            <option value="">— campionato —</option>
            {champs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input type="date" value={calStart} onChange={e => setCalStart(e.target.value)} style={{ maxWidth: 170 }} />
          <input type="time" value={calTime} onChange={e => setCalTime(e.target.value)} style={{ maxWidth: 130 }} />
        </div>
        <div className="row">
          {['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'].map((g, i) => (
            <label key={i} style={{ display: 'flex', gap: 4, alignItems: 'center', fontWeight: 700 }}>
              <input type="checkbox" checked={calDays.includes(i)}
                onChange={e => setCalDays(e.target.checked ? [...calDays, i] : calDays.filter(d => d !== i))} />{g}
            </label>
          ))}
        </div>
        <div className="row"><button onClick={generaCalendario}>Genera partite</button></div>
        {fixtures.filter(f => !selChamp || f.championship_id === selChamp).length === 0
          ? <p className="empty">Nessuna partita in calendario. Esegui MIGRAZIONE3.sql se vedi errori.</p>
          : fixtures.filter(f => !selChamp || f.championship_id === selChamp).map(f => {
            const h = teams.find(t => t.id === f.home_id)?.name || '?'
            const a = teams.find(t => t.id === f.away_id)?.name || '?'
            return (
              <div key={f.id} className="match-card">
                <div className="match-top">
                  <span className="match-teams">T{f.round_no} · {h} vs {a}</span>
                  <span className="proposer">{f.scheduled_at ? new Date(f.scheduled_at).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'senza data'}</span>
                </div>
                <div className="admin-actions">
                  <input type="datetime-local" defaultValue={f.scheduled_at ? new Date(f.scheduled_at).toISOString().slice(0, 16) : ''}
                    onChange={e => e.target.value && moveFixture(f.id, e.target.value)} style={{ maxWidth: 200 }} />
                  <button className="mini danger" onClick={() => delFixture(f.id)}>Elimina</button>
                </div>
              </div>
            )
          })}
      </div>

      <div className="card">
        <h2>Risultati da approvare ({proposals.filter(p => p.status === 'pending').length})</h2>
        <p className="sub">Tutto modificabile qui: correggi, approva, rifiuta, elimina. La classifica si aggiorna da sola.</p>
        {proposals.length === 0 ? <p className="empty">Nessuna proposta. Se vedi errore, esegui MIGRAZIONE2.sql.</p> : (
          proposals.map(p => {
            const a = teams.find(t => t.id === p.team_a_id)?.name || p.team_a_id.slice(0, 6)
            const b = teams.find(t => t.id === p.team_b_id)?.name || p.team_b_id.slice(0, 6)
            return (
              <ProposalRow key={p.id} p={p} a={a} b={b}
                onApprove={() => setProposalStatus(p.id, 'approved')}
                onReject={() => setProposalStatus(p.id, 'rejected')}
                onSave={(sa, sb) => editProposal(p, sa, sb)}
                onDel={() => delProposal(p.id)} />
            )
          })
        )}
      </div>

      <ModNotizie say={say} />

      {msg && <p className={'msg' + (bad ? ' err' : '')}>{msg}</p>}
    </main>
  )
}

function ModNotizie({ say }) {
  const [posts, setPosts] = useState([])
  const [q, setQ] = useState('')
  const [banMail, setBanMail] = useState('')
  async function loadP() {
    const { data } = await supabase.from('posts').select('*, author:author_id').order('created_at', { ascending: false }).limit(30)
    setPosts(data || [])
  }
  useEffect(() => { loadP() }, [])
  async function vis(id, visibility) {
    const { error } = await supabase.from('posts').update({ visibility }).eq('id', id)
    say(error ? 'Errore: ' + error.message : 'Visibilità: ' + visibility, !!error)
    loadP()
  }
  async function del(id) {
    if (!confirm('Eliminare definitivamente questa notizia?')) return
    const { error } = await supabase.from('posts').delete().eq('id', id)
    say(error ? 'Errore: ' + error.message : 'Notizia eliminata.', !!error)
    loadP()
  }
  async function timeout() {
    if (!banMail.trim()) return say('Scrivi email.', true)
    const { data: p } = await supabase.from('profiles').select('id').eq('email', banMail.trim().toLowerCase()).single()
    if (!p) return say('Profilo non trovato.', true)
    const until = new Date(Date.now() + 24 * 3600 * 1000).toISOString()
    const { error } = await supabase.from('profiles').update({ news_muted_until: until }).eq('id', p.id)
    say(error ? 'Errore: ' + error.message : 'Timeout 24h applicato.', !!error)
  }
  async function banToggle(id, cur) {
    const { error } = await supabase.from('profiles').update({ news_banned: !cur, news_muted_until: null }).eq('id', id)
    say(error ? 'Errore: ' + error.message : (!cur ? 'Bannato dalle notizie.' : 'Riammesso.'), !!error)
    loadP()
  }
  return (
    <div className="card">
      <h2>Moderazione notizie</h2>
      <p className="sub">Timeout 24h, ban, restringi visibilità, elimina. Views già anti-farming (1 per account).</p>
      <div className="row">
        <input placeholder="email per timeout 24h" value={banMail} onChange={e => setBanMail(e.target.value)} />
        <button onClick={timeout}>Timeout 24h</button>
      </div>
      {posts.filter(p => !q || p.text.toLowerCase().includes(q.toLowerCase())).map(p => (
        <div key={p.id} className="match-card">
          <div className="match-top"><span className="match-teams">{p.text.slice(0, 80)}</span><span className="pill pending">{p.visibility}</span></div>
          <div className="admin-actions">
            <button className="mini" onClick={() => vis(p.id, 'public')}>Pubblica</button>
            <button className="mini" onClick={() => vis(p.id, 'followers')}>Solo follower</button>
            <button className="mini" onClick={() => vis(p.id, 'hidden')}>Nascondi</button>
            <button className="mini danger" onClick={() => del(p.id)}>Elimina</button>
          </div>
        </div>
      ))}
    </div>
  )
}
