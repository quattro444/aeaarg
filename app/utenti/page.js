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
    const { data } = await query.order('created_at', { ascending: false })
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
  useEffect(() => { const t = setTimeout(() => search(q), 300); return () => clearTimeout(t) }, [q])

  async function toggle(id, on) {
    if (!user) return
    if (on) await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', id)
    else await supabase.from('follows').insert({ follower_id: user.id, following_id: id })
    search(q)
  }

  return (
    <main style={{ maxWidth: 600 }}>
      <h1>Cerca</h1>
      <p className="sub">Persone del campionato.</p>
      {/* stile Instagram: barra tonda live, niente bottone */}
      <div style={{ position: 'sticky', top: 70, zIndex: 5, background: 'var(--bg)', padding: '8px 0' }}>
        <input placeholder="🔍  Cerca nome o @username..." value={q} onChange={e => setQ(e.target.value)}
          style={{ maxWidth: 'none', borderRadius: 999, background: '#fff', padding: '12px 18px' }} />
      </div>
      {list.map(p => (
        <div key={p.id} className="card ig-row">
          <Link href={`/giocatore/${p.id}`} prefetch>
            <div className="big-avatar" style={{ width: 54, height: 54 }}>{p.avatar_url ? <img src={p.avatar_url} alt="" /> : (p.display_name || p.username || '?')[0]}</div>
          </Link>
          <div style={{ minWidth: 0, flex: 1 }}>
            <Link href={`/giocatore/${p.id}`} prefetch style={{ textDecoration: 'none' }}><b>{p.display_name || 'Senza nome'}</b></Link>
            {p.username && <div className="handle">@{p.username}</div>}
            <div className="sub small" style={{ margin: 0 }}>{counts[p.id]?.followers || 0} follower</div>
          </div>
          {user && user.id !== p.id && (
            following.has(p.id)
              ? <button className="alt sm-btn" onClick={() => toggle(p.id, true)}>Seguito</button>
              : <button className="sm-btn" onClick={() => toggle(p.id, false)}>Segui</button>
          )}
        </div>
      ))}
      {list.length === 0 && <p className="empty">Nessuno trovato per “{q}”.</p>}
    </main>
  )
}
