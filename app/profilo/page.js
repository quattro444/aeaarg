'use client'
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { supabase } from '../../lib/supabase'
import { cleanUsername } from '../../lib/standings'

function ProfiloInner() {
  const router = useRouter()
  const params = useSearchParams()
  const onboarding = params.get('onboarding') === '1'
  const [user, setUser] = useState(null)
  const [role, setRole] = useState('user')
  const [displayName, setDisplayName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [username, setUsername] = useState('')
  const [bio, setBio] = useState('')
  const [myTeams, setMyTeams] = useState([])
  const [loading, setLoading] = useState(true)
  const [needUser, setNeedUser] = useState(false)
  const [msg, setMsg] = useState('')
  const [bad, setBad] = useState(false)

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) { router.push('/login'); return }
      const u = session.user
      setUser(u)
      let { data } = await supabase.from('profiles').select('*').eq('id', u.id).single()
      if (!data) {
        await supabase.from('profiles').insert({ id: u.id, role: 'user' })
        data = { role: 'user' }
      }
      // FIX loop: se hai già username, l'onboarding non deve riapparire al rientro
      if (data.username && params.get('onboarding') === '1') {
        router.replace('/profilo')
        return
      }
      setRole(data.role || 'user')
      setDisplayName(data.display_name || u.user_metadata?.full_name || '')
      setAvatarUrl(data.avatar_url || u.user_metadata?.avatar_url || '')
      setUsername(data.username || '')
      setBio(data.bio || '')
      if (!data.username) setNeedUser(true)
      const t = await supabase.from('teams').select('id,name').eq('owner_id', u.id)
      if (!t.error) setMyTeams(t.data || [])
      setLoading(false)
    })()
  }, [router])

  async function salva() {
    setMsg(''); setBad(false)
    const u = cleanUsername(username)
    if (!u) { setBad(true); setMsg('Scegli un @username (min 3 caratteri).'); return }
    if (u.length < 3) { setBad(true); setMsg('@username troppo corto.'); return }
    // unicità (b serve ad a: senza, le future @menzioni nelle notizie si romperebbero)
    const { data: altri } = await supabase.from('profiles').select('id').eq('username', u).neq('id', user.id).limit(1)
    if (altri && altri.length > 0) { setBad(true); setMsg('@' + u + ' già preso, provane un altro.'); return }
    const { error } = await supabase.from('profiles').update({
      display_name: displayName.trim() || null,
      avatar_url: avatarUrl.trim() || null,
      username: u,
      bio: bio.trim().slice(0, 160) || null,
    }).eq('id', user.id)
    if (error) {
      if (error.message.includes('column')) { setBad(true); setMsg('Esegui MIGRAZIONE3.sql su Supabase, poi riprova.'); return }
      setBad(true); setMsg('Errore: ' + error.message); return
    }
    setUsername(u)
    setNeedUser(false)
    setMsg(showOb ? 'Benvenuto @' + u + '! Profilo pronto.' : 'Profilo aggiornato.')
    if (showOb) setTimeout(() => router.push('/'), 900)
  }

  async function logout() {
    if (!confirm('Sei sicuro di voler uscire?')) return
    await supabase.auth.signOut()
    router.push('/'); router.refresh()
  }

  if (loading) return <main><p className="sub">Caricamento profilo...</p></main>
  if (!user) return null
  const initial = (displayName || username || user.email || 'U')[0].toUpperCase()
  const showOb = onboarding || needUser

  return (
    <main className="narrow" style={{ maxWidth: 560 }}>
      {showOb && (
        <div className="card welcome">
          <h2>Ultimo passo: il tuo @username</h2>
          <p className="sub">Ti servirà per le notizie e per farti taggare. Sceglilo bene (puoi cambiarlo dopo).</p>
        </div>
      )}
      <div className="card">
        <div className="profile-top">
          <div className="big-avatar">{avatarUrl ? <img src={avatarUrl} alt="" /> : initial}</div>
          <div>
            <h1 style={{ fontSize: '1.5rem' }}>{displayName || 'Senza nome'}</h1>
            <p className="sub" style={{ margin: 0 }}>{username ? '@' + username : user.email}</p>
            <span className={'badge' + (role === 'admin' ? ' admin' : '')}>{role === 'admin' ? 'Admin' : 'Giocatore'}</span>
          </div>
        </div>
        <label className="small">@username (unico, per le future notizie)</label>
        <div className="row" style={{ marginTop: 0 }}>
          <span style={{ fontWeight: 800 }}>@</span>
          <input style={{ flex: 1 }} placeholder="es. marco_pong" value={username}
            onChange={e => setUsername(cleanUsername(e.target.value))} />
        </div>
        <label className="small">Nome visibile</label>
        <input placeholder="Es. Marco P." value={displayName} onChange={e => setDisplayName(e.target.value)} />
        <label className="small">Descrizione (max 160)</label>
        <textarea placeholder="Es. Gioco per FSPP, dritto micidiale." value={bio}
          onChange={e => setBio(e.target.value.slice(0, 160))} rows={3}
          style={{ font: 'inherit', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--line)', width: '100%' }} />
        <p className="sub small">{bio.length}/160</p>
        <label className="small">Foto profilo (URL)</label>
        <input placeholder="https://..." value={avatarUrl} onChange={e => setAvatarUrl(e.target.value)} />
        <div className="row">
          <button onClick={salva}>{onboarding ? 'Finisci e entra' : 'Salva profilo'}</button>
          {!onboarding && <a href={`/giocatore/${user.id}`}><button className="alt">Anteprima pubblica</button></a>}
        </div>
        {msg && <p className={'msg' + (bad ? ' err' : '')}>{msg}</p>}
      </div>

      {!onboarding && (
      <div className="card">
        <h2>Le mie squadre ({myTeams.length})</h2>
        {myTeams.length === 0
          ? <p className="sub">Nessuna squadra assegnata. Chiedi all'admin di assegnartene una via email.</p>
          : <ul className="list">{myTeams.map(t => <li key={t.id}>{t.name}</li>)}</ul>}
        <div className="row">
          {role === 'admin' && <a href="/admin"><button>Vai al pannello admin</button></a>}
          <button className="alt" onClick={logout}>Esci</button>
        </div>
      </div>
      )}
    </main>
  )
}

export default function Profilo() {
  return <Suspense fallback={<main><p className="sub">Caricamento...</p></main>}><ProfiloInner /></Suspense>
}
