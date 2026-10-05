// Solo questa mail ha accesso speciale super-admin (gestione admin/moderatori).
// Pro: semplice e a prova di RLS (controllo anche lato SQL via auth.jwt email).
// Contro: se cambi mail devi aggiornare qui + MIGRAZIONE4.sql.
export const SUPERADMIN_EMAIL = 'capostrada1@gmail.com'

export function isSuperadmin(email) {
  return (email || '').toLowerCase() === SUPERADMIN_EMAIL.toLowerCase()
}
export function isAdmin(role, email) {
  return role === 'admin' || isSuperadmin(email)
}
export function canModerate(role, email) {
  // moderatore futuro notizie: approva risultati + news, ma non tocca squadre/ruoli
  return role === 'admin' || role === 'moderator' || isSuperadmin(email)
}
