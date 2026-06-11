import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from './supabase.js'
import { encryptVault, decryptVault, reEncryptVault, pwStrength, genPassword, PBKDF2_ITERATIONS } from './crypto.js'
import { saveAndSync, loadLocal, loadBackupLog, addBackupEntry, clearLocal, resolveSync } from './storage.js'
import {
  getQuickMode, clearQuickUnlock,
  setupPIN, unlockWithPIN, getPINLockSecsLeft,
  checkBiometricSupport, setupBiometric, unlockWithBiometric,
} from './biometric.js'

// ─── ICONS ─────────────────────────────────────────────────────────────────
const Icon = ({ d, size = 20, stroke = 'currentColor', fill = 'none', sw = 1.8 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke}
    strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    {Array.isArray(d) ? d.map((p, i) => <path key={i} d={p} />) : <path d={d} />}
  </svg>
)
const IC = {
  lock:     'M19 11H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2zM7 11V7a5 5 0 0110 0v4',
  eye:      ['M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z', 'M12 9a3 3 0 100 6 3 3 0 000-6z'],
  eyeOff:   ['M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22'],
  plus:     'M12 5v14M5 12h14',
  trash:    ['M3 6h18', 'M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2'],
  copy:     ['M20 9H11a2 2 0 00-2 2v9a2 2 0 002 2h9a2 2 0 002-2v-9a2 2 0 00-2-2z', 'M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1'],
  download: ['M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4', 'M7 10l5 5 5-5', 'M12 15V3'],
  upload:   ['M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4', 'M17 8l-5-5-5 5', 'M12 3v12'],
  search:   ['M11 17.25a6.25 6.25 0 110-12.5 6.25 6.25 0 010 12.5z', 'M16 16l4.5 4.5'],
  shield:   'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  key:      ['M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4'],
  wifi:     'M5 12.55a11 11 0 0114.08 0M1.42 9a16 16 0 0121.16 0M8.53 16.11a6 6 0 016.95 0M12 20h.01',
  globe:    ['M12 2a10 10 0 100 20A10 10 0 0012 2z', 'M2 12h20', 'M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20'],
  card:     ['M1 4h22v16H1z', 'M1 9h22'],
  note:     ['M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z', 'M14 2v6h6', 'M16 13H8', 'M16 17H8', 'M10 9H8'],
  edit:     ['M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7', 'M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z'],
  check:    'M20 6L9 17l-5-5',
  x:        'M18 6L6 18M6 6l12 12',
  refresh:  'M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15',
  clock:    ['M12 2a10 10 0 100 20A10 10 0 0012 2z', 'M12 6v6l4 2'],
  info:     ['M12 2a10 10 0 100 20A10 10 0 0012 2z', 'M12 16v-4', 'M12 8h.01'],
  database: ['M12 2C6.48 2 2 4.24 2 7s4.48 5 10 5 10-2.24 10-5-4.48-5-10-5z', 'M2 7v5c0 2.76 4.48 5 10 5s10-2.24 10-5V7', 'M2 12v5c0 2.76 4.48 5 10 5s10-2.24 10-5v-5'],
  alertTri: ['M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z', 'M12 9v4', 'M12 17h.01'],
  backup:   ['M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4', 'M7 10l5 5 5-5', 'M12 15V3'],
  menu:     'M3 12h18M3 6h18M3 18h18',
  chevronL: 'M15 18l-6-6 6-6',
  user:     ['M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2', 'M12 3a4 4 0 100 8 4 4 0 000-8z'],
  phone:    ['M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.8 19.79 19.79 0 01.15 1.18 2 2 0 012.11 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 7.91a16 16 0 006.18 6.18l1.27-1.35a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z'],
  hash:     ['M4 9h16', 'M4 15h16', 'M10 3L8 21', 'M16 3l-2 18'],
  sync:     ['M23 4v6h-6', 'M1 20v-6h6', 'M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15'],
  mail:     ['M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z', 'M22 6l-10 7L2 6'],
  settings: ['M12 15a3 3 0 100-6 3 3 0 000 6z', 'M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z'],
  logout:   ['M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4', 'M16 17l5-5-5-5', 'M21 12H9'],
  table:    ['M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18'],
  faceId:   ['M8 2H6a2 2 0 00-2 2v2', 'M16 2h2a2 2 0 012 2v2', 'M8 22H6a2 2 0 01-2-2v-2', 'M16 22h2a2 2 0 002-2v-2', 'M9 10h.01', 'M15 10h.01', 'M9.5 15a3.5 3.5 0 005 0'],
  pin:      ['M12 2a10 10 0 100 20A10 10 0 0012 2z', 'M12 8v4', 'M12 16h.01'],
}

// ─── CATEGORIES ────────────────────────────────────────────────────────────
const CATEGORIES = [
  { id: 'password', label: 'Contraseña',  icon: 'key',   color: '#60A5FA' },
  { id: 'card',     label: 'Tarjeta',     icon: 'card',  color: '#F472B6' },
  { id: 'wifi',     label: 'WiFi',        icon: 'wifi',  color: '#34D399' },
  { id: 'note',     label: 'Nota',        icon: 'note',  color: '#FBBF24' },
  { id: 'identity', label: 'Identidad',   icon: 'user',  color: '#A78BFA' },
]
const FIELDS = {
  password: [
    { key: 'url',      label: 'Sitio web / URL',      type: 'text',     placeholder: 'https://ejemplo.com' },
    { key: 'username', label: 'Usuario o email',       type: 'text',     placeholder: 'usuario@email.com'   },
    { key: 'password', label: 'Contraseña',            type: 'password', placeholder: '••••••••'            },
    { key: 'notes',    label: 'Notas',                 type: 'textarea', placeholder: 'Notas adicionales…'  },
  ],
  card: [
    { key: 'cardNumber', label: 'Número de tarjeta',   type: 'text',     placeholder: '0000 0000 0000 0000' },
    { key: 'holder',     label: 'Titular',             type: 'text',     placeholder: 'Nombre Apellido'     },
    { key: 'expiry',     label: 'Vencimiento',         type: 'text',     placeholder: 'MM/AA'               },
    { key: 'cvv',        label: 'CVV / CVC',           type: 'password', placeholder: '•••'                 },
    { key: 'pin',        label: 'PIN',                 type: 'password', placeholder: '••••'                },
    { key: 'bank',       label: 'Banco / Entidad',     type: 'text',     placeholder: 'Nombre del banco'    },
    { key: 'notes',      label: 'Notas',               type: 'textarea', placeholder: 'Notas adicionales…'  },
  ],
  wifi: [
    { key: 'ssid',     label: 'Nombre de red (SSID)',  type: 'text',     placeholder: 'MiRedWiFi'           },
    { key: 'password', label: 'Contraseña WiFi',       type: 'password', placeholder: '••••••••'            },
    { key: 'security', label: 'Seguridad',             type: 'text',     placeholder: 'WPA2 / WPA3'         },
    { key: 'router',   label: 'Modelo de router',      type: 'text',     placeholder: 'Marca y modelo'      },
    { key: 'notes',    label: 'Notas',                 type: 'textarea', placeholder: 'Notas adicionales…'  },
  ],
  note: [
    { key: 'content', label: 'Contenido', type: 'textarea', placeholder: 'Escribe tu nota segura aquí…' },
  ],
  identity: [
    { key: 'fullName',    label: 'Nombre completo',               type: 'text',     placeholder: 'Nombre Apellido'     },
    { key: 'idNumber',    label: 'Nº Documento (DNI/NIE/Pasaporte)', type: 'text',  placeholder: '12345678A'           },
    { key: 'dob',         label: 'Fecha de nacimiento',           type: 'text',     placeholder: 'DD/MM/AAAA'          },
    { key: 'nationality', label: 'Nacionalidad',                  type: 'text',     placeholder: 'Española'            },
    { key: 'address',     label: 'Dirección',                     type: 'textarea', placeholder: 'Calle, número…'      },
    { key: 'phone',       label: 'Teléfono',                      type: 'text',     placeholder: '+34 600 000 000'     },
    { key: 'email',       label: 'Email',                         type: 'text',     placeholder: 'email@ejemplo.com'   },
    { key: 'notes',       label: 'Notas',                         type: 'textarea', placeholder: 'Notas adicionales…'  },
  ],
}
const getCat = id => CATEGORIES.find(c => c.id === id) || CATEGORIES[0]

function fmtDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
    + ' · ' + d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
}
function daysSince(iso) {
  if (!iso) return null
  return Math.floor((Date.now() - new Date(iso).getTime()) / 864e5)
}

