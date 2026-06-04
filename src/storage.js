// ─── ALMACENAMIENTO LOCAL + SYNC CON SUPABASE ─────────────────────────────
// La bóveda siempre existe localmente (offline-first).
// Supabase es la copia de seguridad en la nube y el canal de sync.

import { uploadVault, downloadVault } from './supabase.js'

const KEY_VAULT   = 'vlt_enc'
const KEY_TS      = 'vlt_ts'        // timestamp del último guardado local
const KEY_BKLOG   = 'vlt_backup_log'

// ── LOCAL ──────────────────────────────────────────────────────────────────
export const saveLocal   = (b64) => {
  localStorage.setItem(KEY_VAULT, b64)
  localStorage.setItem(KEY_TS, new Date().toISOString())
}
export const loadLocal   = ()    => localStorage.getItem(KEY_VAULT)
export const loadLocalTs = ()    => localStorage.getItem(KEY_TS)
export const clearLocal  = ()    => {
  localStorage.removeItem(KEY_VAULT)
  localStorage.removeItem(KEY_TS)
}

// ── BACKUP LOG ─────────────────────────────────────────────────────────────
export const loadBackupLog = () => {
  try { return JSON.parse(localStorage.getItem(KEY_BKLOG) || '[]') }
  catch { return [] }
}
export const addBackupEntry = (count) => {
  const log = loadBackupLog()
  log.unshift({ date: new Date().toISOString(), entries: count })
  localStorage.setItem(KEY_BKLOG, JSON.stringify(log.slice(0, 10)))
}

// ── SYNC ───────────────────────────────────────────────────────────────────

// Guardar localmente Y subir a Supabase
export async function saveAndSync(encryptedBlob) {
  saveLocal(encryptedBlob)
  try {
    await uploadVault(encryptedBlob)
    return { synced: true }
  } catch {
    // Sin internet o error de red: se guarda local, se sincronizará después
    return { synced: false }
  }
}

// Al abrir la app: comparar timestamp local vs remoto y usar el más reciente
export async function resolveSync(masterPassword, decryptFn) {
  const localBlob = loadLocal()
  const localTs   = loadLocalTs()

  let remoteData = null
  try { remoteData = await downloadVault() } catch { /* sin red */ }

  // Sin nada en ningún lado → bóveda nueva
  if (!localBlob && !remoteData) return { blob: null, entries: [], source: 'empty' }

  // Solo local
  if (localBlob && !remoteData) return { blob: localBlob, source: 'local' }

  // Solo remoto → descargar
  if (!localBlob && remoteData) {
    saveLocal(remoteData.vault_data)
    return { blob: remoteData.vault_data, source: 'remote' }
  }

  // Ambos existen → ganar el más reciente por timestamp
  const remoteTs = remoteData.updated_at
  const useRemote = remoteTs && localTs && new Date(remoteTs) > new Date(localTs)

  if (useRemote) {
    saveLocal(remoteData.vault_data)
    return { blob: remoteData.vault_data, source: 'remote_newer' }
  }

  return { blob: localBlob, source: 'local_newer' }
}
