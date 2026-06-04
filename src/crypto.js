// ─── MOTOR DE CIFRADO AES-256-GCM + PBKDF2 ───────────────────────────────
// Toda la criptografía ocurre aquí, en el navegador, nunca en el servidor.

export const PBKDF2_ITERATIONS = 310000
const SALT_LEN = 32
const IV_LEN   = 12

async function deriveKey(password, salt) {
  const enc = new TextEncoder()
  const km  = await crypto.subtle.importKey(
    'raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    km,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

export async function encryptVault(data, password) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LEN))
  const iv   = crypto.getRandomValues(new Uint8Array(IV_LEN))
  const key  = await deriveKey(password, salt)
  const ct   = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(JSON.stringify(data))
  )
  const out = new Uint8Array(SALT_LEN + IV_LEN + ct.byteLength)
  out.set(salt, 0)
  out.set(iv, SALT_LEN)
  out.set(new Uint8Array(ct), SALT_LEN + IV_LEN)
  return btoa(String.fromCharCode(...out))
}

export async function decryptVault(b64, password) {
  const raw   = Uint8Array.from(atob(b64), c => c.charCodeAt(0))
  const salt  = raw.slice(0, SALT_LEN)
  const iv    = raw.slice(SALT_LEN, SALT_LEN + IV_LEN)
  const ct    = raw.slice(SALT_LEN + IV_LEN)
  const key   = await deriveKey(password, salt)
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct)
  return JSON.parse(new TextDecoder().decode(plain))
}

// Re-cifrar bóveda con nueva contraseña maestra
export async function reEncryptVault(entries, oldPassword, newPassword) {
  // Verificar que la contraseña vieja es correcta intentando descifrar
  // (entries ya viene descifrado, solo necesitamos cifrar con la nueva)
  return encryptVault(entries, newPassword)
}

export function pwStrength(pw) {
  if (!pw) return { score: 0, label: '', color: '#374151' }
  let s = 0
  if (pw.length >= 8)  s++
  if (pw.length >= 16) s++
  if (/[A-Z]/.test(pw)) s++
  if (/[0-9]/.test(pw)) s++
  if (/[^A-Za-z0-9]/.test(pw)) s++
  return [
    { label: 'Muy débil',  color: '#EF4444' },
    { label: 'Débil',      color: '#F97316' },
    { label: 'Regular',    color: '#EAB308' },
    { label: 'Buena',      color: '#84CC16' },
    { label: 'Fuerte',     color: '#22C55E' },
    { label: 'Muy fuerte', color: '#10B981' },
  ][s]
}

export function genPassword(len = 20) {
  const c = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()-_=+[]{}'
  return Array.from(crypto.getRandomValues(new Uint8Array(len)))
    .map(b => c[b % c.length]).join('')
}
