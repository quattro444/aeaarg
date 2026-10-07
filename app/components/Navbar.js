'use client'
import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { supabase } from '../../lib/supabase'

const VOICES = [
  { href: '/', label: 'Classifica', icon: '🏆' },
  { href: '/partite', label: 'Partite', icon: '🏓' },
  { href: '/squadre', label: 'Squadre', icon: '🛡️' },
  { href: '/notizie', label: 'Notizie', icon: '📰' },
  { href: '/utenti', label: 'Persone', icon: '🔍' },
  { href: '/profilo', label: 'Profilo', icon: '👤', auth: true },
  { href: '/impostazioni', label: 'Impostazioni', icon: '⚙️', auth: true },
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
      <Link className="brand" href="/" prefetch><i />Pistoia Ping Pong</Link>
      <nav className="desk">
        <Link href="/" prefetch className={active('/')}>Classifica</Link>
        <Link href="/partite" prefetch className={active('/partite')}>Partite</Link>
        <Link href="/squadre" prefetch className={active('/squadre')}>Squadre</Link>
        <Link href="/notizie" prefetch className={active('/notizie')}>Notizie</Link>
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

    {/* Bottom: SOLO il + centrale, tutto il resto solo nel cerchio */}
    <nav className="psbar solo">
      <button className={'ps-fab' + (sheet ? ' open' : '')} onClick={() => setSheet(!sheet)} aria-label="Menu">{sheet ? '✕' : '＋'}</button>
    </nav>

    {sheet && (
      <div className="radial-bg" onClick={() => setSheet(false)}>
        <div className="radial-center" onClick={e => e.stopPropagation()}>
          {(() => {
            const items = [...sheetVoices]
            if (!user) items.push({ href: '/login?mode=signup', label: 'Crea', icon: '✨' })
            const R = 120
            return items.map((v, i) => {
              const a = (-90 + (360 / items.length) * i) * (Math.PI / 180)
              const x = Math.cos(a) * R, y = Math.sin(a) * R
              return (
                <Link key={v.href + v.label} href={v.href} prefetch
                  className="radial-item" style={{ transform: `translate(${x}px,${y}px)`, animationDelay: `${i * 45}ms` }}
                  onClick={() => setSheet(false)} title={v.label}>
                  <span>{v.icon}</span><small>{v.label}</small>
                </Link>
              )
            })
          })()}
          <button className="ps-fab big" onClick={() => setSheet(false)} aria-label="Chiudi">✕</button>
          {user && <button className="radial-exit" onClick={() => { setSheet(false); setConfirmExit(true) }}>Esci</button>}
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
