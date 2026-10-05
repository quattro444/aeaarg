// Calcolo classifica LIVE da proposte approvate (fix: prima leggeva solo la vista `standings`
// che non si aggiornava perché le approvazioni finivano in match_proposals, non in matches).
// Pro: zero trigger DB, ricalcolo istantaneo, admin può correggere/eliminare e tutto si aggiorna.
// Contro: se un giorno userai `matches` diretto, dovrai unire le due fonti (lasciato fallback sotto).
export function computeStandings(teamList, approved, pointsWin = 2, pointsLoss = 0) {
  const m = {}
  teamList.forEach(t => {
    m[t.id] = {
      team_id: t.id, team_name: t.name, played: 0, wins: 0, losses: 0,
      draws: 0, sets_diff: 0, points_diff: 0, league_points: 0,
    }
  })
  approved.forEach(p => {
    const a = m[p.team_a_id], b = m[p.team_b_id]
    if (!a || !b) return
    const sa = Number(p.score_a), sb = Number(p.score_b)
    if (!Number.isFinite(sa) || !Number.isFinite(sb)) return
    a.played++; b.played++
    // differenza punti = scarto totale (21-18 => +3 / -3). Set: chi vince prende +1/-1 (semplice, in attesa di set reali).
    a.points_diff += sa - sb
    b.points_diff += sb - sa
    if (sa === sb) { // pareggio (raro nel ping pong, ma gestito: b serve ad a per non rompere il conto)
      a.draws++; b.draws++
      a.league_points += 1; b.league_points += 1
      return
    }
    const w = sa > sb ? a : b
    const l = sa > sb ? b : a
    w.wins++; l.losses++
    w.sets_diff += 1; l.sets_diff -= 1
    w.league_points += pointsWin; l.league_points += pointsLoss
  })
  return Object.values(m).sort((x, y) =>
    y.league_points - x.league_points || y.sets_diff - x.sets_diff || y.points_diff - x.points_diff
  )
}

export function cleanUsername(v) {
  return (v || '').toLowerCase().replace(/^@/, '').replace(/[^a-z0-9_.]/g, '').slice(0, 20)
}
