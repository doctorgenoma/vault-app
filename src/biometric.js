// ─── BIOMETRÍA: WebAuthn + PIN de 6 dígitos ───────────────────────────────
// La contraseña maestra NUNCA se guarda en claro.
// Se cifra con la clave de WebAuthn o con una clave derivada del PIN.

const BIOMETRIC_KEY   = 'vlt_bio_cred'    // credencial WebAuthn
const PIN_KEY         = 'vlt_pin_enc'     // contraseña maestra cifrada con PIN
const BIO_ENC_KEY     = 'vlt_bio_enc'     // contraseña maestra cifrada con WebAuthn
const PIN_FAILS_KEY   = 'vlt_pin_fails'   // intentos fallidos
const PIN_LOCK_KEY    = 'vlt_pin_lock'    // timestamp de bloqueo
const QUICK_MODE_KEY  = 'vlt_quick_mode'  // 'biometric' | 'pin' | 'none'

const MAX_PIN_FAILS   = 5
const PIN_LOCK_MS     = 5 * 60 * 1000    // 5 minutos

// ─── HELPERS AES para cifrar/descifrar la contraseña maestra ──────────────

async function aesEncrypt(plaintext, keyBytes) {
  const iv  = crypto.getRandomValues(new Uint8Array(12))
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['encrypt'])
  const ct  = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plaintext))
  const out = new Uint8Array(12 + ct.byteLength)
  out.set(iv, 0)
  out.set(new Uint8Array(ct), 12)
  return btoa(String.fromCharCode(...out))
}

async function aesDecrypt(b64, keyBytes) {
  const raw = Uint8Array.from(atob(b64), c => c.charCodeAt(0))
  const iv  = raw.slice(0, 12)
  const ct  = raw.slice(12)
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['decrypt'])
  const pt  = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct)
  return new TextDecoder().decode(pt)
}

// Derivar 32 bytes desde PIN usando PBKDF2
async function pinToKey(pin, saltB64) {
  const salt = saltB64
    ? Uint8Array.from(atob(saltB64), c => c.charCodeAt(0))
    : crypto.getRandomValues(new Uint8Array(16))
  const km  = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveKey'])
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    km, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']
  )
  const raw = await crypto.subtle.exportKey('raw', key)
  return { keyBytes: new Uint8Array(raw), saltB64: btoa(String.fromCharCode(...salt)) }
}

// ─── ESTADO ───────────────────────────────────────────────────────────────

export function getQuickMode() {
  return localStorage.getItem(QUICK_MODE_KEY) || 'none'
}

export function clearQuickUnlock() {
  localStorage.removeItem(BIOMETRIC_KEY)
  localStorage.removeItem(PIN_KEY)
  localStorage.removeItem(BIO_ENC_KEY)
  localStorage.removeItem(PIN_FAILS_KEY)
  localStorage.removeItem(PIN_LOCK_KEY)
  localStorage.setItem(QUICK_MODE_KEY, 'none')
}

// ─── PIN ──────────────────────────────────────────────────────────────────

export async function setupPIN(pin, masterPassword) {
  const { keyBytes, saltB64 } = await pinToKey(pin)
  const encrypted = await aesEncrypt(masterPassword, keyBytes)
  localStorage.setItem(PIN_KEY, JSON.stringify({ enc: encrypted, salt: saltB64 }))
  localStorage.setItem(QUICK_MODE_KEY, 'pin')
  localStorage.removeItem(PIN_FAILS_KEY)
  localStorage.removeItem(PIN_LOCK_KEY)
}

export async function unlockWithPIN(pin) {
  // Comprobar bloqueo por intentos
  const lockUntil = parseInt(localStorage.getItem(PIN_LOCK_KEY) || '0')
  if (Date.now() < lockUntil) {
    const secsLeft = Math.ceil((lockUntil - Date.now()) / 1000)
    throw new Error(`PIN bloqueado. Espera ${secsLeft} segundos.`)
  }

  const stored = localStorage.getItem(PIN_KEY)
  if (!stored) throw new Error('PIN no configurado')

  const { enc, salt } = JSON.parse(stored)
  try {
    const { keyBytes } = await pinToKey(pin, salt)
    const masterPassword = await aesDecrypt(enc, keyBytes)
    // Éxito — resetear intentos
    localStorage.removeItem(PIN_FAILS_KEY)
    localStorage.removeItem(PIN_LOCK_KEY)
    return masterPassword
  } catch {
    // Fallo — incrementar contador
    const fails = parseInt(localStorage.getItem(PIN_FAILS_KEY) || '0') + 1
    localStorage.setItem(PIN_FAILS_KEY, fails.toString())
    if (fails >= MAX_PIN_FAILS) {
      localStorage.setItem(PIN_LOCK_KEY, (Date.now() + PIN_LOCK_MS).toString())
      localStorage.removeItem(PIN_FAILS_KEY)
      throw new Error(`Demasiados intentos. PIN bloqueado 5 minutos.`)
    }
    throw new Error(`PIN incorrecto. ${MAX_PIN_FAILS - fails} intentos restantes.`)
  }
}

