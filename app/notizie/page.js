'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../../lib/supabase'

function timeAgo(iso) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000
  if (s < 60) return 'ora'
  if (s < 3600) return Math.floor(s / 60) + 'm'
  if (s < 86400) return Math.floor(s / 3600) + 'h'
  return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })
}

export default function Notizie() {
  const [user, setUser] = useState(null)
  const [myProf, setMyProf] = useState(null)
  const [posts, setPosts] = useState([])
  const [authors, setAuthors] = useState({})
  const [views, setViews] = useState({})
  const [following, setFollowing] = useState(new Set())
  const [text, setText] = useState('')
  const [img, setImg] = useState('')
  const [vid, setVid] = useState('')
  const [lnk, setLnk] = useState('')
  const [msg, setMsg] = useState('')
  const [filter, setFilter] = useState('tutti') // tutti | seguiti

  async function load() {
    const { data: { session } } = await supabase.auth.getSession()
    const u = session?.user || null
    setUser(u)
    let me = null
    if (u) {
      const { data } = await supabase.from('profiles').select('*').eq('id', u.id).single()
      me = data || null
      setMyProf(me)
      const { data: f } = await supabase.from('follows').select('following_id').eq('follower_id', u.id)
      setFollowing(new Set((f || []).map(x => x.following_id)))
    }
    // posts visibili: public + miei; hidden solo se autore/staff (RLS già filtra)
    const { data: p } = await supabase.from('posts').select('*').order('created_at', { ascending: false }).limit(50)
    let list = p || []
    if (filter === 'seguiti' && u) list = list.filter(x => x.author_id === u.id || following.has(x.author_id))
    setPosts(list)
    if (list.length) {
      const ids = [...new Set(list.map(x => x.author_id))]
      const { data: profs } = await supabase.from('profiles').select('id,display_name,username,avatar_url').in('id', ids)
      const m = {}
      ;(profs || []).forEach(a => { m[a.id] = a })
      setAuthors(m)
      // conteggio views reale (1 riga = 1 utente unico)
      const { data: v } = await supabase.from('post_views').select('post_id').in('post_id', list.map(x => x.id))
      const c = {}
      ;(v || []).forEach(r => { c[r.post_id] = (c[r.post_id] || 0) + 1 })
      setViews(c)
      // registra LA MIA view una sola volta (upsert ignora duplicati: anti-farming)
      if (u) {
        for (const post of list) {
          await supabase.from('post_views').upsert(
            { post_id: post.id, viewer_id: u.id },
            { onConflict: 'post_id,viewer_id', ignoreDuplicates: true }
          )
        }
        // riconta dopo le mie (solo se sono nuovo spettatore cambia)
        const { data: v2 } = await supabase.from('post_views').select('post_id').in('post_id', list.map(x => x.id))
        const c2 = {}
        ;(v2 || []).forEach(r => { c2[r.post_id] = (c2[r.post_id] || 0) + 1 })
        setViews(c2)
      }
    }
  }

  useEffect(() => { load() }, [filter])

  const muted = myProf && myProf.news_muted_until && new Date(myProf.news_muted_until) > new Date()
  const banned = myProf && myProf.news_banned

  async function pubblica() {
    setMsg('')
    if (!user) { setMsg('Accedi per pubblicare.'); return }
    if (banned) { setMsg('Sei bannato dalle notizie.'); return }
    if (muted) { setMsg('Sei in timeout fino a ' + new Date(myProf.news_muted_until).toLocaleString('it-IT')); return }
    const t = text.trim()
    if (!t) { setMsg('Scrivi qualcosa.'); return }
    const { error } = await supabase.from('posts').insert({
      author_id: user.id, text: t.slice(0, 500),
      image_url: img.trim() || null, video_url: vid.trim() || null, link_url: lnk.trim() || null,
      visibility: 'public',
    })
    if (error) { setMsg('Bloccato: ' + error.message); return }
    setText(''); setImg(''); setVid(''); setLnk('')
    load()
  }

  async function segui(id) {
    if (!user) return
    const { error } = await supabase.from('follows').insert({ follower_id: user.id, following_id: id })
    if (!error) load()
  }
  async function smetti(id) {
    await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', id)
    load()
  }

  return (
    <main style={{ maxWidth: 600 }}>
      <h1>Notizie</h1>
      <p className="sub">Come X: testo, foto, video, link. Views contate 1 sola volta per account.</p>
      <div className="row" style={{ marginBottom: 12 }}>
        <button className={filter === 'tutti' ? '' : 'alt'} onClick={() => setFilter('tutti')}>Tutti</button>
        <button className={filter === 'seguiti' ? '' : 'alt'} onClick={() => setFilter('seguiti')}>Seguiti</button>
        <Link href="/utenti" prefetch><button className="alt">Cerca persone</button></Link>
      </div>
      {user && !banned && !muted && (
        <div className="card">
          <textarea value={text} onChange={e => setText(e.target.value.slice(0, 500))} rows={3} placeholder="Cosa succede nel campionato?"
            style={{ width: '100%', font: 'inherit', padding: 10, borderRadius: 10, border: '1px solid var(--line)' }} />
          <p className="sub small">{text.length}/500</p>
          <input placeholder="Foto URL (opzionale)" value={img} onChange={e => setImg(e.target.value)} />
          <input placeholder="Video URL (opzionale)" value={vid} onChange={e => setVid(e.target.value)} />
          <input placeholder="Link (opzionale https://...)" value={lnk} onChange={e => setLnk(e.target.value)} />
          <div className="row"><button onClick={pubblica}>Pubblica</button></div>
          {msg && <p className="msg">{msg}</p>}
        </div>
      )}
      {(banned || muted) && <div className="card"><p className="msg err">{banned ? 'Bannato dalle notizie.' : 'Timeout fino a ' + new Date(myProf.news_muted_until).toLocaleString('it-IT')}</p></div>}

      {posts.map(p => {
        const a = authors[p.author_id]
        const isMine = user && p.author_id === user.id
        const followed = following.has(p.author_id)
        return (
          <article key={p.id} className="card" style={{ padding: 16 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <Link href={`/giocatore/${p.author_id}`} prefetch>
                <div className="big-avatar" style={{ width: 44, height: 44, fontSize: '1.1rem' }}>
                  {a?.avatar_url ? <img src={a.avatar_url} alt="" /> : (a?.display_name || '?')[0]}
                </div>
              </Link>
              <div style={{ minWidth: 0 }}>
                <b>{a?.display_name || '...'}</b>{a?.username && <span className="sub"> @{a.username}</span>}
                <div className="sub small" style={{ margin: 0 }}>{timeAgo(p.created_at)}{p.visibility !== 'public' ? ` · ${p.visibility}` : ''}</div>
              </div>
              {user && !isMine && (
                followed
                  ? <button className="mini alt" style={{ marginLeft: 'auto' }} onClick={() => smetti(p.author_id)}>Seguito</button>
                  : <button className="mini" style={{ marginLeft: 'auto' }} onClick={() => segui(p.author_id)}>Segui</button>
              )}
            </div>
            <p style={{ whiteSpace: 'pre-wrap', margin: '10px 0' }}>{p.text}</p>
            {p.image_url && <img src={p.image_url} alt="" loading="lazy" style={{ width: '100%', borderRadius: 12 }} />}
            {p.video_url && <video src={p.video_url} controls style={{ width: '100%', borderRadius: 12, marginTop: 8 }} />}
            {p.link_url && <a href={p.link_url} target="_blank" rel="noreferrer" style={{ display: 'block', marginTop: 8, color: 'var(--table2)', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis' }}>🔗 {p.link_url}</a>}
            <div style={{ display: 'flex', gap: 14, marginTop: 10, color: 'var(--muted)', fontSize: '.85rem', fontWeight: 700 }}>
              <span>👁 {views[p.id] || 0}</span>
              <Link href={`/giocatore/${p.author_id}`} prefetch style={{ textDecoration: 'none' }}>Profilo →</Link>
            </div>
          </article>
        )
      })}
      {posts.length === 0 && <p className="empty">Nessuna notizia. Sii il primo.</p>}
    </main>
  )
}
