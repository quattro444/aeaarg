'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '../../lib/supabase'

function getTheme() {
  if (typeof window === 'undefined') return 'auto'
  return localStorage.getItem('ppp-theme') || 'auto'
}
function applyTheme(v) {
  const root = document.documentElement
  if (v === 'auto') {
    const dark = window.matchMedia('(prefers-color-scheme: dark)').matches
    root.setAttribute('data-theme', dark ? 'dark' : 'light')
    return
  }
  root.setAttribute('data-theme', v === 'notte' ? 'dark' : 'light')
}

export default function Impostazioni() {
  const router = useRouter()
  const [theme, setTheme] = useState('auto')
  const [user, setUser] = useState(null)

  useEffect(() => {
    setTheme(getTheme())
    applyTheme(getTheme())
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) router.push('/login')
      else setUser(session.user)
    })
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const fn = () => { if (getTheme() === 'auto') applyTheme('auto') }
    mq.addEventListener('change', fn)
    return () => mq.removeEventListener('change', fn)
  }, [router])

  function set(v) {
    localStorage.setItem('ppp-theme', v)
    setTheme(v)
    applyTheme(v)
  }

  async function logout() {
    if (!confirm('Uscire?')) return
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <main className="narrow" style={{ maxWidth: 560 }}>
      <h1>Impostazioni</h1>
      <p className="sub">Account e aspetto. Il tema segue anche il telefono.</p>
      <div className="card">
        <h2>Aspetto</h2>
        <div className="seg">
          {['chiaro', 'notte', 'auto'].map(v => (
            <button key={v} className={(theme === v || (theme === 'auto' && v === 'auto')) ? 'on' : 'alt'}
              onClick={() => set(v)}>{v === 'chiaro' ? '☀️ Chiaro' : v === 'notte' ? '🌙 Notte' : '📱 Auto'}</button>
          ))}
        </div>
        <p className="sub small" style={{ marginTop: 8 }}>Auto = segue notte/giorno del telefono.</p>
      </div>
      <div className="card">
        <h2>Account</h2>
        <p className="sub">{user?.email}</p>
        <div className="row">
          <Link href="/profilo" prefetch><button>Modifica profilo</button></Link>
          {user && <Link href={`/giocatore/${user.id}`} prefetch><button className="alt">Vedi pubblico</button></Link>}
          <button className="alt" onClick={logout}>Esci</button>
        </div>
      </div>
    </main>
  )
}
