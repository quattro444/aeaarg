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

function PostCard({ p, author, views, user, followed, onFollow, refresh }) {
  const [likes, setLikes] = useState(0)
  const [dislikes, setDislikes] = useState(0)
  const [mine, setMine] = useState(0)
  const [comments, setComments] = useState([])
  const [cAuthors, setCAuthors] = useState({})
  const [openC, setOpenC] = useState(false)
  const [ctext, setCtext] = useState('')
  const [shared, setShared] = useState(false)

  async function loadSocial() {
    const { data: r } = await supabase.from('post_reactions').select('value,user_id').eq('post_id', p.id)
    setLikes((r || []).filter(x => x.value === 1).length)
    setDislikes((r || []).filter(x => x.value === -1).length)
    if (user) setMine((r || []).find(x => x.user_id === user.id)?.value || 0)
    const { data: c } = await supabase.from('post_comments').select('*').eq('post_id', p.id).order('created_at', { ascending: true }).limit(50)
    setComments(c || [])
    if (c && c.length) {
      const ids = [...new Set(c.map(x => x.author_id))]
      const { data: pr } = await supabase.from('profiles').select('id,display_name,username,avatar_url').in('id', ids)
      const m = {}
      ;(pr || []).forEach(a => { m[a.id] = a })
      setCAuthors(m)
    }
  }
  useEffect(() => { loadSocial() }, [p.id])

  async function react(v) {
    if (!user) return
    if (mine === v) {
      await supabase.from('post_reactions').delete().eq('post_id', p.id).eq('user_id', user.id)
    } else {
      await supabase.from('post_reactions').upsert(
        { post_id: p.id, user_id: user.id, value: v },
        { onConflict: 'post_id,user_id' }
      )
    }
    loadSocial()
  }

  async function sendComment() {
    if (!user || !ctext.trim()) return
    const { error } = await supabase.from('post_comments').insert({
      post_id: p.id, author_id: user.id, text: ctext.trim().slice(0, 300),
    })
    if (!error) { setCtext(''); loadSocial() }
  }

  async function delComment(id, authorId) {
    if (!confirm('Eliminare il commento?')) return
    await supabase.from('post_comments').delete().eq('id', id)
    loadSocial()
  }

  async function share() {
    const url = window.location.origin + '/notizie#' + p.id
    try {
      if (navigator.share) { await navigator.share({ title: 'Pistoia Ping Pong', text: p.text.slice(0, 100), url }) }
      else { await navigator.clipboard.writeText(url); setShared(true); setTimeout(() => setShared(false), 1500) }
    } catch (e) {
      try { await navigator.clipboard.writeText(url); setShared(true); setTimeout(() => setShared(false), 1500) } catch (_) {}
    }
  }

  const isMine = user && p.author_id === user.id

  return (
    <article id={p.id} className="card post">
      <div className="post-head">
        <Link href={`/giocatore/${p.author_id}`} prefetch>
          <div className="big-avatar" style={{ width: 46, height: 46 }}>{author?.avatar_url ? <img src={author.avatar_url} alt="" /> : (author?.display_name || '?')[0]}</div>
        </Link>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div><b>{author?.display_name || '...'}</b>{author?.username && <span className="handle"> @{author.username}</span>}</div>
          <div className="sub small" style={{ margin: 0 }}>{timeAgo(p.created_at)}</div>
        </div>
        {user && !isMine && (
          followed
            ? <button className="mini alt" onClick={() => onFollow(p.author_id, true)}>Seguito</button>
            : <button className="mini" onClick={() => onFollow(p.author_id, false)}>Segui</button>
        )}
      </div>
      <p className="post-text">{p.text}</p>
      {p.image_url && <img src={p.image_url} alt="" loading="lazy" className="post-media" />}
      {p.video_url && <video src={p.video_url} controls className="post-media" />}
      {p.link_url && <a href={p.link_url} target="_blank" rel="noreferrer" className="post-link">🔗 {p.link_url}</a>}
      <div className="post-actions">
        <button className={'react' + (mine === 1 ? ' on-like' : '')} onClick={() => react(1)}>👍 {likes}</button>
        <button className={'react' + (mine === -1 ? ' on-dis' : '')} onClick={() => react(-1)}>👎 {dislikes}</button>
        <button className="react" onClick={() => setOpenC(!openC)}>💬 {comments.length}</button>
        <button className="react" onClick={share}>↗ {shared ? 'Copiato!' : 'Condividi'}</button>
        <span style={{ marginLeft: 'auto', color: 'var(--muted)', fontSize: '.8rem', fontWeight: 700 }}>👁 {views}</span>
      </div>
      {openC && (
        <div style={{ marginTop: 10, borderTop: '1px solid var(--line)', paddingTop: 10 }}>
          {comments.map(c => {
            const a = cAuthors[c.author_id]
            const canDel = user && (c.author_id === user.id)
            return (
              <div key={c.id} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <div className="big-avatar" style={{ width: 30, height: 30, fontSize: '.9rem' }}>{a?.avatar_url ? <img src={a.avatar_url} alt="" /> : (a?.display_name || '?')[0]}</div>
                <div style={{ flex: 1, background: 'var(--bg)', borderRadius: 12, padding: '6px 10px' }}>
                  <b style={{ fontSize: '.85rem' }}>{a?.display_name || '...'}</b>{a?.username && <span className="handle" style={{ fontSize: '.8rem' }}> @{a.username}</span>}
                  <div>{c.text}</div>
                </div>
                {canDel && <button className="mini danger" onClick={() => delComment(c.id)}>✕</button>}
              </div>
            )
          })}
          {user && (
            <div style={{ display: 'flex', gap: 8 }}>
              <input placeholder="Scrivi un commento..." value={ctext} onChange={e => setCtext(e.target.value.slice(0, 300))}
                onKeyDown={e => { if (e.key === 'Enter') sendComment() }} style={{ flex: 1 }} />
              <button onClick={sendComment}>Invia</button>
            </div>
          )}
        </div>
      )}
    </article>
  )
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
    if (filter === 'seguiti' && u) {
      const fw = new Set((await supabase.from('follows').select('following_id').eq('follower_id', u.id).then(r => r.data || [])).map(x => x.following_id))
      list = list.filter(x => x.author_id === u.id || fw.has(x.author_id))
    }
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

  async function segui(id, off) {
    if (!user) return
    if (off) await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', id)
    else await supabase.from('follows').insert({ follower_id: user.id, following_id: id })
    load()
  }

  return (
    <main style={{ maxWidth: 600 }}>
      <h1>Notizie</h1>
      <p className="sub">Dal campo, in tempo reale.</p>
      <div className="card" style={{ padding: 12 }}>
        <input placeholder="🔍 Cerca notizie..." value={q} onChange={e => setQ(e.target.value)}
          style={{ maxWidth: 'none', borderRadius: 999, background: 'var(--bg)' }} />
        <div className="row" style={{ marginTop: 8 }}>
          <button className={filter === 'tutti' ? '' : 'alt'} onClick={() => setFilter('tutti')}>Tutti</button>
          <button className={filter === 'seguiti' ? '' : 'alt'} onClick={() => setFilter('seguiti')}>Seguiti</button>
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

      {posts.map(p => (
        <PostCard key={p.id} p={p} author={authors[p.author_id]} views={views[p.id] || 0}
          user={user} followed={following.has(p.author_id)} onFollow={segui} refresh={load} />
      ))}
      {posts.length === 0 && <p className="empty">Niente qui. Pubblica la prima.</p>}
    </main>
  )
}
