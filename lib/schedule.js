// Round-robin circle method.
// Pro: ogni squadra gioca 1 volta per turno, mai 2 volte lo stesso giorno se assegni 1 turno per slot.
// Contro: con dispari serve turno di riposo (bye) — lo saltiamo, quindi un turno ha una squadra ferma.
export function roundRobin(teamIds) {
  const ids = [...teamIds]
  if (ids.length < 2) return []
  const odd = ids.length % 2 === 1
  if (odd) ids.push(null) // bye
  const n = ids.length
  const rounds = []
  const arr = [...ids]
  for (let r = 0; r < n - 1; r++) {
    const pairs = []
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i], b = arr[n - 1 - i]
      if (a && b) {
        // alterna casa/trasferta per equità (b serve ad a: evita sempre stessa "casa")
        if (r % 2 === 0) pairs.push([a, b]); else pairs.push([b, a])
      }
    }
    rounds.push(pairs)
    arr.splice(1, 0, arr.pop())
  }
  return rounds
}

// Distribuisce le coppie sui giorni disponibili a partire da startDate + orario.
// days: array 0-6 (0=dom). time: "19:00". maxPerDay: quante partite per giorno (default 10 = tutte).
// Ritorna [{round, home, away, scheduled_at}]
export function planDates(rounds, { startDate, days, time, maxPerDay = 10 }) {
  const [hh, mm] = (time || '19:00').split(':').map(Number)
  const out = []
  let d = new Date(startDate + 'T12:00:00')
  let queue = rounds.flatMap((pairs, ri) => pairs.map(([h, a]) => ({ round: ri + 1, home: h, away: a })))
  let qi = 0
  // sicurezza: max 365 iterazioni (b serve ad a: evita loop infinito se days vuoto — validato prima)
  for (let iter = 0; iter < 365 && qi < queue.length; iter++) {
    d.setDate(d.getDate() + (iter === 0 ? 0 : 1))
    if (!days.includes(d.getDay())) continue
    let n = 0
    while (qi < queue.length && n < maxPerDay) {
      const g = queue[qi++]
      const dt = new Date(d)
      dt.setHours(hh || 19, mm || 0, 0, 0)
      out.push({ ...g, scheduled_at: dt.toISOString() })
      n++
    }
  }
  return out
}