// ─── MAIN APP ──────────────────────────────────────────────────────────────
export default function VaultApp() {
  // ── Auth state
  const [authPhase, setAuthPhase]   = useState('boot')  // boot|login|register|unlock|vault
  const [authUser, setAuthUser]     = useState(null)
  const [authEmail, setAuthEmail]   = useState('')
  const [authPw, setAuthPw]         = useState('')
  const [authPw2, setAuthPw2]       = useState('')
  const [showAuthPw, setShowAuthPw] = useState(false)

  // ── Vault state
  const [masterPw, setMasterPw]     = useState('')
  const [showMPw, setShowMPw]       = useState(false)
  const [entries, setEntries]       = useState([])
  const [syncStatus, setSyncStatus] = useState('idle') // idle|syncing|synced|error|offline

  // ── UI state
  const [panel, setPanel]           = useState('vault')  // vault|backup|settings
  const [search, setSearch]         = useState('')
  const [filterCat, setFilterCat]   = useState('all')
  const [activeEntry, setActiveEntry] = useState(null)
  const [editData, setEditData]     = useState({})
  const [editCat, setEditCat]       = useState('password')
  const [revealed, setRevealed]     = useState({})
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [delConfirm, setDelConfirm] = useState(null)
  const [toast, setToast]           = useState(null)
  const [loading, setLoading]       = useState(false)
  const [backupLog, setBackupLog]   = useState([])

  // ── Change master password state
  const [changePwStep, setChangePwStep] = useState(0) // 0=off 1=form 2=confirming
  const [oldMPw, setOldMPw]         = useState('')
  const [newMPw, setNewMPw]         = useState('')
  const [newMPw2, setNewMPw2]       = useState('')
  const [showChangePw, setShowChangePw] = useState(false)

  // ── Biometric / PIN state
  const [quickMode, setQuickMode]       = useState('none')  // none|biometric|pin|setup
  const [bioSupported, setBioSupported] = useState(false)
  const [pinInput, setPinInput]         = useState('')
  const [pinError, setPinError]         = useState('')
  const [pinLockSecs, setPinLockSecs]   = useState(0)
  const [setupMode, setSetupMode]       = useState(null)    // null|biometric|pin
  const [setupPin, setSetupPin]         = useState('')
  const [setupPin2, setSetupPin2]       = useState('')
  const [setupStep, setSetupStep]       = useState(1)

  const autoLockRef = useRef(null)

  // ── Boot: check session + biometric support
  useEffect(() => {
    checkBiometricSupport().then(ok => setBioSupported(ok))
    setQuickMode(getQuickMode())

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setAuthUser(session.user)
        setAuthPhase('unlock')
      } else {
        setAuthPhase('login')
      }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setAuthPhase('login')
        setAuthUser(null)
        setEntries([])
        setMasterPw('')
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  // ── Auto-lock 5 min
  const resetLock = useCallback(() => {
    clearTimeout(autoLockRef.current)
    autoLockRef.current = setTimeout(() => {
      setAuthPhase('unlock')
      setEntries([])
      setMasterPw('')
      setPinInput('')
      setPinError('')
      notify('🔒 Bóveda bloqueada por inactividad', 'info')
    }, 5 * 60 * 1000)
  }, [])

  useEffect(() => {
    if (authPhase !== 'vault') return
    const evts = ['mousemove', 'keydown', 'touchstart', 'click', 'scroll']
    evts.forEach(e => window.addEventListener(e, resetLock, { passive: true }))
    resetLock()
    return () => evts.forEach(e => window.removeEventListener(e, resetLock))
  }, [authPhase, resetLock])

  const notify = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  // ── LOGIN
  const handleLogin = async () => {
    if (!authEmail || !authPw) return notify('Completa email y contraseña', 'error')
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPw })
    if (error) notify(error.message === 'Invalid login credentials' ? 'Email o contraseña incorrectos' : error.message, 'error')
    else {
      const { data: { user } } = await supabase.auth.getUser()
      setAuthUser(user)
      setAuthPw('')
      setAuthPhase('unlock')
    }
    setLoading(false)
  }

  // ── REGISTER
  const handleRegister = async () => {
    if (!authEmail) return notify('Introduce tu email', 'error')
    if (authPw.length < 8) return notify('Mínimo 8 caracteres', 'error')
    if (authPw !== authPw2) return notify('Las contraseñas no coinciden', 'error')
    setLoading(true)
    const { error } = await supabase.auth.signUp({ email: authEmail, password: authPw })
    if (error) notify(error.message, 'error')
    else notify('✅ Cuenta creada. Revisa tu email para confirmarla.')
    setLoading(false)
  }

  // ── LOGOUT
  const handleLogout = async () => {
    await supabase.auth.signOut()
    clearLocal()
    setEntries([])
    setMasterPw('')
    setAuthPhase('login')
  }

  // ── UNLOCK: desbloquear bóveda con contraseña maestra
  const handleUnlock = async () => {
    if (!masterPw) return
    setLoading(true)
    try {
      await doUnlockVault(masterPw)
      // Tras unlock exitoso con contraseña maestra, ofrecer setup biometría/PIN
      if (quickMode === 'none') setSetupMode('offer')
    } catch {
      notify('Contraseña maestra incorrecta', 'error')
      setSyncStatus('error')
    }
    setLoading(false)
  }

  // ── UNLOCK CON BIOMETRÍA
  const handleBiometricUnlock = async () => {
    setLoading(true)
    setPinError('')
    try {
      const mPw = await unlockWithBiometric()
      setMasterPw(mPw)
      await doUnlockVault(mPw)
    } catch (err) {
      setPinError(err.message || 'Error de biometría')
      // Si falla biometría, mostrar PIN como fallback si está disponible
      if (quickMode === 'biometric' && getQuickMode() === 'biometric') {
        notify('Biometría fallida — usa el PIN', 'info')
      }
    }
    setLoading(false)
  }

  // ── UNLOCK CON PIN
  const handlePINUnlock = async (pin) => {
    setLoading(true)
    setPinError('')
    const lockSecs = getPINLockSecsLeft()
    if (lockSecs > 0) {
      setPinError(`PIN bloqueado. Espera ${lockSecs}s.`)
      setPinLockSecs(lockSecs)
      setLoading(false)
      return
    }
    try {
      const mPw = await unlockWithPIN(pin)
      setMasterPw(mPw)
      await doUnlockVault(mPw)
      setPinInput('')
    } catch (err) {
      setPinError(err.message)
      setPinInput('')
    }
    setLoading(false)
  }

  // ── LÓGICA COMÚN DE UNLOCK (usada por todos los métodos)
  const doUnlockVault = async (mPw) => {
    setSyncStatus('syncing')
    const { blob, source } = await resolveSync(mPw, decryptVault)
    if (!blob) {
      const enc = await encryptVault([], mPw)
      await saveAndSync(enc)
      setEntries([])
      setAuthPhase('vault')
      setSyncStatus('synced')
      notify('✅ Bóveda creada')
    } else {
      const data = await decryptVault(blob, mPw)
      setEntries(data)
      setAuthPhase('vault')
      setBackupLog(loadBackupLog())
      setSyncStatus(source.includes('remote') ? 'synced' : 'idle')
      if (source === 'remote_newer') notify('☁️ Bóveda actualizada desde la nube')
      else notify('✅ Bóveda desbloqueada')
    }
  }

  // ── SETUP BIOMETRÍA tras unlock con contraseña maestra
  const handleSetupBiometric = async () => {
    setLoading(true)
    try {
      await setupBiometric(masterPw, authUser?.email)
      setQuickMode('biometric')
      setSetupMode(null)
      notify('✅ Face ID / Touch ID activado')
    } catch (err) {
      notify('Error al activar biometría: ' + err.message, 'error')
    }
    setLoading(false)
  }

  // ── SETUP PIN tras unlock con contraseña maestra
  const handleSetupPIN = async () => {
    if (setupPin.length !== 6) return notify('El PIN debe tener 6 dígitos', 'error')
    if (setupPin !== setupPin2) return notify('Los PINs no coinciden', 'error')
    setLoading(true)
    try {
      await setupPIN(setupPin, masterPw)
      setQuickMode('pin')
      setSetupMode(null)
      setSetupPin('')
      setSetupPin2('')
      notify('✅ PIN de 6 dígitos activado')
    } catch (err) {
      notify('Error al configurar PIN', 'error')
    }
    setLoading(false)
  }

  // ── DESACTIVAR desbloqueo rápido
  const handleDisableQuickUnlock = () => {
    clearQuickUnlock()
    setQuickMode('none')
    notify('Desbloqueo rápido desactivado')
  }

  // ── COUNTDOWN PIN lock
  useEffect(() => {
    if (pinLockSecs <= 0) return
    const t = setInterval(() => {
      const secs = getPINLockSecsLeft()
      setPinLockSecs(secs)
      if (secs <= 0) clearInterval(t)
    }, 1000)
    return () => clearInterval(t)
  }, [pinLockSecs])

  // ── PERSIST: guardar localmente + sync
  const persist = useCallback(async (data) => {
    setSyncStatus('syncing')
    const enc = await encryptVault(data, masterPw)
    const { synced } = await saveAndSync(enc)
    setSyncStatus(synced ? 'synced' : 'offline')
    return enc
  }, [masterPw])

  // ── SAVE ENTRY
  const handleSave = async () => {
    if (!editData.title?.trim()) return notify('El título es obligatorio', 'error')
    let updated
    if (activeEntry.mode === 'new') {
      updated = [...entries, {
        ...editData,
        id: Date.now().toString(),
        category: editCat,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }]
    } else {
      updated = entries.map(e => e.id === activeEntry.data.id
        ? { ...e, ...editData, category: editCat, updatedAt: new Date().toISOString() }
        : e
      )
    }
    setEntries(updated)
    await persist(updated)
    setActiveEntry(null)
    setEditData({})
    notify('✅ Entrada guardada')
  }

  // ── DELETE ENTRY
  const handleDelete = async (id) => {
    const updated = entries.filter(e => e.id !== id)
    setEntries(updated)
    await persist(updated)
    setActiveEntry(null)
    setDelConfirm(null)
    notify('🗑️ Entrada eliminada')
  }

  // ── EXPORT BACKUP
  const handleExport = async () => {
    const stored = loadLocal()
    if (!stored) return notify('No hay datos para exportar', 'error')
    const blob = new Blob([JSON.stringify({
      version: '2.0', app: 'VAULT',
      exportedAt: new Date().toISOString(),
      entries: entries.length,
      vault: stored,
    }, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `vault-backup-${new Date().toISOString().slice(0, 10)}.vault`
    a.click()
    URL.revokeObjectURL(a.href)
    addBackupEntry(entries.length)
    setBackupLog(loadBackupLog())
    notify(`📦 Backup de ${entries.length} entradas exportado`)
  }

  // ── EXPORT CSV
  const handleExportCSV = () => {
    if (!entries.length) return notify('No hay entradas para exportar', 'error')
    const headers = [
      'Titulo','Categoria','URL','Usuario','Contrasena',
      'Num tarjeta','Titular','Vencimiento','CVV','PIN','Banco',
      'SSID','Seguridad WiFi','Router','Contenido',
      'Nombre completo','Num Documento','Fecha nacimiento',
      'Nacionalidad','Direccion','Telefono','Email',
      'Notas','Creado','Modificado'
    ]
    const esc = v => {
      if (v == null || v === '') return ''
      const s = String(v).replace(/"/g, '""')
      return (s.includes(',') || s.includes('\n') || s.includes('"')) ? '"' + s + '"' : s
    }
    const CAT = { password:'Contrasena', card:'Tarjeta', wifi:'WiFi', note:'Nota', identity:'Identidad' }
    const rows = entries.map(e => [
      esc(e.title), esc(CAT[e.category]||e.category),
      esc(e.url), esc(e.username), esc(e.password),
      esc(e.cardNumber), esc(e.holder), esc(e.expiry), esc(e.cvv), esc(e.pin), esc(e.bank),
      esc(e.ssid), esc(e.security), esc(e.router), esc(e.content),
      esc(e.fullName), esc(e.idNumber), esc(e.dob), esc(e.nationality),
      esc(e.address), esc(e.phone), esc(e.email), esc(e.notes),
      esc(e.createdAt ? new Date(e.createdAt).toLocaleString('es-ES') : ''),
      esc(e.updatedAt ? new Date(e.updatedAt).toLocaleString('es-ES') : ''),
    ].join(','))
    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'vault-export-' + new Date().toISOString().slice(0,10) + '.csv'
    a.click()
    URL.revokeObjectURL(a.href)
    notify('📊 CSV con ' + entries.length + ' entradas exportado')
  }

  // ── IMPORT BACKUP
  const handleImport = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setLoading(true)
    const reader = new FileReader()
    reader.onload = async ev => {
      try {
        const parsed = JSON.parse(ev.target.result)
        const raw = parsed.vault || parsed
        const data = await decryptVault(typeof raw === 'string' ? raw : JSON.stringify(raw), masterPw)
        setEntries(data)
        await persist(data)
        notify(`✅ ${data.length} entradas restauradas`)
      } catch {
        notify('Error: contraseña incorrecta o archivo dañado', 'error')
      }
      setLoading(false)
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  // ── SYNC MANUAL
  const handleManualSync = async () => {
    setSyncStatus('syncing')
    try {
      const enc = await encryptVault(entries, masterPw)
      const { synced } = await saveAndSync(enc)
      setSyncStatus(synced ? 'synced' : 'offline')
      notify(synced ? '☁️ Sincronizado con la nube' : '📴 Sin conexión — guardado local', synced ? 'success' : 'info')
    } catch {
      setSyncStatus('error')
      notify('Error al sincronizar', 'error')
    }
  }

  // ── CHANGE MASTER PASSWORD
  const handleChangeMasterPw = async () => {
    if (!oldMPw) return notify('Introduce la contraseña actual', 'error')
    if (newMPw.length < 8) return notify('La nueva contraseña debe tener mínimo 8 caracteres', 'error')
    if (newMPw !== newMPw2) return notify('Las nuevas contraseñas no coinciden', 'error')
    if (oldMPw === newMPw) return notify('La nueva contraseña debe ser diferente', 'error')

    setLoading(true)
    try {
      // Verificar contraseña vieja descifrando con ella
      const stored = loadLocal()
      if (!stored) throw new Error('no vault')
      await decryptVault(stored, oldMPw) // lanza error si falla

      // Re-cifrar con la nueva contraseña
      const newEnc = await reEncryptVault(entries, oldMPw, newMPw)

      // Guardar con nueva clave
      const { synced } = await saveAndSync(newEnc)

      // Actualizar estado
      setMasterPw(newMPw)
      setChangePwStep(0)
      setOldMPw('')
      setNewMPw('')
      setNewMPw2('')

      notify(`✅ Contraseña maestra cambiada${synced ? ' y sincronizada' : ' (sin conexión)'}`)
    } catch {
      notify('La contraseña actual es incorrecta', 'error')
    }
    setLoading(false)
  }

  const copy = val => { navigator.clipboard?.writeText(val); notify('📋 Copiado') }

  const filtered = entries.filter(e => {
    const mc = filterCat === 'all' || e.category === filterCat
    const q  = search.toLowerCase()
    const ms = !q || e.title?.toLowerCase().includes(q) ||
      Object.values(e).some(v => typeof v === 'string' && v.toLowerCase().includes(q))
    return mc && ms
  })
  const counts = {}
  entries.forEach(e => { counts[e.category] = (counts[e.category] || 0) + 1 })

  const lastBk  = backupLog[0]
  const dSince  = daysSince(lastBk?.date)
  const bkWarn  = dSince === null || dSince > 7

  const syncIcon  = { idle: IC.sync, syncing: IC.refresh, synced: IC.check, error: IC.alertTri, offline: IC.info }
  const syncColor = { idle: '#475569', syncing: '#60A5FA', synced: '#10B981', error: '#EF4444', offline: '#F59E0B' }

  // ─── RENDER ──────────────────────────────────────────────────────────────
  const appStyle = {
    minHeight: '100dvh', background: '#0A0D14', color: '#E2E8F0',
    fontFamily: "'DM Mono','Fira Code','Courier New',monospace",
    overflowX: 'hidden', position: 'relative',
  }
  const grid = {
    position: 'fixed', inset: 0,
    backgroundImage: 'linear-gradient(rgba(96,165,250,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(96,165,250,0.03) 1px,transparent 1px)',
    backgroundSize: '40px 40px', pointerEvents: 'none', zIndex: 0,
  }

  // ── BOOT
  if (authPhase === 'boot') return (
    <div style={{ ...appStyle, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={grid} />
      <div style={{ textAlign: 'center', zIndex: 1, position: 'relative' }}>
        <div style={{ fontSize: 48 }}>🔐</div>
        <p style={{ color: '#64748B', marginTop: 8, fontSize: 14 }}>Iniciando…</p>
      </div>
      <style>{CSS}</style>
    </div>
  )

  // ── LOGIN / REGISTER
  if (authPhase === 'login' || authPhase === 'register') {
    const isReg = authPhase === 'register'
    return (
      <div style={{ ...appStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div style={grid} />
        <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 420, background: 'rgba(15,20,30,0.97)', border: '1px solid rgba(96,165,250,0.15)', borderRadius: 20, padding: 'clamp(24px,5vw,40px) clamp(20px,5vw,36px)', boxShadow: '0 24px 48px rgba(0,0,0,0.5)', boxSizing: 'border-box' }}>

          {/* Logo */}
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 64, height: 64, borderRadius: 16, background: 'linear-gradient(135deg,#1E3A5F,#0F172A)', border: '1px solid rgba(96,165,250,0.3)', marginBottom: 14, boxShadow: '0 0 30px rgba(96,165,250,0.1)' }}>
              <Icon d={IC.shield} size={32} stroke="#60A5FA" />
            </div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#F1F5F9', letterSpacing: '-0.5px' }}>VAULT</h1>
            <p style={{ margin: '4px 0 0', fontSize: 11, color: '#475569', letterSpacing: '2px', textTransform: 'uppercase' }}>
              {isReg ? 'Crear cuenta' : 'Acceso'}
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Email */}
            <div>
              <label style={LBL}>Email</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#475569', pointerEvents: 'none' }}>
                  <Icon d={IC.mail} size={15} />
                </span>
                <input type="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)}
                  placeholder="tu@email.com" autoComplete="email"
                  onKeyDown={e => e.key === 'Enter' && (isReg ? handleRegister() : handleLogin())}
                  style={{ ...INP, paddingLeft: 36, fontSize: 16 }} />
              </div>
            </div>

            {/* Contraseña cuenta */}
            <PwField label="Contraseña de cuenta" value={authPw} onChange={setAuthPw}
              show={showAuthPw} onToggle={() => setShowAuthPw(p => !p)}
              onKeyDown={e => e.key === 'Enter' && (isReg ? authPw2 && handleRegister() : handleLogin())} />

            {isReg && (
              <PwField label="Confirmar contraseña" value={authPw2} onChange={setAuthPw2}
                show={showAuthPw} onToggle={() => setShowAuthPw(p => !p)}
                onKeyDown={e => e.key === 'Enter' && authPw && handleRegister()} />
            )}

            <button onClick={isReg ? handleRegister : handleLogin} disabled={loading}
              style={{ width: '100%', padding: '13px', background: loading ? 'rgba(96,165,250,0.08)' : 'linear-gradient(135deg,#1D4ED8,#1E40AF)', border: '1px solid rgba(96,165,250,0.3)', borderRadius: 10, color: '#E2E8F0', fontSize: 13, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', letterSpacing: '1px', textTransform: 'uppercase', fontFamily: 'inherit' }}>
              {loading ? '⏳ Procesando…' : isReg ? 'Crear cuenta' : 'Entrar'}
            </button>

            <button onClick={() => { setAuthPhase(isReg ? 'login' : 'register'); setAuthPw(''); setAuthPw2('') }}
              style={{ background: 'none', border: 'none', color: '#475569', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center', padding: '4px' }}>
              {isReg ? '¿Ya tienes cuenta? Inicia sesión' : '¿Sin cuenta? Regístrate gratis'}
            </button>
          </div>

          <p style={{ textAlign: 'center', marginTop: 16, color: '#334155', fontSize: 10, lineHeight: 1.6 }}>
            Tu bóveda se cifra localmente.<br />El servidor nunca ve tus contraseñas.
          </p>
        </div>

        {toast && <Toast msg={toast.msg} type={toast.type} />}
        <style>{CSS}</style>
      </div>
    )
  }

  // ── UNLOCK (contraseña maestra + biometría + PIN)
  if (authPhase === 'unlock') {
    const str      = pwStrength(masterPw)
    const hasLocal = !!loadLocal()
    const isPinLocked = getPINLockSecsLeft() > 0

    return (
      <div style={{ ...appStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div style={grid} />
        <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 400, background: 'rgba(15,20,30,0.97)', border: '1px solid rgba(96,165,250,0.15)', borderRadius: 20, padding: 'clamp(20px,5vw,36px) clamp(18px,5vw,32px)', boxShadow: '0 24px 48px rgba(0,0,0,0.5)', boxSizing: 'border-box' }}>

          {/* Logo */}
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 60, height: 60, borderRadius: 16, background: 'linear-gradient(135deg,#1E3A5F,#0F172A)', border: '1px solid rgba(96,165,250,0.3)', marginBottom: 12, boxShadow: '0 0 30px rgba(96,165,250,0.1)' }}>
              <Icon d={IC.lock} size={26} stroke="#60A5FA" />
            </div>
            <h1 style={{ margin: 0, fontSize: 19, fontWeight: 700, color: '#F1F5F9' }}>Bóveda bloqueada</h1>
            <p style={{ margin: '4px 0 0', fontSize: 11, color: '#475569' }}>{authUser?.email}</p>
          </div>

          {/* ── MODO BIOMETRÍA */}
          {quickMode === 'biometric' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <button onClick={handleBiometricUnlock} disabled={loading}
                style={{ width: '100%', padding: '16px', background: loading ? 'rgba(96,165,250,0.05)' : 'linear-gradient(135deg,#1D4ED8,#1E40AF)', border: '1px solid rgba(96,165,250,0.3)', borderRadius: 12, color: '#E2E8F0', fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                <Icon d={IC.faceId} size={22} stroke="#E2E8F0" />
                {loading ? 'Verificando…' : 'Face ID / Touch ID'}
              </button>
              {pinError && <p style={{ margin: 0, fontSize: 12, color: '#EF4444', textAlign: 'center' }}>{pinError}</p>}
              <button onClick={() => { setQuickMode('pin_fallback'); setPinError('') }}
                style={{ background: 'none', border: 'none', color: '#475569', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center', padding: '4px' }}>
                Usar PIN en su lugar
              </button>
              <button onClick={() => { setQuickMode('password_fallback'); setPinError('') }}
                style={{ background: 'none', border: 'none', color: '#334155', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center' }}>
                Usar contraseña maestra
              </button>
            </div>
          )}

          {/* ── MODO PIN */}
          {(quickMode === 'pin' || quickMode === 'pin_fallback') && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center' }}>
              <p style={{ margin: 0, fontSize: 13, color: '#94A3B8' }}>Introduce tu PIN de 6 dígitos</p>
              {isPinLocked && <p style={{ margin: 0, fontSize: 12, color: '#F59E0B' }}>PIN bloqueado. Espera {pinLockSecs}s</p>}
              <PINPad
                value={pinInput}
                onChange={setPinInput}
                onSubmit={pin => handlePINUnlock(pin)}
                disabled={loading || isPinLocked}
                error={pinError}
              />
              <button onClick={() => { setQuickMode('password_fallback'); setPinInput(''); setPinError('') }}
                style={{ background: 'none', border: 'none', color: '#334155', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
                Usar contraseña maestra
              </button>
            </div>
          )}

          {/* ── MODO CONTRASEÑA MAESTRA (default o fallback) */}
          {(quickMode === 'none' || quickMode === 'password_fallback') && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {!hasLocal && (
                <div style={{ background: 'rgba(96,165,250,0.05)', border: '1px solid rgba(96,165,250,0.1)', borderRadius: 10, padding: '10px 14px', fontSize: 11, color: '#64748B', lineHeight: 1.7 }}>
                  🔐 AES-256-GCM · PBKDF2 · {PBKDF2_ITERATIONS.toLocaleString()} iteraciones<br />
                  Contraseña maestra <strong style={{ color: '#94A3B8' }}>nunca sale del dispositivo</strong>
                </div>
              )}
              <PwField label="Contraseña maestra" value={masterPw} onChange={setMasterPw}
                show={showMPw} onToggle={() => setShowMPw(p => !p)} autoFocus
                onKeyDown={e => e.key === 'Enter' && handleUnlock()} />
              {!hasLocal && masterPw && str?.label && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1, height: 3, background: '#1E293B', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(str.score / 5) * 100}%`, background: str.color, borderRadius: 99 }} />
                  </div>
                  <span style={{ fontSize: 11, color: str.color }}>{str.label}</span>
                </div>
              )}
              <button onClick={handleUnlock} disabled={loading || !masterPw}
                style={{ width: '100%', padding: '13px', background: loading || !masterPw ? 'rgba(96,165,250,0.08)' : 'linear-gradient(135deg,#1D4ED8,#1E40AF)', border: '1px solid rgba(96,165,250,0.3)', borderRadius: 10, color: '#E2E8F0', fontSize: 13, fontWeight: 600, cursor: loading || !masterPw ? 'not-allowed' : 'pointer', letterSpacing: '1px', textTransform: 'uppercase', fontFamily: 'inherit' }}>
                {loading ? '⏳ Descifrando…' : !hasLocal ? 'Crear Bóveda' : 'Desbloquear'}
              </button>
            </div>
          )}

          <div style={{ marginTop: 16, borderTop: '1px solid rgba(96,165,250,0.08)', paddingTop: 14 }}>
            <button onClick={handleLogout}
              style={{ background: 'none', border: 'none', color: '#334155', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', width: '100%', textAlign: 'center' }}>
              Cerrar sesión
            </button>
          </div>
        </div>
        {toast && <Toast msg={toast.msg} type={toast.type} />}
        <style>{CSS}</style>
      </div>
    )
  }

  // ── VAULT PRINCIPAL
  return (
    <div style={appStyle}>
      <div style={grid} />
      {toast && <Toast msg={toast.msg} type={toast.type} />}

      {/* ── HEADER con safe-area Dynamic Island */}
      <header style={{
        display: 'flex', alignItems: 'center', gap: 8,
        paddingTop: 'max(12px, calc(12px + env(safe-area-inset-top)))',
        paddingBottom: '12px',
        paddingLeft: 'max(14px, env(safe-area-inset-left))',
        paddingRight: 'max(14px, env(safe-area-inset-right))',
        background: 'rgba(10,13,20,0.97)',
        borderBottom: '1px solid rgba(96,165,250,0.1)',
        position: 'sticky', top: 0, zIndex: 200,
        boxSizing: 'border-box', width: '100%',
      }}>
        <button onClick={() => setSidebarOpen(p => !p)} style={IBTN}>
          <Icon d={IC.menu} size={18} stroke="#64748B" />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flex: 1, minWidth: 0 }}>
          <Icon d={IC.shield} size={19} stroke="#60A5FA" />
          <span style={{ fontSize: 14, fontWeight: 700, color: '#F1F5F9', letterSpacing: '2px' }}>VAULT</span>
          <span style={{ fontSize: 10, padding: '1px 6px', background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)', borderRadius: 4, color: '#60A5FA', whiteSpace: 'nowrap' }}>
            {entries.length}
          </span>
        </div>

        {/* Sync status */}
        <div title={syncStatus} style={{ color: syncColor[syncStatus], display: 'flex', alignItems: 'center' }}>
          <Icon d={syncIcon[syncStatus]} size={15} stroke={syncColor[syncStatus]}
            style={{ animation: syncStatus === 'syncing' ? 'spin 1s linear infinite' : 'none' }} />
        </div>

        {/* Email del usuario */}
        <span style={{ fontSize: 10, color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 100 }}>
          {authUser?.email?.split('@')[0]}
        </span>
      </header>

      {/* ── MODAL: OFRECER DESBLOQUEO RÁPIDO tras primer login */}
      {setupMode === 'offer' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9000, padding: 20 }}>
          <div style={{ background: '#0F172A', border: '1px solid rgba(96,165,250,0.2)', borderRadius: 18, padding: '28px 24px', maxWidth: 380, width: '100%', boxSizing: 'border-box' }}>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>🔐</div>
              <h3 style={{ margin: '0 0 8px', color: '#F1F5F9', fontSize: 16 }}>Desbloqueo rápido</h3>
              <p style={{ margin: 0, fontSize: 12, color: '#475569', lineHeight: 1.6 }}>
                Activa Face ID / Touch ID o un PIN de 6 dígitos para abrir la bóveda sin escribir la contraseña maestra cada vez.
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {bioSupported && (
                <button onClick={() => { setSetupMode('biometric'); setSetupStep(1) }}
                  style={{ width: '100%', padding: '13px', background: 'linear-gradient(135deg,#1D4ED8,#1E40AF)', border: '1px solid rgba(96,165,250,0.3)', borderRadius: 10, color: '#E2E8F0', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <Icon d={IC.faceId} size={18} stroke="#E2E8F0" />
                  Activar Face ID / Touch ID
                </button>
              )}
              <button onClick={() => { setSetupMode('pin'); setSetupStep(1); setSetupPin(''); setSetupPin2('') }}
                style={{ width: '100%', padding: '13px', background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.2)', borderRadius: 10, color: '#93C5FD', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <Icon d={IC.pin} size={18} stroke="#93C5FD" />
                Activar PIN de 6 dígitos
              </button>
              <button onClick={() => setSetupMode(null)}
                style={{ background: 'none', border: 'none', color: '#334155', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', padding: '8px', textAlign: 'center' }}>
                Ahora no
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: SETUP BIOMETRÍA */}
      {setupMode === 'biometric' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9000, padding: 20 }}>
          <div style={{ background: '#0F172A', border: '1px solid rgba(96,165,250,0.2)', borderRadius: 18, padding: '28px 24px', maxWidth: 380, width: '100%', boxSizing: 'border-box' }}>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>🔏</div>
              <h3 style={{ margin: '0 0 8px', color: '#F1F5F9', fontSize: 16 }}>Activar Face ID / Touch ID</h3>
              <p style={{ margin: 0, fontSize: 12, color: '#475569', lineHeight: 1.6 }}>
                Al pulsar el botón, el sistema te pedirá autenticarte con Face ID o Touch ID para registrar tu biometría.
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button onClick={handleSetupBiometric} disabled={loading}
                style={{ width: '100%', padding: '13px', background: loading ? 'rgba(96,165,250,0.05)' : 'linear-gradient(135deg,#1D4ED8,#1E40AF)', border: '1px solid rgba(96,165,250,0.3)', borderRadius: 10, color: '#E2E8F0', fontSize: 13, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <Icon d={IC.faceId} size={18} stroke="#E2E8F0" />
                {loading ? 'Registrando…' : 'Registrar biometría'}
              </button>
              <button onClick={() => setSetupMode('offer')}
                style={{ background: 'none', border: 'none', color: '#334155', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', padding: '8px', textAlign: 'center' }}>
                Volver
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: SETUP PIN */}
      {setupMode === 'pin' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9000, padding: 20 }}>
          <div style={{ background: '#0F172A', border: '1px solid rgba(96,165,250,0.2)', borderRadius: 18, padding: '28px 24px', maxWidth: 380, width: '100%', boxSizing: 'border-box' }}>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>🔢</div>
              <h3 style={{ margin: '0 0 8px', color: '#F1F5F9', fontSize: 16 }}>
                {setupStep === 1 ? 'Elige un PIN de 6 dígitos' : 'Confirma el PIN'}
              </h3>
              <p style={{ margin: 0, fontSize: 12, color: '#475569' }}>
                {setupStep === 1 ? 'Escoge 6 dígitos que recuerdes bien.' : 'Introduce el mismo PIN otra vez.'}
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center' }}>
              <PINPad
                value={setupStep === 1 ? setupPin : setupPin2}
                onChange={setupStep === 1 ? setSetupPin : setSetupPin2}
                onSubmit={pin => {
                  if (setupStep === 1) { setSetupStep(2); setSetupPin(pin) }
                  else { setSetupPin2(pin); handleSetupPIN() }
                }}
                disabled={loading}
              />
              <button onClick={() => { if (setupStep === 2) { setSetupStep(1); setSetupPin2('') } else setSetupMode('offer') }}
                style={{ background: 'none', border: 'none', color: '#334155', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                {setupStep === 2 ? 'Volver' : 'Cancelar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CHANGE MASTER PASSWORD MODAL */}
      {changePwStep > 0 && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9000, padding: 20 }}>
          <div style={{ background: '#0F172A', border: '1px solid rgba(96,165,250,0.2)', borderRadius: 18, padding: '28px 24px', maxWidth: 400, width: '100%', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon d={IC.key} size={16} stroke="#60A5FA" />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#E2E8F0' }}>Cambiar contraseña maestra</div>
                <div style={{ fontSize: 11, color: '#475569' }}>La bóveda se re-cifrará completamente</div>
              </div>
              <button onClick={() => { setChangePwStep(0); setOldMPw(''); setNewMPw(''); setNewMPw2('') }} style={{ ...IBTN, marginLeft: 'auto' }}>
                <Icon d={IC.x} size={16} stroke="#64748B" />
              </button>
            </div>

            <div style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 10, padding: '10px 14px', fontSize: 11, color: '#92400E', marginBottom: 18, lineHeight: 1.6 }}>
              ⚠️ Si olvidas la nueva contraseña maestra, tus datos serán irrecuperables. Guárdala en un lugar seguro.
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <PwField label="Contraseña maestra actual" value={oldMPw} onChange={setOldMPw}
                show={showChangePw} onToggle={() => setShowChangePw(p => !p)} autoFocus />

              <PwField label="Nueva contraseña maestra" value={newMPw} onChange={setNewMPw}
                show={showChangePw} onToggle={() => setShowChangePw(p => !p)} />

              {newMPw && (() => {
                const s = pwStrength(newMPw)
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: -8 }}>
                    <div style={{ flex: 1, height: 3, background: '#1E293B', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${(s.score / 5) * 100}%`, background: s.color, borderRadius: 99 }} />
                    </div>
                    <span style={{ fontSize: 10, color: s.color }}>{s.label}</span>
                  </div>
                )
              })()}

              <PwField label="Confirmar nueva contraseña" value={newMPw2} onChange={setNewMPw2}
                show={showChangePw} onToggle={() => setShowChangePw(p => !p)}
                onKeyDown={e => e.key === 'Enter' && handleChangeMasterPw()} />

              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button onClick={() => { setChangePwStep(0); setOldMPw(''); setNewMPw(''); setNewMPw2('') }}
                  style={SBTN}>Cancelar</button>
                <button onClick={handleChangeMasterPw} disabled={loading}
                  style={{ ...SBTN, flex: 1, background: 'linear-gradient(135deg,#1D4ED8,#1E40AF)', borderColor: 'rgba(96,165,250,0.3)', color: '#E2E8F0' }}>
                  {loading ? '⏳ Re-cifrando…' : 'Cambiar contraseña'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── BACKUP PANEL */}
      {panel === 'backup' && (
        <div style={{ padding: '20px 16px', paddingBottom: 'calc(80px + env(safe-area-inset-bottom))', maxWidth: 680, margin: '0 auto', boxSizing: 'border-box', width: '100%' }}>
          <h2 style={{ margin: '0 0 6px', fontSize: 17, color: '#F1F5F9', fontWeight: 700 }}>Copias de seguridad</h2>
          <p style={{ margin: '0 0 20px', fontSize: 12, color: '#475569', lineHeight: 1.6 }}>
            El archivo <code style={{ color: '#60A5FA', fontSize: 11 }}>.vault</code> está cifrado con AES-256-GCM.
            Tu bóveda también se sincroniza automáticamente en la nube.
          </p>

          {/* Status */}
          <div style={{ padding: '16px', borderRadius: 14, marginBottom: 16, background: bkWarn ? 'rgba(245,158,11,0.06)' : 'rgba(16,185,129,0.06)', border: `1px solid ${bkWarn ? 'rgba(245,158,11,0.2)' : 'rgba(16,185,129,0.2)'}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <Icon d={bkWarn ? IC.alertTri : IC.check} size={18} stroke={bkWarn ? '#F59E0B' : '#10B981'} />
              <span style={{ fontSize: 13, fontWeight: 600, color: bkWarn ? '#FCD34D' : '#6EE7B7' }}>
                {bkWarn ? (lastBk ? `Último backup hace ${dSince} días` : 'Sin backup local registrado') : `Backup al día · hace ${dSince === 0 ? 'hoy' : `${dSince}d`}`}
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
              {[
                { l: 'Entradas',     v: entries.length },
                { l: 'Último backup', v: lastBk ? fmtDate(lastBk.date).split(' · ')[0] : 'Nunca' },
                { l: 'Backups',       v: backupLog.length },
              ].map(s => (
                <div key={s.l} style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(96,165,250,0.08)', borderRadius: 10, padding: '10px 12px' }}>
                  <div style={{ fontSize: 17, fontWeight: 700, color: '#E2E8F0' }}>{s.v}</div>
                  <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>{s.l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Sync manual */}
          <button onClick={handleManualSync}
            style={{ width: '100%', padding: '12px', marginBottom: 14, background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.2)', borderRadius: 10, color: '#60A5FA', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
            <Icon d={IC.sync} size={15} stroke="#60A5FA" />
            Sincronizar con la nube ahora
          </button>

          {/* Export / Import */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <BackupCard icon={IC.download} color="#60A5FA" title="Exportar" sub="Descarga .vault"
              desc="Archivo cifrado AES-256. Solo tú puedes abrirlo con tu contraseña maestra."
              btnLabel="Exportar .vault" onClick={handleExport} />

            <BackupCard icon={IC.upload} color="#34D399" title="Restaurar" sub="Carga .vault"
              desc="Restaura desde un archivo .vault. Reemplaza los datos actuales."
              btnLabel="Seleccionar archivo"
              onClick={() => document.getElementById('vltImport').click()} />
          </div>
          <input id="vltImport" type="file" accept=".vault,.json,application/json,text/plain,*/*"
            onChange={handleImport} style={{ display: 'none' }} />

          {/* CSV Export */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ padding: '16px 18px', borderRadius: 14, background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(251,191,36,0.15)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ width: 38, height: 38, borderRadius: 9, background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon d={IC.table} size={17} stroke="#FBBF24" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#E2E8F0' }}>Exportar como CSV</span>
                    <span style={{ fontSize: 9, padding: '2px 6px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 4, color: '#EF4444', letterSpacing: '0.5px' }}>SIN CIFRAR</span>
                  </div>
                  <p style={{ margin: '0 0 12px', fontSize: 11, color: '#475569', lineHeight: 1.6 }}>
                    Exporta todas las entradas en texto plano. Útil para migrar a otro gestor o abrir en Excel.
                    <strong style={{ color: '#F59E0B' }}> Guárdalo en un lugar seguro o elimínalo tras usarlo.</strong>
                  </p>
                  <button onClick={handleExportCSV}
                    style={{ padding: '9px 16px', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: 8, color: '#FBBF24', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <Icon d={IC.table} size={13} stroke="#FBBF24" />
                    Descargar .csv
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Historial */}
          {backupLog.length > 0 && (
            <div>
              <h3 style={{ margin: '0 0 10px', fontSize: 11, color: '#475569', letterSpacing: '2px', textTransform: 'uppercase' }}>Historial</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {backupLog.map((b, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 14px', borderRadius: 10, background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(96,165,250,0.07)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <Icon d={IC.clock} size={13} stroke={i === 0 ? '#60A5FA' : '#334155'} />
                      <span style={{ fontSize: 11, color: i === 0 ? '#94A3B8' : '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fmtDate(b.date)}</span>
                    </div>
                    <span style={{ fontSize: 11, color: '#334155', flexShrink: 0, marginLeft: 8 }}>{b.entries} ent.</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── SETTINGS PANEL */}
      {panel === 'settings' && (
        <div style={{ padding: '20px 16px', paddingBottom: 'calc(80px + env(safe-area-inset-bottom))', maxWidth: 680, margin: '0 auto', boxSizing: 'border-box', width: '100%' }}>
          <h2 style={{ margin: '0 0 20px', fontSize: 17, color: '#F1F5F9', fontWeight: 700 }}>Ajustes</h2>

          {/* Account info */}
          <Section title="Cuenta">
            <InfoRow label="Email" value={authUser?.email} />
            <InfoRow label="ID de usuario" value={authUser?.id?.slice(0, 8) + '…'} />
          </Section>

          {/* Security */}
          <Section title="Seguridad">
            <SettingsBtn icon={IC.key} label="Cambiar contraseña maestra"
              sub="Re-cifra toda la bóveda con una nueva clave"
              onClick={() => setChangePwStep(1)} />
            <SettingsBtn icon={IC.sync} label="Sincronizar con la nube"
              sub="Subir la bóveda actual a Supabase"
              onClick={handleManualSync} />
          </Section>

          {/* Vault info */}
          <Section title="Bóveda">
            <InfoRow label="Entradas totales" value={entries.length} />
            <InfoRow label="Cifrado" value="AES-256-GCM" />
            <InfoRow label="Derivación de clave" value={`PBKDF2 · ${PBKDF2_ITERATIONS.toLocaleString()} iter.`} />
            <InfoRow label="Estado sync" value={{ idle: 'Sin cambios', syncing: 'Sincronizando…', synced: 'Sincronizado ✅', error: 'Error ❌', offline: 'Sin conexión 📴' }[syncStatus]} />
          </Section>

          {/* Quick unlock */}
          <Section title="Desbloqueo rápido">
            {quickMode === 'none' && (
              <div style={{ padding: '14px 16px' }}>
                <p style={{ margin: '0 0 12px', fontSize: 12, color: '#475569' }}>Sin desbloqueo rápido activado.</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  {bioSupported && (
                    <button onClick={() => { setSetupMode('biometric'); setPanel('vault') }}
                      style={{ flex: 1, padding: '10px', background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.2)', borderRadius: 9, color: '#93C5FD', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                      <Icon d={IC.faceId} size={14} stroke="#93C5FD" /> Face ID
                    </button>
                  )}
                  <button onClick={() => { setSetupMode('pin'); setSetupStep(1); setSetupPin(''); setSetupPin2(''); setPanel('vault') }}
                    style={{ flex: 1, padding: '10px', background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.2)', borderRadius: 9, color: '#93C5FD', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                    <Icon d={IC.pin} size={14} stroke="#93C5FD" /> PIN 6 dígitos
                  </button>
                </div>
              </div>
            )}
            {quickMode !== 'none' && (
              <div style={{ padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 13, color: '#E2E8F0' }}>
                    {quickMode === 'biometric' ? '✅ Face ID / Touch ID activo' : '✅ PIN de 6 dígitos activo'}
                  </div>
                  <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>Desbloqueo rápido habilitado</div>
                </div>
                <button onClick={handleDisableQuickUnlock}
                  style={{ padding: '7px 12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, color: '#EF4444', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Desactivar
                </button>
              </div>
            )}
          </Section>

          {/* Danger zone */}
          <Section title="Zona peligrosa" danger>
            <button onClick={handleLogout}
              style={{ width: '100%', padding: '12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, color: '#EF4444', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <Icon d={IC.logout} size={16} stroke="#EF4444" />
              Cerrar sesión
            </button>
          </Section>
        </div>
      )}

      {/* ── VAULT PANEL */}
      {panel === 'vault' && (
        <div style={{ display: 'flex', height: 'calc(100dvh - 53px - 60px - env(safe-area-inset-bottom) - env(safe-area-inset-top))', overflow: 'hidden', position: 'relative' }}>

          {/* Sidebar overlay */}
          {sidebarOpen && (
            <div onClick={() => setSidebarOpen(false)}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 150 }} />
          )}

          {/* Sidebar */}
          <aside style={{
            width: 200, flexShrink: 0,
            background: 'rgba(10,13,20,0.97)',
            borderRight: '1px solid rgba(96,165,250,0.08)',
            padding: '12px 0',
            display: 'flex', flexDirection: 'column', gap: 2,
            position: 'fixed',
            left: sidebarOpen ? 0 : -220,
            top: 'calc(53px + env(safe-area-inset-top))',
            bottom: 'calc(60px + env(safe-area-inset-bottom))',
            zIndex: 160,
            transition: 'left 0.25s ease',
            overflowY: 'auto',
          }}>
            <button onClick={() => { setEditCat('password'); setEditData({ title: '' }); setActiveEntry({ mode: 'new', data: {} }); setSidebarOpen(false) }}
              style={{ margin: '0 10px 10px', padding: '10px', background: 'linear-gradient(135deg,#1D4ED8,#1E40AF)', border: '1px solid rgba(96,165,250,0.3)', borderRadius: 10, color: '#E2E8F0', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontFamily: 'inherit', fontWeight: 600 }}>
              <Icon d={IC.plus} size={14} /> Nueva entrada
            </button>
            <SideItem label="Todas" count={entries.length} active={filterCat === 'all'} onClick={() => { setFilterCat('all'); setSidebarOpen(false) }} />
            <div style={{ height: 1, background: 'rgba(96,165,250,0.08)', margin: '6px 10px' }} />
            {CATEGORIES.map(cat => (
              <SideItem key={cat.id} label={cat.label} count={counts[cat.id] || 0}
                active={filterCat === cat.id} color={cat.color} icon={IC[cat.icon]}
                onClick={() => { setFilterCat(cat.id); setSidebarOpen(false) }} />
            ))}
          </aside>

          {/* Entry list */}
          <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
            <div style={{ padding: '10px 12px', borderBottom: '1px solid rgba(96,165,250,0.08)', flexShrink: 0 }}>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#475569', pointerEvents: 'none' }}>
                  <Icon d={IC.search} size={15} />
                </span>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar…"
                  style={{ ...INP, paddingLeft: 32, padding: '9px 10px 9px 32px' }} />
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 7 }}>
              {filtered.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '50px 20px' }}>
                  <Icon d={IC.shield} size={44} stroke="#1E3A5F" />
                  <p style={{ marginTop: 14, fontSize: 13, lineHeight: 1.7, color: '#475569' }}>
                    {entries.length === 0 ? 'Tu bóveda está vacía.\nCrea tu primera entrada.' : 'Sin resultados.'}
                  </p>
                </div>
              ) : filtered.map(e => {
                const cat = getCat(e.category)
                const isActive = activeEntry?.data?.id === e.id
                return (
                  <div key={e.id}
                    onClick={() => { setActiveEntry({ mode: 'view', data: e }); setRevealed({}); setSidebarOpen(false) }}
                    style={{ padding: '12px 14px', borderRadius: 12, cursor: 'pointer', background: isActive ? 'rgba(96,165,250,0.08)' : 'rgba(15,23,42,0.6)', border: `1px solid ${isActive ? 'rgba(96,165,250,0.25)' : 'rgba(96,165,250,0.08)'}`, display: 'flex', alignItems: 'center', gap: 12, transition: 'all 0.15s' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 9, flexShrink: 0, background: `${cat.color}15`, border: `1px solid ${cat.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon d={IC[cat.icon]} size={17} stroke={cat.color} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#E2E8F0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.title}</div>
                      <div style={{ fontSize: 11, color: '#475569', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {e.username || e.ssid || e.cardNumber?.slice(-4).padStart(16, '•') || cat.label}
                      </div>
                    </div>
                    <div style={{ fontSize: 10, color: '#334155', flexShrink: 0 }}>
                      {new Date(e.updatedAt).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}
                    </div>
                  </div>
                )
              })}
            </div>
          </main>

          {/* Detail panel */}
          {activeEntry && (
            <DetailPanel
              mode={activeEntry.mode} data={activeEntry.data}
              editData={editData} setEditData={setEditData}
              editCat={editCat} setEditCat={cat => { setEditCat(cat); setEditData(d => ({ title: d.title })) }}
              revealed={revealed} setRevealed={setRevealed}
              onSave={handleSave}
              onClose={() => { setActiveEntry(null); setEditData({}) }}
              onEdit={() => { setEditData({ ...activeEntry.data }); setEditCat(activeEntry.data.category || 'password'); setActiveEntry({ mode: 'edit', data: activeEntry.data }) }}
              onDelete={() => setDelConfirm(activeEntry.data.id)}
              onCopy={copy}
            />
          )}
        </div>
      )}

      {/* ── BOTTOM TAB BAR */}
      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        paddingBottom: 'max(8px, env(safe-area-inset-bottom))',
        paddingTop: '8px',
        paddingLeft: 'max(8px, env(safe-area-inset-left))',
        paddingRight: 'max(8px, env(safe-area-inset-right))',
        background: 'rgba(10,13,20,0.98)',
        borderTop: '1px solid rgba(96,165,250,0.1)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-around',
        zIndex: 300, backdropFilter: 'blur(12px)',
      }}>
        {[
          { id: 'vault',    label: 'BÓVEDA',   icon: IC.shield,   active: panel === 'vault' && !activeEntry },
          { id: 'add',      label: 'AÑADIR',   icon: IC.plus,     accent: true },
          { id: 'backup',   label: 'BACKUP',   icon: IC.backup,   active: panel === 'backup', warn: bkWarn },
          { id: 'settings', label: 'AJUSTES',  icon: IC.settings, active: panel === 'settings' },
        ].map(tab => (
          <button key={tab.id}
            onClick={() => {
              if (tab.id === 'add') { setEditCat('password'); setEditData({ title: '' }); setActiveEntry({ mode: 'new', data: {} }); setPanel('vault') }
              else { setPanel(tab.id); setActiveEntry(null) }
            }}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
              padding: '6px 14px', borderRadius: 10,
              background: tab.accent ? 'linear-gradient(135deg,#1D4ED8,#1E40AF)' : tab.active ? 'rgba(96,165,250,0.1)' : 'transparent',
              border: `1px solid ${tab.accent ? 'rgba(96,165,250,0.3)' : tab.active ? 'rgba(96,165,250,0.2)' : 'transparent'}`,
              color: tab.accent ? '#E2E8F0' : tab.active ? '#93C5FD' : '#475569',
              cursor: 'pointer', fontFamily: 'inherit',
              boxShadow: tab.accent ? '0 0 16px rgba(29,78,216,0.3)' : 'none',
              position: 'relative',
            }}>
            <Icon d={tab.icon} size={19} stroke={tab.accent ? '#E2E8F0' : tab.active ? '#93C5FD' : '#475569'} />
            <span style={{ fontSize: 9, letterSpacing: '0.5px' }}>{tab.label}</span>
            {tab.warn && <span style={{ position: 'absolute', top: 4, right: 8, width: 7, height: 7, borderRadius: '50%', background: '#F59E0B', boxShadow: '0 0 5px rgba(245,158,11,0.7)' }} />}
          </button>
        ))}
      </nav>

      {/* Delete confirm */}
      {delConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 20 }}>
          <div style={{ background: '#0F172A', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 16, padding: '24px 28px', maxWidth: 340, width: '100%' }}>
            <h3 style={{ margin: '0 0 10px', color: '#FCA5A5', fontSize: 15 }}>¿Eliminar entrada?</h3>
            <p style={{ margin: '0 0 20px', color: '#64748B', fontSize: 12 }}>Esta acción no se puede deshacer.</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setDelConfirm(null)} style={SBTN}>Cancelar</button>
              <button onClick={() => handleDelete(delConfirm)} style={{ ...SBTN, flex: 1, background: 'rgba(239,68,68,0.15)', borderColor: 'rgba(239,68,68,0.3)', color: '#EF4444' }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}

      <style>{CSS}</style>
    </div>
  )
}

// ─── DETAIL PANEL ──────────────────────────────────────────────────────────
function DetailPanel({ mode, data, editData, setEditData, editCat, setEditCat, revealed, setRevealed, onSave, onClose, onEdit, onDelete, onCopy }) {
  const isView = mode === 'view'
  const cat    = getCat(isView ? (data?.category || 'password') : editCat)
  const fields = FIELDS[cat.id] || FIELDS.password

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(10,14,22,0.99)', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 'max(14px, calc(14px + env(safe-area-inset-top)))', paddingBottom: '14px', paddingLeft: '16px', paddingRight: '16px', borderBottom: '1px solid rgba(96,165,250,0.1)', position: 'sticky', top: 0, background: 'rgba(10,14,22,0.99)', zIndex: 10, flexShrink: 0 }}>
        <button onClick={onClose} style={IBTN}><Icon d={IC.chevronL} size={18} stroke="#64748B" /></button>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: `${cat.color}15`, border: `1px solid ${cat.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon d={IC[cat.icon]} size={15} stroke={cat.color} />
        </div>
        <span style={{ flex: 1, fontSize: 13, color: '#94A3B8', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {!isView ? (mode === 'new' ? 'Nueva entrada' : 'Editar') : (data?.title || 'Detalle')}
        </span>
        {isView && (
          <div style={{ display: 'flex', gap: 6 }}>
            <SmBtn icon={IC.edit} onClick={onEdit} />
            <SmBtn icon={IC.trash} onClick={onDelete} danger />
          </div>
        )}
      </div>

      <div style={{ flex: 1, padding: '16px', paddingBottom: 'calc(16px + 80px + env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 600, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>

        {!isView && mode === 'new' && (
          <div>
            <label style={LBL}>Categoría</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {CATEGORIES.map(c => (
                <button key={c.id} onClick={() => setEditCat(c.id)} style={{ padding: '6px 12px', borderRadius: 8, fontSize: 12, background: editCat === c.id ? `${c.color}20` : 'rgba(15,23,42,0.6)', border: `1px solid ${editCat === c.id ? c.color + '50' : 'rgba(96,165,250,0.1)'}`, color: editCat === c.id ? c.color : '#64748B', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Icon d={IC[c.icon]} size={12} stroke={editCat === c.id ? c.color : '#64748B'} />
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <label style={LBL}>Título</label>
          {isView
            ? <p style={VAL}>{data?.title}</p>
            : <input value={editData.title || ''} onChange={e => setEditData(p => ({ ...p, title: e.target.value }))} placeholder="Nombre de la entrada" style={INP} autoFocus />}
        </div>

        {fields.map(f => {
          const v      = isView ? data?.[f.key] : editData[f.key]
          if (isView && !v) return null
          const secret = f.type === 'password'
          const shown  = revealed[f.key]
          return (
            <div key={f.key}>
              <label style={LBL}>{f.label}</label>
              {isView ? (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ flex: 1, padding: '9px 11px', background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(96,165,250,0.08)', borderRadius: 9, fontSize: 13, color: '#94A3B8', wordBreak: 'break-all', fontFamily: 'inherit', lineHeight: 1.5 }}>
                    {secret && !shown ? '•'.repeat(Math.min((v || '').length, 16)) : (v || '—')}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flexShrink: 0 }}>
                    {secret && <SmBtn icon={shown ? IC.eyeOff : IC.eye} onClick={() => setRevealed(p => ({ ...p, [f.key]: !p[f.key] }))} />}
                    {v && <SmBtn icon={IC.copy} onClick={() => onCopy(v)} />}
                  </div>
                </div>
              ) : (
                <div>
                  {f.type === 'textarea'
                    ? <textarea value={editData[f.key] || ''} onChange={e => setEditData(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder} rows={3} style={{ ...INP, resize: 'vertical', minHeight: 72 }} />
                    : (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <input type={secret && !revealed[f.key] ? 'password' : 'text'}
                          value={editData[f.key] || ''}
                          onChange={e => setEditData(p => ({ ...p, [f.key]: e.target.value }))}
                          placeholder={f.placeholder}
                          style={{ ...INP, flex: 1 }} />
                        {secret && (
                          <>
                            <SmBtn icon={revealed[f.key] ? IC.eyeOff : IC.eye} onClick={() => setRevealed(p => ({ ...p, [f.key]: !p[f.key] }))} />
                            <SmBtn icon={IC.refresh} title="Generar" onClick={() => setEditData(p => ({ ...p, [f.key]: genPassword() }))} />
                          </>
                        )}
                      </div>
                    )}
                  {secret && editData[f.key] && (() => {
                    const s = pwStrength(editData[f.key])
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5 }}>
                        <div style={{ flex: 1, height: 2, background: '#1E293B', borderRadius: 99, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${(s.score / 5) * 100}%`, background: s.color, borderRadius: 99 }} />
                        </div>
                        <span style={{ fontSize: 10, color: s.color, whiteSpace: 'nowrap' }}>{s.label}</span>
                      </div>
                    )
                  })()}
                </div>
              )}
            </div>
          )
        })}

        {isView && data?.createdAt && (
          <div style={{ paddingTop: 14, borderTop: '1px solid rgba(96,165,250,0.08)' }}>
            <div style={{ fontSize: 10, color: '#334155', lineHeight: 2 }}>
              <div>Creado: {new Date(data.createdAt).toLocaleString('es-ES')}</div>
              <div>Modificado: {new Date(data.updatedAt).toLocaleString('es-ES')}</div>
              <div style={{ marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', background: `${getCat(data.category).color}10`, border: `1px solid ${getCat(data.category).color}30`, borderRadius: 6 }}>
                <Icon d={IC[getCat(data.category).icon]} size={11} stroke={getCat(data.category).color} />
                <span style={{ color: getCat(data.category).color, fontSize: 10 }}>{getCat(data.category).label}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {!isView && (
        <div style={{ padding: '12px 16px', paddingBottom: 'calc(12px + env(safe-area-inset-bottom))', borderTop: '1px solid rgba(96,165,250,0.08)', background: 'rgba(10,14,22,0.99)', position: 'sticky', bottom: 0, flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 8, maxWidth: 600, margin: '0 auto' }}>
            <button onClick={onClose} style={SBTN}>Cancelar</button>
            <button onClick={onSave} style={{ ...SBTN, flex: 1, background: 'linear-gradient(135deg,#1D4ED8,#1E40AF)', borderColor: 'rgba(96,165,250,0.3)', color: '#E2E8F0' }}>Guardar</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── SMALL COMPONENTS ──────────────────────────────────────────────────────
function PwField({ label, value, onChange, show, onToggle, onKeyDown, autoFocus }) {
  return (
    <div style={{ width: '100%' }}>
      <label style={LBL}>{label}</label>
      <div style={{ position: 'relative', width: '100%' }}>
        <input type={show ? 'text' : 'password'} value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={onKeyDown} autoFocus={autoFocus}
          autoComplete="current-password"
          style={{ ...INP, paddingRight: 44, fontSize: 16 }} />
        <button onClick={onToggle} type="button"
          style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#475569', padding: 4, touchAction: 'manipulation' }}>
          <Icon d={show ? IC.eyeOff : IC.eye} size={18} />
        </button>
      </div>
    </div>
  )
}

function Toast({ msg, type }) {
  const bg = type === 'error' ? 'rgba(239,68,68,0.95)' : type === 'info' ? 'rgba(59,130,246,0.95)' : 'rgba(16,185,129,0.95)'
  return (
    <div style={{ position: 'fixed', top: 'calc(16px + env(safe-area-inset-top))', left: '50%', transform: 'translateX(-50%)', background: bg, color: '#fff', padding: '10px 18px', borderRadius: 10, fontSize: 13, zIndex: 9999, boxShadow: '0 4px 20px rgba(0,0,0,0.4)', fontFamily: "'DM Mono',monospace", whiteSpace: 'nowrap', maxWidth: '90vw', overflow: 'hidden', textOverflow: 'ellipsis', animation: 'fadeIn 0.2s ease' }}>
      {msg}
    </div>
  )
}

function SideItem({ label, count, active, onClick, color, icon }) {
  return (
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 14px', margin: '0 8px', background: active ? 'rgba(96,165,250,0.1)' : 'transparent', border: active ? '1px solid rgba(96,165,250,0.15)' : '1px solid transparent', borderRadius: 8, cursor: 'pointer', width: 'calc(100% - 16px)', fontFamily: 'inherit' }}>
      {icon && <Icon d={icon} size={13} stroke={color || '#64748B'} />}
      <span style={{ flex: 1, fontSize: 12, color: active ? '#E2E8F0' : '#64748B' }}>{label}</span>
      {count > 0 && <span style={{ fontSize: 10, padding: '1px 5px', background: active ? 'rgba(96,165,250,0.2)' : 'rgba(96,165,250,0.05)', borderRadius: 99, color: active ? '#93C5FD' : '#475569' }}>{count}</span>}
    </button>
  )
}

function SmBtn({ icon, onClick, danger, title }) {
  return (
    <button onClick={onClick} title={title} style={{ padding: 7, background: 'rgba(15,23,42,0.8)', border: `1px solid ${danger ? 'rgba(239,68,68,0.2)' : 'rgba(96,165,250,0.1)'}`, borderRadius: 7, cursor: 'pointer', color: danger ? '#EF4444' : '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, touchAction: 'manipulation' }}>
      <Icon d={icon} size={14} />
    </button>
  )
}

function BackupCard({ icon, color, title, sub, desc, btnLabel, onClick }) {
  return (
    <div style={{ padding: '18px', borderRadius: 14, background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(96,165,250,0.12)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: 9, background: `${color}15`, border: `1px solid ${color}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon d={icon} size={16} stroke={color} />
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#E2E8F0' }}>{title}</div>
          <div style={{ fontSize: 10, color: '#475569' }}>{sub}</div>
        </div>
      </div>
      <p style={{ fontSize: 11, color: '#475569', lineHeight: 1.6, margin: '0 0 14px' }}>{desc}</p>
      <button onClick={onClick} style={{ width: '100%', padding: '10px', background: `${color}15`, border: `1px solid ${color}30`, borderRadius: 8, color, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
        <Icon d={icon} size={13} stroke={color} />
        {btnLabel}
      </button>
    </div>
  )
}

function Section({ title, children, danger }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{ margin: '0 0 10px', fontSize: 11, color: danger ? '#EF4444' : '#475569', letterSpacing: '2px', textTransform: 'uppercase' }}>{title}</h3>
      <div style={{ background: 'rgba(15,23,42,0.6)', border: `1px solid ${danger ? 'rgba(239,68,68,0.15)' : 'rgba(96,165,250,0.08)'}`, borderRadius: 12, overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  )
}

function InfoRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid rgba(96,165,250,0.05)' }}>
      <span style={{ fontSize: 12, color: '#475569' }}>{label}</span>
      <span style={{ fontSize: 12, color: '#94A3B8', textAlign: 'right', maxWidth: '60%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
    </div>
  )
}

function SettingsBtn({ icon, label, sub, onClick }) {
  return (
    <button onClick={onClick} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: 'none', border: 'none', borderBottom: '1px solid rgba(96,165,250,0.05)', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
      <div style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon d={icon} size={16} stroke="#60A5FA" />
      </div>
      <div>
        <div style={{ fontSize: 13, color: '#E2E8F0', fontWeight: 500 }}>{label}</div>
        <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>{sub}</div>
      </div>
      <Icon d={IC.chevronL} size={14} stroke="#334155" style={{ marginLeft: 'auto', transform: 'rotate(180deg)' }} />
    </button>
  )
}

// ─── PIN PAD ───────────────────────────────────────────────────────────────
function PINPad({ value, onChange, onSubmit, disabled, error }) {
  const dots = Array(6).fill(0).map((_, i) => i < value.length)

  const press = (digit) => {
    if (disabled) return
    const next = value + digit
    if (next.length <= 6) {
      onChange(next)
      if (next.length === 6) onSubmit(next)
    }
  }

  const del = () => {
    if (disabled) return
    onChange(value.slice(0, -1))
  }

  return (
    <div style={{ width: '100%', maxWidth: 280, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
      {/* Dots */}
      <div style={{ display: 'flex', gap: 12 }}>
        {dots.map((filled, i) => (
          <div key={i} style={{ width: 14, height: 14, borderRadius: '50%', background: filled ? '#60A5FA' : 'rgba(96,165,250,0.15)', border: '1px solid rgba(96,165,250,0.3)', transition: 'all 0.15s' }} />
        ))}
      </div>

      {/* Error */}
      {error && <p style={{ margin: 0, fontSize: 12, color: '#EF4444', textAlign: 'center' }}>{error}</p>}

      {/* Keypad */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, width: '100%' }}>
        {[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map((k, i) => (
          <button key={i}
            onClick={() => k === '⌫' ? del() : k !== '' && press(String(k))}
            disabled={disabled || k === ''}
            style={{
              padding: '16px 0',
              background: k === '⌫' ? 'rgba(239,68,68,0.08)' : k === '' ? 'transparent' : 'rgba(96,165,250,0.06)',
              border: k === '' ? 'none' : `1px solid ${k === '⌫' ? 'rgba(239,68,68,0.2)' : 'rgba(96,165,250,0.15)'}`,
              borderRadius: 12,
              color: k === '⌫' ? '#EF4444' : '#E2E8F0',
              fontSize: k === '⌫' ? 20 : 22,
              fontWeight: 600,
              cursor: k === '' || disabled ? 'default' : 'pointer',
              fontFamily: 'inherit',
              touchAction: 'manipulation',
              opacity: disabled ? 0.5 : 1,
            }}>
            {k}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── STYLES ────────────────────────────────────────────────────────────────
const LBL  = { display: 'block', fontSize: 10, color: '#475569', marginBottom: 5, letterSpacing: '1px', textTransform: 'uppercase' }
const VAL  = { margin: 0, fontSize: 13, color: '#94A3B8', wordBreak: 'break-all', fontFamily: 'inherit', lineHeight: 1.5 }
const INP  = { width: '100%', padding: '10px 12px', background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(96,165,250,0.15)', borderRadius: 9, color: '#E2E8F0', fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none' }
const IBTN = { padding: 7, background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(96,165,250,0.1)', borderRadius: 8, cursor: 'pointer', color: '#64748B', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, touchAction: 'manipulation' }
const SBTN = { padding: '11px 16px', background: '#1E293B', border: '1px solid rgba(96,165,250,0.1)', borderRadius: 9, color: '#94A3B8', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { height: 100%; overflow-x: hidden; }
  body { background: #0A0D14; }
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(96,165,250,0.2); border-radius: 99px; }
  input, textarea, button { font-family: inherit; }
  input::placeholder, textarea::placeholder { color: #334155; }
  input:focus, textarea:focus { border-color: rgba(96,165,250,0.4) !important; outline: none !important; }
  textarea { resize: vertical; }
  @keyframes fadeIn {
    from { opacity:0; transform:translateX(-50%) translateY(-6px); }
    to   { opacity:1; transform:translateX(-50%) translateY(0); }
  }
  @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  @media(min-width: 640px) {
    aside { position: static !important; left: auto !important; }
  }
`
