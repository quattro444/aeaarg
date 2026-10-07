'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../../lib/supabase'

export default function Utenti() {
  const [q, setQ] = useState('')
  const [list, setList] = useState([])
  const [counts, setCounts] = useState({})
  const [user, setUser] = useState(null)
  const [following, setFollowing] = useState(new Set())

  async function search(name) {
    const { data: { session } } = await supabase.auth.getSession()
    const u = session?.user || null
    setUser(u)
    let query = supabase.from('profiles').select('id,display_name,username,avatar_url,bio').limit(30)
    if (name.trim()) {
      const v = name.trim().toLowerCase()
      query = query.or(`username.ilike.%${v}%,display_name.ilike.%${v}%`)
    }
    const { data } = await query
    setList(data || [])
    if (data && data.length) {
      const ids = data.map(x => x.id)
      const { data: f } = await supabase.from('follows').select('following_id,follower_id').or(
        `follower_id.in.(${ids.join(',')}),following_id.in.(${ids.join(',')})`
      )
      const c = {}
      ids.forEach(id => { c[id] = { followers: 0, following: 0 } })
      ;(f || []).forEach(r => {
        if (c[r.following_id]) c[r.following_id].followers++
        if (c[r.follower_id]) c[r.follower_id].following++
      })
      setCounts(c)
      if (u) {
        const { data: mine } = await supabase.from('follows').select('following_id').eq('follower_id', u.id)
        setFollowing(new Set((mine || []).map(x => x.following_id)))
      }
    }
  }

  useEffect(() => { search('') }, [])

  async function toggle(id, on) {
    if (!user) return
    if (on) await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', id)
    else await supabase.from('follows').insert({ follower_id: user.id, following_id: id })
    search(q)
  }

  return (
    <main style={{ maxWidth: 600 }}>
      <h1>Persone</h1>
      <p className="sub">Cerca @username o nome, visita e segui. Contatori live.</p>
      <div className="card">
        <input placeholder="Cerca @marco..." value={q} onChange={e => { setQ(e.target.value); search(e.target.value) }} />
      </div>
      {list.map(p => (
        <div key={p.id} className="card" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <Link href={`/giocatore/${p.id}`} prefetch>
            <div className="big-avatar" style={{ width: 52, height: 52 }}>{p.avatar_url ? <img src={p.avatar_url} alt="" /> : (p.display_name || p.username || '?')[0]}</div>
          </Link>
          <div style={{ minWidth: 0, flex: 1 }}>
            <Link href={`/giocatore/${p.id}`} prefetch style={{ textDecoration: 'none' }}><b>{p.display_name || 'Senza nome'}</b></Link>
            {p.username && <div className="sub small" style={{ margin: 0 }}>@{p.username}</div>}
            <div className="sub small" style={{ margin: 0 }}>{counts[p.id]?.followers || 0} follower · {counts[p.id]?.following || 0} seguiti</div>
          </div>
          {user && user.id !== p.id && (
            following.has(p.id)
              ? <button className="alt" onClick={() => toggle(p.id, true)}>Seguito</button>
              : <button onClick={() => toggle(p.id, false)}>Segui</button>
          )}
        </div>
      ))}
      {list.length === 0 && <p className="empty">Nessuno trovato.</p>}
    </main>
  )
}
