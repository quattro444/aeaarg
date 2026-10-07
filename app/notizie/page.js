'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../../lib/supabase'

function timeAgo(iso) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000
  if (s < 60) return 'ora'
  if (s < 3600) return Math.floor(s / 60) + ' min'
  if (s < 86400) return Math.floor(s / 3600) + ' h'
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
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState('')
  const [isVideo, setIsVideo] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [q, setQ] = useState('')
  const [msg, setMsg] = useState('')
  const [filter, setFilter] = useState('tutti')

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
    const { data: p } = await supabase.from('posts').select('*').order('created_at', { ascending: false }).limit(50)
    let list = (p || []).filter(x => x.visibility !== 'hidden')
    if (filter === 'seguiti' && u) list = list.filter(x => x.author_id === u.id || following.has(x.author_id))
    if (q.trim()) {
      const v = q.trim().toLowerCase()
      list = list.filter(x => x.text.toLowerCase().includes(v))
    }
    setPosts(list)
    if (list.length) {
      const ids = [...new Set(list.map(x => x.author_id))]
      const { data: profs } = await supabase.from('profiles').select('id,display_name,username,avatar_url').in('id', ids)
      const m = {}
      ;(profs || []).forEach(a => { m[a.id] = a })
      setAuthors(m)
      const { data: v } = await supabase.from('post_views').select('post_id').in('post_id', list.map(x => x.id))
      const c = {}
      ;(v || []).forEach(r => { c[r.post_id] = (c[r.post_id] || 0) + 1 })
      setViews(c)
      if (u) {
        for (const post of list) {
          await supabase.from('post_views').upsert(
            { post_id: post.id, viewer_id: u.id },
            { onConflict: 'post_id,viewer_id', ignoreDuplicates: true }
          )
        }
      }
    } else { setAuthors({}); setViews({}) }
  }

  useEffect(() => { load() }, [filter])
  useEffect(() => { const t = setTimeout(load, 400); return () => clearTimeout(t) }, [q])

  function pick(e) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setIsVideo(f.type.startsWith('video'))
    setPreview(URL.createObjectURL(f))
  }

  async function uploadFile() {
    if (!file) return null
    setUploading(true)
    const path = `${user.id}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    const { error } = await supabase.storage.from('news-media').upload(path, file, { upsert: true })
    setUploading(false)
    if (error) { setMsg('Upload fallito (MIGRAZIONE7.sql?): ' + error.message); return null }
    return supabase.storage.from('news-media').getPublicUrl(path).data.publicUrl
  }

  const muted = myProf && myProf.news_muted_until && new Date(myProf.news_muted_until) > new Date()
  const banned = myProf && myProf.news_banned

  async function pubblica() {
    setMsg('')
    if (!user) { setMsg('Accedi per pubblicare.'); return }
    if (banned || muted) { setMsg('Non puoi pubblicare al momento.'); return }
    if (!text.trim() && !file) { setMsg('Scrivi o allega qualcosa.'); return }
    let url = null
    if (file) { url = await uploadFile(); if (!url && file) return }
    const { error } = await supabase.from('posts').insert({
      author_id: user.id, text: (text.trim() || '(media)').slice(0, 500),
      image_url: url && !isVideo ? url : null,
      video_url: url && isVideo ? url : null,
      visibility: 'public',
    })
    if (error) { setMsg('Bloccato: ' + error.message); return }
    setText(''); setFile(null); setPreview('')
    load()
  }

  async function segui(id, on) {
    if (!user) return
    if (on) await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', id)
    else await supabase.from('follows').insert({ follower_id: user.id, following_id: id })
    load()
  }

  return (
    <main style={{ maxWidth: 600 }}>
      <h1>Notizie</h1>
      <p className="sub">Dal campo, in tempo reale.</p>
      {/* ricerca stile Instagram: diretta, senza bottoni */}
      <div className="card" style={{ padding: 12 }}>
        <input placeholder="🔍 Cerca notizie o vai alle persone..." value={q} onChange={e => setQ(e.target.value)}
          style={{ maxWidth: 'none', borderRadius: 999, background: 'var(--bg)' }} />
        <div className="row" style={{ marginTop: 8 }}>
          <button className={filter === 'tutti' ? '' : 'alt'} onClick={() => setFilter('tutti')}>Tutti</button>
          <button className={filter === 'seguiti' ? '' : 'alt'} onClick={() => setFilter('seguiti')}>Seguiti</button>
          <Link href="/utenti" prefetch className="sub small" style={{ marginLeft: 'auto', alignSelf: 'center' }}>Trova persone →</Link>
        </div>
      </div>

      {user && !banned && !muted && (
        <div className="card">
          <div style={{ display: 'flex', gap: 10 }}>
            <div className="big-avatar" style={{ width: 44, height: 44 }}>{myProf?.avatar_url ? <img src={myProf.avatar_url} alt="" /> : (myProf?.display_name || '?')[0]}</div>
            <textarea value={text} onChange={e => setText(e.target.value.slice(0, 500))} rows={2} placeholder="Racconta la partita..."
              style={{ flex: 1, font: 'inherit', padding: 12, borderRadius: 14, border: '1px solid var(--line)' }} />
          </div>
          {preview && (isVideo
            ? <video src={preview} controls style={{ width: '100%', borderRadius: 14, marginTop: 10 }} />
            : <img src={preview} alt="" style={{ width: '100%', borderRadius: 14, marginTop: 10 }} />)}
          <div className="row">
            <label style={{ border: '1px solid var(--line)', borderRadius: 12, padding: '10px 16px', fontWeight: 800, cursor: 'pointer', background: '#fff' }}>
              📎 Foto/Video
              <input type="file" accept="image/*,video/*" style={{ display: 'none' }} onChange={pick} />
            </label>
            <button onClick={pubblica} disabled={uploading}>{uploading ? 'Carico...' : 'Pubblica'}</button>
          </div>
          {msg && <p className="msg">{msg}</p>}
        </div>
      )}

      {posts.map(p => {
        const a = authors[p.author_id]
        return (
          <article key={p.id} className="card post">
            <div className="post-head">
              <Link href={`/giocatore/${p.author_id}`} prefetch>
                <div className="big-avatar" style={{ width: 46, height: 46 }}>{a?.avatar_url ? <img src={a.avatar_url} alt="" /> : (a?.display_name || '?')[0]}</div>
              </Link>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div><b>{a?.display_name || '...'}</b>{a?.username && <span className="handle"> @{a.username}</span>}</div>
                <div className="sub small" style={{ margin: 0 }}>{timeAgo(p.created_at)}</div>
              </div>
              {user && user.id !== p.author_id && (
                following.has(p.author_id)
                  ? <button className="mini alt" onClick={() => segui(p.author_id, true)}>Seguito</button>
                  : <button className="mini" onClick={() => segui(p.author_id, false)}>Segui</button>
              )}
            </div>
            <p className="post-text">{p.text}</p>
            {p.image_url && <img src={p.image_url} alt="" loading="lazy" className="post-media" />}
            {p.video_url && <video src={p.video_url} controls className="post-media" />}
            {p.link_url && <a href={p.link_url} target="_blank" rel="noreferrer" className="post-link">🔗 {p.link_url}</a>}
            <div className="post-foot"><span>👁 {views[p.id] || 0}</span></div>
          </article>
        )
      })}
      {posts.length === 0 && <p className="empty">Niente qui. Pubblica la prima.</p>}
    </main>
  )
}