export function getPINFailsLeft() {
  const fails = parseInt(localStorage.getItem(PIN_FAILS_KEY) || '0')
  return MAX_PIN_FAILS - fails
}

export function getPINLockSecsLeft() {
  const lockUntil = parseInt(localStorage.getItem(PIN_LOCK_KEY) || '0')
  if (Date.now() < lockUntil) return Math.ceil((lockUntil - Date.now()) / 1000)
  return 0
}

// ─── WEBAUTHN / BIOMETRÍA ─────────────────────────────────────────────────

export function isBiometricAvailable() {
  return !!(window.PublicKeyCredential &&
    typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function')
}

export async function checkBiometricSupport() {
  if (!isBiometricAvailable()) return false
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch {
    return false
  }
}

// Registrar biometría y cifrar la contraseña maestra con ella
export async function setupBiometric(masterPassword, userEmail) {
  if (!isBiometricAvailable()) throw new Error('Biometría no disponible')

  // Generar un challenge aleatorio
  const challenge = crypto.getRandomValues(new Uint8Array(32))
  const userId    = crypto.getRandomValues(new Uint8Array(16))

  const credential = await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: 'VAULT App', id: window.location.hostname },
      user: {
        id: userId,
        name: userEmail || 'vault-user',
        displayName: 'VAULT',
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7  },  // ES256
        { type: 'public-key', alg: -257 }, // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',  // solo biometría del dispositivo
        userVerification: 'required',
        residentKey: 'preferred',
      },
      timeout: 60000,
    }
  })

  if (!credential) throw new Error('No se pudo registrar la biometría')

  // Usar el ID de la credencial como material de clave
  const credId    = new Uint8Array(credential.rawId)
  const credIdB64 = btoa(String.fromCharCode(...credId))

  // Derivar clave AES desde el credentialId + un secreto local
  const secret    = crypto.getRandomValues(new Uint8Array(32))
  const secretB64 = btoa(String.fromCharCode(...secret))

  // Clave = HKDF(credId || secret)
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new Uint8Array([...credId, ...secret]),
    'PBKDF2', false, ['deriveKey']
  )
  const aesKey = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: credId, iterations: 10000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']
  )
  const keyBytes  = new Uint8Array(await crypto.subtle.exportKey('raw', aesKey))
  const encrypted = await aesEncrypt(masterPassword, keyBytes)

  // Guardar: credencialId + secreto + contraseña maestra cifrada
  localStorage.setItem(BIOMETRIC_KEY, JSON.stringify({ credId: credIdB64, secret: secretB64 }))
  localStorage.setItem(BIO_ENC_KEY, encrypted)
  localStorage.setItem(QUICK_MODE_KEY, 'biometric')
}

// Desbloquear con biometría
export async function unlockWithBiometric() {
  const stored = localStorage.getItem(BIOMETRIC_KEY)
  const encMPw = localStorage.getItem(BIO_ENC_KEY)
  if (!stored || !encMPw) throw new Error('Biometría no configurada')

  const { credId: credIdB64, secret: secretB64 } = JSON.parse(stored)
  const credId = Uint8Array.from(atob(credIdB64), c => c.charCodeAt(0))
  const secret = Uint8Array.from(atob(secretB64), c => c.charCodeAt(0))

  const challenge = crypto.getRandomValues(new Uint8Array(32))

  // Solicitar verificación biométrica
  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge,
      allowCredentials: [{ type: 'public-key', id: credId, transports: ['internal'] }],
      userVerification: 'required',
      timeout: 60000,
    }
  })

  if (!assertion) throw new Error('Verificación biométrica fallida')

  // Reconstruir clave y descifrar contraseña maestra
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new Uint8Array([...credId, ...secret]),
    'PBKDF2', false, ['deriveKey']
  )
  const aesKey = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: credId, iterations: 10000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']
  )
  const keyBytes = new Uint8Array(await crypto.subtle.exportKey('raw', aesKey))
  return await aesDecrypt(encMPw, keyBytes)
}
