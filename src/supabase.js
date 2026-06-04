import { createClient } from '@supabase/supabase-js'

// ─── CONFIGURACIÓN DE SUPABASE ─────────────────────────────────────────────
// Sustituye estos valores por los tuyos de Settings → API en Supabase
const SUPABASE_URL  = 'https://dtejywwpznolladbhxvi.supabase.co'   // ← cambia esto
const SUPABASE_ANON = 'sb_publishable_dn-6tBvBhyvTUCC6185-Mw_ydGCoynw'                    // ← cambia esto

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  }
})

// ─── OPERACIONES DE BÓVEDA EN SUPABASE ────────────────────────────────────

// Subir bóveda cifrada al servidor
export async function uploadVault(encryptedBlob) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')

  const { error } = await supabase
    .from('vaults')
    .upsert({
      user_id:    user.id,
      vault_data: encryptedBlob,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })

  if (error) throw error
}

// Descargar bóveda cifrada del servidor
export async function downloadVault() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('vaults')
    .select('vault_data, updated_at')
    .eq('user_id', user.id)
    .single()

  if (error && error.code !== 'PGRST116') throw error // PGRST116 = no row found
  return data || null
}

// Borrar bóveda del servidor (al eliminar cuenta)
export async function deleteVaultRemote() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await supabase.from('vaults').delete().eq('user_id', user.id)
}
