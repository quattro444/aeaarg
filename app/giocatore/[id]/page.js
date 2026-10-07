'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../../../lib/supabase'

export default function Giocatore({ params }) {
  const [p, setP] = useState(null)
  const [teams, setTeams] = useState([])
  const [followerN, setFollowerN] = useState(0)
  const [followingN, setFollowingN] = useState(0)
  const [isFollowing, setIsFollowing] = useState(false)
  const [user, setUser] = useState(null)
  const [err, setErr] = useState('')

  async function load() {
    const { data: { session } } = await supabase.auth.getSession()
    setUser(session?.user || null)
    const { data, error } = await supabase.from('profiles').select('*').eq('id', params.id).single()
    if (error) { setErr('Profilo non visibile: ' + error.message); return }
    setP(data)
    const t = await supabase.from('teams').select('id,name').eq('owner_id', params.id)
    if (!t.error) setTeams(t.data || [])
    const { data: f1 } = await supabase.from('follows').select('id', { count: 'exact' }).eq('following_id', params.id)
    // conteggi semplici e veloci
    const a = await supabase.from('follows').select('follower_id').eq('following_id', params.id)
    const b = await supabase.from('follows').select('following_id').eq('follower_id', params.id)
    setFollowerN((a.data || []).length)
    setFollowingN((b.data || []).length)
    if (session?.user && session.user.id !== params.id) {
      const { data: f } = await supabase.from('follows').select('*')
        .eq('follower_id', session.user.id).eq('following_id', params.id).limit(1)
      setIsFollowing((f || []).length > 0)
    }
  }

  useEffect(() => { load() }, [params.id])

  async function toggle() {
    if (!user) return
    if (isFollowing) await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', params.id)
    else await supabase.from('follows').insert({ follower_id: user.id, following_id: params.id })
    load()
  }

  if (err) return <main><div className="card"><p className="msg err">{err}</p></div></main>
  if (!p) return <main><p className="sub">Caricamento...</p></main>
  const initial = (p.display_name || p.username || 'U')[0].toUpperCase()

  return (
    <main className="narrow" style={{ maxWidth: 560 }}>
      <div className="card">
        <div className="profile-top">
          <div className="big-avatar">{p.avatar_url ? <img src={p.avatar_url} alt="" /> : initial}</div>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: '1.5rem' }}>{p.display_name || 'Giocatore'}</h1>
            {p.username && <p className="sub" style={{ margin: 0, fontWeight: 800 }}>@{p.username}</p>}
            <span className={'badge' + (p.role === 'admin' ? ' admin' : '')}>{p.role}</span>
            <div className="sub small" style={{ margin: '6px 0 0' }}>{followerN} follower · {followingN} seguiti</div>
          </div>
        </div>
        {user && user.id !== p.id && (
          isFollowing
            ? <button className="alt" onClick={toggle} style={{ width: '100%' }}>Seguito ✓</button>
            : <button onClick={toggle} style={{ width: '100%' }}>Segui</button>
        )}
        {p.bio && <p style={{ whiteSpace: 'pre-wrap', marginTop: 12 }}>{p.bio}</p>}
        <h2 style={{ marginTop: 14 }}>Squadre ({teams.length})</h2>
        {teams.length === 0
          ? <p className="sub">Nessuna squadra assegnata.</p>
          : <ul className="list">{teams.map(t => <li key={t.id}><Link href={`/squadre/${t.id}`} prefetch style={{ textDecoration: 'none' }}>{t.name}</Link></li>)}</ul>}
        <Link href="/notizie" prefetch className="sub small">← Vedi le sue notizie nel feed</Link>
      </div>
    </main>
  )
}
