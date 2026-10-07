'use client'
import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { supabase } from '../../lib/supabase'

const VOICES = [
  { href: '/', label: 'Classifica', icon: '🏆' },
  { href: '/partite', label: 'Partite', icon: '🏓' },
  { href: '/squadre', label: 'Squadre', icon: '🛡️' },
  { href: '/profilo', label: 'Profilo', icon: '👤', auth: true },
  { href: '/admin', label: 'Admin', icon: '🛠️', staff: true },
]

export default function Navbar() {
  const path = usePathname()
  const [user, setUser] = useState(null)
  const [role, setRole] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false) // dropdown avatar pc
  const [sheet, setSheet] = useState(false) // menu centrale mobile stile PS
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

  useEffect(() => { setSheet(false); setOpen(false) }, [path])

  async function logout() {
    await supabase.auth.signOut()
    setConfirmExit(false); setOpen(false); setSheet(false)
    window.location.href = '/'
  }

  const avatarUrl = user?.user_metadata?.avatar_url || profile?.avatar_url || null
  const initial = (profile?.display_name || user?.email || 'U')[0].toUpperCase()
  const isStaff = role === 'admin' || role === 'moderator'
  const active = h => path === h ? ' active' : ''

  const sheetVoices = VOICES.filter(v => {
    if (v.staff && !isStaff) return false
    if (v.auth && !user) return false
    return true
  })

  return (
    <>
    <header className="top"><div className="top-in">
      <Link className="brand" href="/" prefetch><i />Campionato Ping Pong</Link>
      <nav className="desk">
        <Link href="/" prefetch className={active('/')}>Classifica</Link>
        <Link href="/partite" prefetch className={active('/partite')}>Partite</Link>
        <Link href="/squadre" prefetch className={active('/squadre')}>Squadre</Link>
        {loading ? null : user ? (
          <>
            {isStaff && <Link href="/admin" prefetch className={active('/admin')}>Admin</Link>}
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
            <Link href="/login" prefetch className={active('/login')}>Accedi</Link>
            <Link href="/login?mode=signup" prefetch className="cta">Crea account</Link>
          </>
        )}
      </nav>
      {/* avatar rapido su mobile in alto a destra */}
      <div className="mob-avatar">
        {user
          ? <Link href="/profilo" prefetch className="avatar sm">{avatarUrl ? <img src={avatarUrl} alt="" /> : initial}</Link>
          : <Link href="/login" prefetch className="cta sm">Accedi</Link>}
      </div>
    </div>
    </header>

    {/* Bottom bar stile PlayStation solo mobile */}
    <nav className="psbar">
      <Link href="/" prefetch className={'ps-item' + active('/')}><span>🏆</span><small>Classifica</small></Link>
      <Link href="/partite" prefetch className={'ps-item' + active('/partite')}><span>🏓</span><small>Partite</small></Link>
      <button className="ps-fab" onClick={() => setSheet(true)} aria-label="Menu">＋</button>
      <Link href="/squadre" prefetch className={'ps-item' + active('/squadre')}><span>🛡️</span><small>Squadre</small></Link>
      {user
        ? <Link href="/profilo" prefetch className={'ps-item' + active('/profilo')}><span>👤</span><small>Profilo</small></Link>
        : <Link href="/login" prefetch className={'ps-item' + active('/login')}><span>🔑</span><small>Accedi</small></Link>}
    </nav>

    {sheet && (
      <div className="sheet-bg" onClick={() => setSheet(false)}>
        <div className="sheet" onClick={e => e.stopPropagation()}>
          <div className="sheet-handle" />
          <h2>Tutto il campionato</h2>
          <div className="sheet-grid">
            {sheetVoices.map(v => (
              <Link key={v.href} href={v.href} prefetch className="sheet-cell" onClick={() => setSheet(false)}>
                <span className="sheet-icon">{v.icon}</span><b>{v.label}</b>
              </Link>
            ))}
            {!user && <Link href="/login?mode=signup" prefetch className="sheet-cell" onClick={() => setSheet(false)}><span className="sheet-icon">✨</span><b>Crea account</b></Link>}
            {user && <button className="sheet-cell danger" onClick={() => { setSheet(false); setConfirmExit(true) }}><span className="sheet-icon">🚪</span><b>Esci</b></button>}
          </div>
          <button className="alt sheet-close" onClick={() => setSheet(false)}>Chiudi</button>
        </div>
      </div>
    )}

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
    </>
  )
}
