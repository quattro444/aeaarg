'use client'
import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

function LoginInner() {
  const params = useSearchParams()
  const router = useRouter()
  const [mode, setMode] = useState(params.get('mode') === 'signup' ? 'signup' : 'login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState('')
  const [bad, setBad] = useState(false)
  const [busy, setBusy] = useState(false)
  const [already, setAlready] = useState(false)

  // se sei già loggato, non restare qui
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setAlready(true)
        setTimeout(() => router.push('/profilo'), 800)
      }
    })
  }, [router])

  useEffect(() => {
    setMode(params.get('mode') === 'signup' ? 'signup' : 'login')
  }, [params])

  async function ensureProfile(user) {
    // crea il profilo se manca (fix per account creati prima del trigger)
    // niente colonna email: profiles ha solo id + role
    const { data } = await supabase.from('profiles').select('id').eq('id', user.id).single()
    if (!data) {
      await supabase.from('profiles').insert({ id: user.id, role: 'user' })
    }
  }

  async function accedi() {
    if (!email || !password) { setBad(true); setMsg('Inserisci email e password.'); return }
    setBusy(true); setMsg('')
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
    if (error) { setBad(true); setMsg('Accesso fallito: ' + error.message); return }
    setBad(false); setMsg('Accesso ok, ti porto al profilo...')
    if (data.user) await ensureProfile(data.user)
    router.push('/profilo')
    router.refresh()
  }

  async function registrati() {
    if (!email || !password) { setBad(true); setMsg('Inserisci email e password.'); return }
    if (password.length < 6) { setBad(true); setMsg('Password troppo corta: minimo 6 caratteri.'); return }
    setBusy(true); setMsg('')
    const { data, error } = await supabase.auth.signUp({ email: email.trim(), password })
    setBusy(false)
    // Supabase non crea doppioni: se l'email esiste già ritorna errore o user vuoto
    if (error) { setBad(true); setMsg('Registrazione fallita: ' + error.message); return }
    if (data.user && data.session == null && data.user.identities?.length === 0) {
      setBad(true); setMsg('Questo account esiste già. Prova ad accedere.'); setMode('login'); return
    }
    setBad(false)
    setMsg(data.session
      ? 'Account creato! Ora scegli il tuo @username.'
      : 'Registrazione fatta. Se serve, controlla la mail di conferma, poi accedi e scegli @username.')
    if (data.user) await ensureProfile(data.user).catch(() => {})
    // vai al profilo: lui mostra onboarding SOLO se manca username (fix loop al rientro)
    if (data.session) { router.push('/profilo'); router.refresh() }
  }

  async function google() {
    setBusy(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/profilo' }
    })
    if (error) { setBusy(false); setBad(true); setMsg('Google: ' + error.message) }
  }

  if (already) return <main className="narrow"><div className="card"><h1>Sei già dentro</h1><p className="sub">Ti porto al profilo...</p></div></main>

  const isSignup = mode === 'signup'

  return (
    <main className="narrow">
      <div className="card">
        <h1>{isSignup ? 'Crea account' : 'Accedi'}</h1>
        <p className="sub">{isSignup ? 'Iscriviti per seguire il campionato.' : 'Entra per gestire squadre e risultati.'}</p>

        <button className="google" onClick={google} disabled={busy}>
          <span className="g">G</span> Continua con Google
        </button>
        <div className="or"><span>oppure con email</span></div>

        <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
        <input type="password" placeholder="Password (min 6)" value={password} onChange={e => setPassword(e.target.value)} autoComplete={isSignup ? 'new-password' : 'current-password'}
          onKeyDown={e => { if (e.key === 'Enter') isSignup ? registrati() : accedi() }} />
        <div className="row">
          {!isSignup
            ? <><button onClick={accedi} disabled={busy}>{busy ? '...' : 'Accedi'}</button><button className="alt" onClick={() => setMode('signup')}>Crea account</button></>
            : <><button onClick={registrati} disabled={busy}>{busy ? '...' : 'Registrati'}</button><button className="alt" onClick={() => setMode('login')}>Ho già un account</button></>
          }
        </div>
        {msg && <p className={'msg' + (bad ? ' err' : '')}>{msg}</p>}
      </div>
    </main>
  )
}

export default function Login() {
  return <Suspense fallback={<main className="narrow"><div className="card"><p className="sub">Caricamento...</p></div></main>}><LoginInner /></Suspense>
}
