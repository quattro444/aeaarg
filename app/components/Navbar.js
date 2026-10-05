'use client'
import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { supabase } from '../../lib/supabase'

export default function Navbar() {
  const [user, setUser] = useState(null)
  const [role, setRole] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [confirmExit, setConfirmExit] = useState(false)
  const menuRef = useRef(null)

  async function refresh() {
    const { data: { session } } = await supabase.auth.getSession()
    const u = session?.user || null
    setUser(u)
    if (u) {
      const { data } = await supabase.from('profiles').select('role, display_name, avatar_url').eq('id', u.id).single()
      if (!data) {
        await supabase.from('profiles').insert({ id: u.id, role: 'user' })
        setRole('user')
      } else {
        setRole(data.role)
        setProfile(data)
      }
    } else {
      setRole(null); setProfile(null)
    }
    setLoading(false)
  }

  useEffect(() => {
    refresh()
    const { data: sub } = supabase.auth.onAuthStateChange(() => refresh())
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    function close(e) { if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [])

  async function logout() {
    await supabase.auth.signOut()
    setConfirmExit(false); setOpen(false)
    window.location.href = '/'
  }

  const avatarUrl = user?.user_metadata?.avatar_url || profile?.avatar_url || null
  const initial = (profile?.display_name || user?.email || 'U')[0].toUpperCase()

  return (
    <header className="top"><div className="top-in">
      <Link className="brand" href="/" prefetch><i />Campionato Ping Pong</Link>
      <nav>
        <Link href="/" prefetch>Classifica</Link>
        <Link href="/partite" prefetch>Partite</Link>
        <Link href="/squadre" prefetch>Squadre</Link>
        {loading ? null : user ? (
          <>
            {(role === 'admin' || role === 'moderator') && <Link href="/admin" prefetch>Admin</Link>}
            <div className="avatar-wrap" ref={menuRef}>
              <button className="avatar" onClick={() => setOpen(!open)} title={user.email}>
                {avatarUrl ? <img src={avatarUrl} alt="profilo" /> : initial}
              </button>
              {open && (
                <div className="menu">
                  <div className="menu-head">{profile?.display_name || user.email}</div>
                  <Link href="/profilo" prefetch onClick={() => setOpen(false)}>Vedi tuo profilo</Link>
                  {profile && <Link href={`/giocatore/${user.id}`} prefetch onClick={() => setOpen(false)}>Come ti vedono gli altri</Link>}
                  <button className="menu-danger" onClick={() => { setOpen(false); setConfirmExit(true) }}>Esci</button>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <Link href="/login" prefetch>Accedi</Link>
            <Link href="/login?mode=signup" prefetch className="cta">Crea account</Link>
          </>
        )}
      </nav>
    </div>
    {confirmExit && (
      <div className="modal-bg" onClick={() => setConfirmExit(false)}>
        <div className="modal" onClick={e => e.stopPropagation()}>
          <h2>Sei sicuro?</h2>
          <p className="sub">Vuoi uscire dall'account {user?.email}?</p>
          <div className="row">
            <button onClick={logout}>Sì, esci</button>
            <button className="alt" onClick={() => setConfirmExit(false)}>Annulla</button>
          </div>
        </div>
      </div>
    )}
    </header>
  )
}
