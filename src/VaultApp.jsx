import { useState, useEffect, useCallback, useRef } from "react";

// ─── CRYPTO ENGINE ─────────────────────────────────────────────────────
const PBKDF2_ITERATIONS = 310000;
const SALT_LEN = 32;
const IV_LEN = 12;

async function deriveKey(password, salt) {
  const enc = new TextEncoder();
  const km = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name:"PBKDF2", salt, iterations:PBKDF2_ITERATIONS, hash:"SHA-256" },
    km, { name:"AES-GCM", length:256 }, false, ["encrypt","decrypt"]
  );
}

async function encryptVault(data, password) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LEN));
  const iv   = crypto.getRandomValues(new Uint8Array(IV_LEN));
  const key  = await deriveKey(password, salt);
  const enc  = new TextEncoder();
  const ct   = await crypto.subtle.encrypt({ name:"AES-GCM", iv }, key, enc.encode(JSON.stringify(data)));
  const out  = new Uint8Array(SALT_LEN + IV_LEN + ct.byteLength);
  out.set(salt,0); out.set(iv,SALT_LEN); out.set(new Uint8Array(ct), SALT_LEN+IV_LEN);
  return btoa(String.fromCharCode(...out));
}

async function decryptVault(b64, password) {
  const raw = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  const salt = raw.slice(0, SALT_LEN);
  const iv   = raw.slice(SALT_LEN, SALT_LEN+IV_LEN);
  const ct   = raw.slice(SALT_LEN+IV_LEN);
  const key  = await deriveKey(password, salt);
  const dec  = new TextDecoder();
  const plain = await crypto.subtle.decrypt({ name:"AES-GCM", iv }, key, ct);
  return JSON.parse(dec.decode(plain));
}

// ─── STORAGE ───────────────────────────────────────────────────────────
const STORAGE_KEY    = "vlt_enc";
const BACKUP_LOG_KEY = "vlt_backup_log";
function saveEncrypted(b64) { localStorage.setItem(STORAGE_KEY, b64); }
function loadEncrypted()    { return localStorage.getItem(STORAGE_KEY); }
function loadBackupLog()    { try { return JSON.parse(localStorage.getItem(BACKUP_LOG_KEY)||"[]"); } catch { return []; } }
function saveBackupLog(log) { localStorage.setItem(BACKUP_LOG_KEY, JSON.stringify(log)); }
function addBackupEntry(count) {
  const log = loadBackupLog();
  log.unshift({ date: new Date().toISOString(), entries: count });
  saveBackupLog(log.slice(0,10));
}

// ─── ICONS ─────────────────────────────────────────────────────────────
const Icon = ({ d, size=20, stroke="currentColor", fill="none", strokeWidth=1.8 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    {Array.isArray(d) ? d.map((p,i)=><path key={i} d={p}/>) : <path d={d}/>}
  </svg>
);

const icons = {
  lock:     "M19 11H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2zM7 11V7a5 5 0 0110 0v4",
  eye:      ["M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z","M12 9a3 3 0 100 6 3 3 0 000-6z"],
  eyeOff:   ["M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22"],
  plus:     "M12 5v14M5 12h14",
  trash:    ["M3 6h18","M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"],
  copy:     ["M20 9H11a2 2 0 00-2 2v9a2 2 0 002 2h9a2 2 0 002-2v-9a2 2 0 00-2-2z","M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"],
  download: ["M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4","M7 10l5 5 5-5","M12 15V3"],
  upload:   ["M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4","M17 8l-5-5-5 5","M12 3v12"],
  search:   ["M11 17.25a6.25 6.25 0 110-12.5 6.25 6.25 0 010 12.5z","M16 16l4.5 4.5"],
  shield:   "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  key:      ["M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"],
  wifi:     "M5 12.55a11 11 0 0114.08 0M1.42 9a16 16 0 0121.16 0M8.53 16.11a6 6 0 016.95 0M12 20h.01",
  globe:    ["M12 2a10 10 0 100 20A10 10 0 0012 2z","M2 12h20","M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20"],
  card:     ["M1 4h22v16H1z","M1 9h22"],
  note:     ["M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z","M14 2v6h6","M16 13H8","M16 17H8","M10 9H8"],
  edit:     ["M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7","M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"],
  check:    "M20 6L9 17l-5-5",
  x:        "M18 6L6 18M6 6l12 12",
  refresh:  "M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15",
  clock:    ["M12 2a10 10 0 100 20A10 10 0 0012 2z","M12 6v6l4 2"],
  info:     ["M12 2a10 10 0 100 20A10 10 0 0012 2z","M12 16v-4","M12 8h.01"],
  database: ["M12 2C6.48 2 2 4.24 2 7s4.48 5 10 5 10-2.24 10-5-4.48-5-10-5z","M2 7v5c0 2.76 4.48 5 10 5s10-2.24 10-5V7","M2 12v5c0 2.76 4.48 5 10 5s10-2.24 10-5v-5"],
  alertTri: ["M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z","M12 9v4","M12 17h.01"],
  backup:   ["M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4","M7 10l5 5 5-5","M12 15V3"],
};

// ─── CATEGORIES ────────────────────────────────────────────────────────
const CATEGORIES = [
  { id:"password", label:"Contraseñas",  icon:"key",   color:"#60A5FA" },
  { id:"card",     label:"Tarjetas",      icon:"card",  color:"#F472B6" },
  { id:"wifi",     label:"Redes WiFi",    icon:"wifi",  color:"#34D399" },
  { id:"note",     label:"Notas seguras", icon:"note",  color:"#FBBF24" },
  { id:"identity", label:"Identidades",   icon:"globe", color:"#A78BFA" },
];

const FIELD_TEMPLATES = {
  password: [
    { key:"url",      label:"URL / Sitio web",    type:"text",     icon:"globe" },
    { key:"username", label:"Usuario / Email",     type:"text",     icon:"key"   },
    { key:"password", label:"Contraseña",          type:"password", icon:"lock"  },
    { key:"notes",    label:"Notas",               type:"textarea", icon:"note"  },
  ],
  card: [
    { key:"cardNumber", label:"Número de tarjeta",   type:"text",     icon:"card" },
    { key:"holder",     label:"Titular",             type:"text",     icon:"key"  },
    { key:"expiry",     label:"Vencimiento (MM/AA)", type:"text",     icon:"key"  },
    { key:"cvv",        label:"CVV",                 type:"password", icon:"lock" },
    { key:"pin",        label:"PIN",                 type:"password", icon:"lock" },
    { key:"notes",      label:"Notas",               type:"textarea", icon:"note" },
  ],
  wifi: [
    { key:"ssid",     label:"Nombre de red (SSID)",  type:"text",     icon:"wifi"   },
    { key:"password", label:"Contraseña",            type:"password", icon:"lock"   },
    { key:"security", label:"Seguridad (WPA2/WPA3)", type:"text",     icon:"shield" },
    { key:"notes",    label:"Notas",                 type:"textarea", icon:"note"   },
  ],
  note:     [{ key:"content", label:"Contenido", type:"textarea", icon:"note" }],
  identity: [
    { key:"fullName", label:"Nombre completo",  type:"text",     icon:"key"  },
    { key:"idNumber", label:"Nº Documento",     type:"text",     icon:"key"  },
    { key:"dob",      label:"Fecha nacimiento", type:"text",     icon:"key"  },
    { key:"address",  label:"Dirección",        type:"textarea", icon:"note" },
    { key:"phone",    label:"Teléfono",         type:"text",     icon:"key"  },
    { key:"notes",    label:"Notas",            type:"textarea", icon:"note" },
  ],
};

// ─── UTILS ─────────────────────────────────────────────────────────────
function generatePassword(length=20) {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()-_=+[]{}";
  return Array.from(crypto.getRandomValues(new Uint8Array(length))).map(b=>chars[b%chars.length]).join("");
}

function passwordStrength(pw) {
  if (!pw) return { score:0, label:"", color:"#374151" };
  let score = 0;
  if (pw.length>=8) score++; if (pw.length>=16) score++;
  if (/[A-Z]/.test(pw)) score++; if (/[0-9]/.test(pw)) score++; if (/[^A-Za-z0-9]/.test(pw)) score++;
  const map = [
    {label:"Muy débil",color:"#EF4444"},{label:"Débil",color:"#F97316"},
    {label:"Regular",color:"#EAB308"},{label:"Buena",color:"#84CC16"},
    {label:"Fuerte",color:"#22C55E"},{label:"Muy fuerte",color:"#10B981"},
  ];
  return { score, ...map[score] };
}

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("es-ES",{day:"2-digit",month:"short",year:"numeric"})
    + " · " + d.toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit"});
}

function daysSince(iso) {
  if (!iso) return null;
  return Math.floor((Date.now()-new Date(iso).getTime())/(1000*60*60*24));
}

// ─── MAIN APP ──────────────────────────────────────────────────────────
export default function VaultApp() {
  const [phase,setPhase]                   = useState("boot");
  const [masterPw,setMasterPw]             = useState("");
  const [confirmPw,setConfirmPw]           = useState("");
  const [showPw,setShowPw]                 = useState(false);
  const [entries,setEntries]               = useState([]);
  const [search,setSearch]                 = useState("");
  const [filterCat,setFilterCat]           = useState("all");
  const [activeEntry,setActiveEntry]       = useState(null);
  const [activePanel,setActivePanel]       = useState("vault");
  const [toast,setToast]                   = useState(null);
  const [loading,setLoading]               = useState(false);
  const [revealFields,setRevealFields]     = useState({});
  const [editData,setEditData]             = useState({});
  const [selectedCat,setSelectedCat]       = useState("password");
  const [showDeleteConfirm,setShowDeleteConfirm] = useState(null);
  const [backupLog,setBackupLog]           = useState([]);
  const [importLoading,setImportLoading]   = useState(false);
  const autoLockRef = useRef(null);

  useEffect(() => {
    setPhase(loadEncrypted() ? "unlock" : "setup");
    setBackupLog(loadBackupLog());
  }, []);

  const resetAutoLock = useCallback(() => {
    if (autoLockRef.current) clearTimeout(autoLockRef.current);
    autoLockRef.current = setTimeout(() => {
      setPhase("unlock"); setEntries([]); setMasterPw("");
      showToast("🔒 Bóveda bloqueada por inactividad","info");
    }, 3*60*1000);
  },[]);

  useEffect(() => {
    if (phase!=="vault") return;
    const evts = ["mousemove","keydown","touchstart","click"];
    evts.forEach(e=>window.addEventListener(e,resetAutoLock));
    resetAutoLock();
    return ()=>evts.forEach(e=>window.removeEventListener(e,resetAutoLock));
  },[phase,resetAutoLock]);

  const showToast = (msg,type="success") => {
    setToast({msg,type}); setTimeout(()=>setToast(null),3500);
  };

  const persistVault = useCallback(async(data,pw) => {
    const enc = await encryptVault(data,pw); saveEncrypted(enc);
  },[]);

  const handleSetup = async() => {
    if (masterPw.length<8) return showToast("Mínimo 8 caracteres","error");
    if (masterPw!==confirmPw) return showToast("Las contraseñas no coinciden","error");
    setLoading(true); await persistVault([],masterPw); setLoading(false);
    setEntries([]); setPhase("vault"); showToast("✅ Bóveda creada correctamente");
  };

  const handleUnlock = async() => {
    if (!masterPw) return; setLoading(true);
    try {
      const data = await decryptVault(loadEncrypted(),masterPw);
      setEntries(data); setPhase("vault"); showToast("✅ Bóveda desbloqueada");
    } catch { showToast("Contraseña maestra incorrecta","error"); }
    setLoading(false);
  };

  const handleSaveEntry = async() => {
    if (!editData.title?.trim()) return showToast("El título es obligatorio","error");
    let updated;
    if (activeEntry.mode==="new") {
      updated = [...entries,{...editData,id:Date.now().toString(),category:selectedCat,
        createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()}];
    } else {
      updated = entries.map(e=>e.id===activeEntry.data.id
        ?{...e,...editData,updatedAt:new Date().toISOString()}:e);
    }
    setEntries(updated); await persistVault(updated,masterPw);
    setActiveEntry(null); setEditData({}); showToast("✅ Entrada guardada");
  };

  const handleDelete = async(id) => {
    const updated = entries.filter(e=>e.id!==id);
    setEntries(updated); await persistVault(updated,masterPw);
    setActiveEntry(null); setShowDeleteConfirm(null); showToast("🗑️ Entrada eliminada");
  };

  const handleExport = async() => {
    const stored = loadEncrypted();
    if (!stored) return showToast("No hay datos para exportar","error");
    const payload = { version:"1.0", app:"VAULT", exportedAt:new Date().toISOString(), entries:entries.length, vault:stored };
    const blob = new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href=url; a.download=`vault-backup-${new Date().toISOString().slice(0,10)}.vault`; a.click();
    URL.revokeObjectURL(url);
    addBackupEntry(entries.length); setBackupLog(loadBackupLog());
    showToast(`📦 Backup de ${entries.length} entradas exportado`);
  };

  const handleImport = (e) => {
    const file = e.target.files[0]; if (!file) return;
    setImportLoading(true);
    const reader = new FileReader();
    reader.onload = async(ev) => {
      try {
        const parsed   = JSON.parse(ev.target.result);
        const vaultData = parsed.vault || parsed;
        const data = await decryptVault(typeof vaultData==="string"?vaultData:JSON.stringify(vaultData),masterPw);
        setEntries(data); await persistVault(data,masterPw);
        showToast(`✅ ${data.length} entradas restauradas`);
      } catch { showToast("Error: contraseña incorrecta o archivo dañado","error"); }
      setImportLoading(false);
    };
    reader.readAsText(file); e.target.value="";
  };

  const copyToClipboard = (val) => { navigator.clipboard.writeText(val); showToast("📋 Copiado al portapapeles"); };
  const getCatConfig = (id) => CATEGORIES.find(c=>c.id===id)||CATEGORIES[0];

  const filteredEntries = entries.filter(e=>{
    const matchCat = filterCat==="all"||e.category===filterCat;
    const q = search.toLowerCase();
    const matchSearch = !q||e.title?.toLowerCase().includes(q)||
      Object.values(e).some(v=>typeof v==="string"&&v.toLowerCase().includes(q));
    return matchCat&&matchSearch;
  });
  const catCounts = {};
  entries.forEach(e=>{ catCounts[e.category]=(catCounts[e.category]||0)+1; });

  const lastBackup  = backupLog[0];
  const daysSinceBk = daysSince(lastBackup?.date);
  const bkWarn      = daysSinceBk===null||daysSinceBk>7;

  const bgGrid = {
    position:"fixed",inset:0,
    backgroundImage:"linear-gradient(rgba(96,165,250,0.03) 1px, transparent 1px),linear-gradient(90deg, rgba(96,165,250,0.03) 1px, transparent 1px)",
    backgroundSize:"40px 40px",pointerEvents:"none",zIndex:0,
  };
  const appBase = {
    minHeight:"100vh",background:"#0A0D14",color:"#E2E8F0",
    fontFamily:"'DM Mono','Fira Code','Courier New',monospace",
    position:"relative",overflowX:"hidden",
  };

  // ── BOOT
  if (phase==="boot") return (
    <div style={{...appBase,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={bgGrid}/>
      <div style={{position:"relative",zIndex:1,textAlign:"center"}}>
        <div style={{fontSize:48}}>🔐</div>
        <p style={{color:"#64748B",marginTop:8}}>Iniciando bóveda…</p>
      </div>
    </div>
  );

  // ── SETUP / UNLOCK
  if (phase==="setup"||phase==="unlock") {
    const isSetup  = phase==="setup";
    const strength = isSetup?passwordStrength(masterPw):null;
    return (
      <div style={{...appBase,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
        <div style={bgGrid}/>
        <div style={{position:"fixed",top:"20%",left:"50%",transform:"translateX(-50%)",width:400,height:400,borderRadius:"50%",background:"radial-gradient(circle,rgba(96,165,250,0.08) 0%,transparent 70%)",pointerEvents:"none",zIndex:0}}/>
        <div style={{position:"relative",zIndex:1,width:"100%",maxWidth:400,background:"rgba(15,20,30,0.95)",border:"1px solid rgba(96,165,250,0.15)",borderRadius:20,padding:"40px 36px",boxShadow:"0 0 60px rgba(96,165,250,0.05),0 24px 48px rgba(0,0,0,0.5)"}}>
          <div style={{textAlign:"center",marginBottom:36}}>
            <div style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:72,height:72,borderRadius:20,background:"linear-gradient(135deg,#1E3A5F 0%,#0F172A 100%)",border:"1px solid rgba(96,165,250,0.3)",marginBottom:20,boxShadow:"0 0 30px rgba(96,165,250,0.1)"}}>
              <Icon d={icons.shield} size={36} stroke="#60A5FA"/>
            </div>
            <h1 style={{margin:0,fontSize:22,fontWeight:700,color:"#F1F5F9",letterSpacing:"-0.5px"}}>VAULT</h1>
            <p style={{margin:"6px 0 0",fontSize:12,color:"#475569",letterSpacing:"3px",textTransform:"uppercase"}}>
              {isSetup?"Configuración inicial":"Acceso seguro"}
            </p>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:16}}>
            {isSetup&&(
              <div style={{background:"rgba(96,165,250,0.05)",border:"1px solid rgba(96,165,250,0.1)",borderRadius:10,padding:"12px 14px",fontSize:12,color:"#64748B",lineHeight:1.6}}>
                🔐 AES-256-GCM · PBKDF2 · {PBKDF2_ITERATIONS.toLocaleString()} iteraciones<br/>
                Tu contraseña maestra <strong style={{color:"#94A3B8"}}>nunca sale del dispositivo</strong>
              </div>
            )}
            <PasswordField label="Contraseña maestra" value={masterPw} onChange={setMasterPw} show={showPw} onToggle={()=>setShowPw(p=>!p)} autoFocus onKeyDown={e=>e.key==="Enter"&&(isSetup?confirmPw&&handleSetup():handleUnlock())}/>
            {isSetup&&strength?.label&&(
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <div style={{flex:1,height:3,background:"#1E293B",borderRadius:99,overflow:"hidden"}}>
                  <div style={{height:"100%",borderRadius:99,width:`${(strength.score/5)*100}%`,background:strength.color,transition:"all 0.3s ease"}}/>
                </div>
                <span style={{fontSize:11,color:strength.color,minWidth:80}}>{strength.label}</span>
              </div>
            )}
            {isSetup&&(
              <PasswordField label="Confirmar contraseña" value={confirmPw} onChange={setConfirmPw} show={showPw} onToggle={()=>setShowPw(p=>!p)} onKeyDown={e=>e.key==="Enter"&&masterPw&&handleSetup()}/>
            )}
            <button onClick={isSetup?handleSetup:handleUnlock} disabled={loading||!masterPw} style={{width:"100%",padding:"14px",background:loading||!masterPw?"rgba(96,165,250,0.1)":"linear-gradient(135deg,#1D4ED8 0%,#1E40AF 100%)",border:"1px solid rgba(96,165,250,0.3)",borderRadius:10,color:"#E2E8F0",fontSize:14,fontWeight:600,cursor:loading||!masterPw?"not-allowed":"pointer",letterSpacing:"1px",textTransform:"uppercase",fontFamily:"inherit",transition:"all 0.2s"}}>
              {loading?"⏳ Procesando…":isSetup?"Crear Bóveda":"Desbloquear"}
            </button>
          </div>
          <div style={{textAlign:"center",marginTop:24,color:"#334155",fontSize:11}}>Cifrado de extremo a extremo · Sin servidores externos</div>
        </div>
      </div>
    );
  }

  // ── VAULT UI
  return (
    <div style={{...appBase,display:"flex",flexDirection:"column",alignItems:"center"}}>
      <div style={bgGrid}/>

      {toast&&(
        <div style={{position:"fixed",top:20,left:"50%",transform:"translateX(-50%)",background:toast.type==="error"?"rgba(239,68,68,0.95)":toast.type==="info"?"rgba(59,130,246,0.95)":"rgba(16,185,129,0.95)",color:"#fff",padding:"10px 20px",borderRadius:10,fontSize:13,zIndex:9999,boxShadow:"0 4px 20px rgba(0,0,0,0.4)",fontFamily:"inherit",letterSpacing:"0.3px",animation:"fadeIn 0.2s ease",whiteSpace:"nowrap"}}>
          {toast.msg}
        </div>
      )}

      <div style={{width:"100%",maxWidth:960,position:"relative",zIndex:1,display:"flex",flexDirection:"column",minHeight:"100vh"}}>

        {/* HEADER */}
        <header style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 20px",background:"rgba(10,13,20,0.97)",borderBottom:"1px solid rgba(96,165,250,0.1)",backdropFilter:"blur(10px)",position:"sticky",top:0,zIndex:100}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <Icon d={icons.shield} size={22} stroke="#60A5FA"/>
            <span style={{fontSize:16,fontWeight:700,color:"#F1F5F9",letterSpacing:"2px"}}>VAULT</span>
            <span style={{fontSize:10,padding:"2px 6px",background:"rgba(96,165,250,0.1)",border:"1px solid rgba(96,165,250,0.2)",borderRadius:4,color:"#60A5FA"}}>{entries.length} entradas</span>
          </div>
          <div style={{display:"flex",gap:4}}>
            {[{id:"vault",label:"Bóveda",icon:icons.database},{id:"backup",label:"Backup",icon:icons.backup,warn:bkWarn}].map(tab=>(
              <button key={tab.id} onClick={()=>setActivePanel(tab.id)} style={{display:"flex",alignItems:"center",gap:6,padding:"7px 14px",borderRadius:8,background:activePanel===tab.id?"rgba(96,165,250,0.12)":"transparent",border:`1px solid ${activePanel===tab.id?"rgba(96,165,250,0.25)":"transparent"}`,color:activePanel===tab.id?"#93C5FD":"#475569",cursor:"pointer",fontSize:12,fontFamily:"inherit",fontWeight:activePanel===tab.id?600:400,position:"relative"}}>
                <Icon d={tab.icon} size={14} stroke={activePanel===tab.id?"#93C5FD":"#475569"}/>
                {tab.label}
                {tab.warn&&<span style={{position:"absolute",top:-4,right:-4,width:8,height:8,borderRadius:"50%",background:"#F59E0B",boxShadow:"0 0 6px rgba(245,158,11,0.6)"}}/>}
              </button>
            ))}
          </div>
          <button onClick={()=>{setPhase("unlock");setEntries([]);setMasterPw("");}} style={{display:"flex",alignItems:"center",gap:6,padding:"7px 12px",borderRadius:8,background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.2)",color:"#EF4444",cursor:"pointer",fontSize:12,fontFamily:"inherit"}}>
            <Icon d={icons.lock} size={14} stroke="#EF4444"/>
            Bloquear
          </button>
        </header>

        {/* BACKUP PANEL */}
        {activePanel==="backup"&&(
          <div style={{flex:1,padding:"28px 24px",maxWidth:680,width:"100%",margin:"0 auto"}}>
            <div style={{marginBottom:28}}>
              <h2 style={{margin:0,fontSize:18,color:"#F1F5F9",fontWeight:700}}>Copias de seguridad</h2>
              <p style={{margin:"6px 0 0",fontSize:12,color:"#475569",lineHeight:1.6}}>
                El archivo <code style={{color:"#60A5FA"}}>.vault</code> exportado está cifrado con AES-256-GCM. Solo tú puedes abrirlo con tu contraseña maestra. Guárdalo en un lugar seguro.
              </p>
            </div>

            {/* Status */}
            <div style={{padding:"20px 24px",borderRadius:14,marginBottom:20,background:bkWarn?"rgba(245,158,11,0.06)":"rgba(16,185,129,0.06)",border:`1px solid ${bkWarn?"rgba(245,158,11,0.2)":"rgba(16,185,129,0.2)"}`}}>
              <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
                <Icon d={bkWarn?icons.alertTri:icons.check} size={20} stroke={bkWarn?"#F59E0B":"#10B981"}/>
                <span style={{fontSize:14,fontWeight:600,color:bkWarn?"#FCD34D":"#6EE7B7"}}>
                  {bkWarn
                    ?(lastBackup?`Último backup hace ${daysSinceBk} días`:"Sin backup registrado")
                    :`Backup al día · hace ${daysSinceBk===0?"hoy":`${daysSinceBk} día${daysSinceBk>1?"s":""}`}`}
                </span>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
                {[
                  {label:"Entradas en bóveda",value:entries.length},
                  {label:"Último backup",value:lastBackup?formatDate(lastBackup.date).split(" · ")[0]:"Nunca"},
                  {label:"Backups realizados",value:backupLog.length},
                ].map(stat=>(
                  <div key={stat.label} style={{background:"rgba(15,23,42,0.6)",border:"1px solid rgba(96,165,250,0.08)",borderRadius:10,padding:"10px 14px"}}>
                    <div style={{fontSize:18,fontWeight:700,color:"#E2E8F0"}}>{stat.value}</div>
                    <div style={{fontSize:10,color:"#475569",marginTop:2}}>{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Action cards */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:28}}>
              {/* Export */}
              <div style={{padding:"24px",borderRadius:14,background:"rgba(15,23,42,0.8)",border:"1px solid rgba(96,165,250,0.12)"}}>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
                  <div style={{width:40,height:40,borderRadius:10,background:"rgba(96,165,250,0.1)",border:"1px solid rgba(96,165,250,0.2)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                    <Icon d={icons.download} size={18} stroke="#60A5FA"/>
                  </div>
                  <div>
                    <div style={{fontSize:13,fontWeight:600,color:"#E2E8F0"}}>Exportar backup</div>
                    <div style={{fontSize:11,color:"#475569"}}>Descarga archivo .vault</div>
                  </div>
                </div>
                <p style={{fontSize:11,color:"#475569",lineHeight:1.6,margin:"0 0 16px"}}>Genera un archivo cifrado con todas tus entradas. Guárdalo fuera del dispositivo.</p>
                <button onClick={handleExport} style={{width:"100%",padding:"11px",background:"linear-gradient(135deg,#1D4ED8,#1E40AF)",border:"1px solid rgba(96,165,250,0.3)",borderRadius:9,color:"#E2E8F0",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
                  <Icon d={icons.download} size={14}/>
                  Exportar ahora
                </button>
              </div>

              {/* Import */}
              <div style={{padding:"24px",borderRadius:14,background:"rgba(15,23,42,0.8)",border:"1px solid rgba(96,165,250,0.12)"}}>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
                  <div style={{width:40,height:40,borderRadius:10,background:"rgba(52,211,153,0.1)",border:"1px solid rgba(52,211,153,0.2)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                    <Icon d={icons.upload} size={18} stroke="#34D399"/>
                  </div>
                  <div>
                    <div style={{fontSize:13,fontWeight:600,color:"#E2E8F0"}}>Restaurar backup</div>
                    <div style={{fontSize:11,color:"#475569"}}>Carga archivo .vault</div>
                  </div>
                </div>
                <p style={{fontSize:11,color:"#475569",lineHeight:1.6,margin:"0 0 16px"}}>Restaura entradas desde un archivo .vault. Reemplaza los datos actuales.</p>
                <button onClick={()=>document.getElementById("importFile").click()} disabled={importLoading} style={{width:"100%",padding:"11px",background:importLoading?"rgba(52,211,153,0.05)":"rgba(52,211,153,0.1)",border:"1px solid rgba(52,211,153,0.25)",borderRadius:9,color:importLoading?"#475569":"#34D399",fontSize:12,fontWeight:600,cursor:importLoading?"not-allowed":"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
                  <Icon d={importLoading?icons.refresh:icons.upload} size={14} stroke={importLoading?"#475569":"#34D399"}/>
                  {importLoading?"Restaurando…":"Seleccionar archivo"}
                </button>
                <input id="importFile" type="file" accept=".vault,.json" onChange={handleImport} style={{display:"none"}}/>
              </div>
            </div>

            {/* Info */}
            <div style={{padding:"14px 18px",borderRadius:12,marginBottom:28,background:"rgba(96,165,250,0.04)",border:"1px solid rgba(96,165,250,0.1)",display:"flex",gap:12,alignItems:"flex-start"}}>
              <Icon d={icons.info} size={16} stroke="#60A5FA"/>
              <p style={{margin:0,fontSize:11,color:"#475569",lineHeight:1.7}}>
                <strong style={{color:"#64748B"}}>¿Dónde guardar el backup?</strong><br/>
                Disco externo · Google Drive / Dropbox · Email cifrado · Pendrive seguro.<br/>
                Recomendamos hacer backup cada vez que añadas entradas importantes.
              </p>
            </div>

            {/* History */}
            {backupLog.length>0&&(
              <div>
                <h3 style={{margin:"0 0 12px",fontSize:12,color:"#475569",letterSpacing:"2px",textTransform:"uppercase"}}>Historial de backups</h3>
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  {backupLog.map((b,i)=>(
                    <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 16px",borderRadius:10,background:"rgba(15,23,42,0.6)",border:"1px solid rgba(96,165,250,0.07)"}}>
                      <div style={{display:"flex",alignItems:"center",gap:10}}>
                        <Icon d={icons.clock} size={14} stroke={i===0?"#60A5FA":"#334155"}/>
                        <span style={{fontSize:12,color:i===0?"#94A3B8":"#475569"}}>{formatDate(b.date)}</span>
                        {i===0&&<span style={{fontSize:9,padding:"1px 6px",background:"rgba(96,165,250,0.1)",border:"1px solid rgba(96,165,250,0.2)",borderRadius:99,color:"#60A5FA"}}>MÁS RECIENTE</span>}
                      </div>
                      <span style={{fontSize:11,color:"#334155"}}>{b.entries} entrada{b.entries!==1?"s":""}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* VAULT PANEL */}
        {activePanel==="vault"&&(
          <div style={{flex:1,display:"flex",overflow:"hidden"}}>
            <aside style={{width:200,flexShrink:0,background:"rgba(10,13,20,0.8)",borderRight:"1px solid rgba(96,165,250,0.08)",padding:"16px 0",display:"flex",flexDirection:"column",gap:2}}>
              <button onClick={()=>{setSelectedCat("password");setEditData({title:""});setActiveEntry({mode:"new"});}} style={{margin:"0 12px 12px",padding:"10px",background:"linear-gradient(135deg,#1D4ED8 0%,#1E40AF 100%)",border:"1px solid rgba(96,165,250,0.3)",borderRadius:10,color:"#E2E8F0",cursor:"pointer",fontSize:12,display:"flex",alignItems:"center",justifyContent:"center",gap:6,fontFamily:"inherit",fontWeight:600,letterSpacing:"0.5px"}}>
                <Icon d={icons.plus} size={14}/> Nueva entrada
              </button>
              <SidebarItem label="Todas" count={entries.length} active={filterCat==="all"} onClick={()=>setFilterCat("all")}/>
              <div style={{height:1,background:"rgba(96,165,250,0.08)",margin:"8px 12px"}}/>
              {CATEGORIES.map(cat=>(
                <SidebarItem key={cat.id} label={cat.label} count={catCounts[cat.id]||0} active={filterCat===cat.id} color={cat.color} onClick={()=>setFilterCat(cat.id)} icon={icons[cat.icon]}/>
              ))}
            </aside>

            <main style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
              <div style={{padding:"16px 20px",borderBottom:"1px solid rgba(96,165,250,0.08)"}}>
                <div style={{position:"relative"}}>
                  <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",color:"#475569"}}>
                    <Icon d={icons.search} size={16}/>
                  </span>
                  <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar en la bóveda…" style={{width:"100%",padding:"10px 12px 10px 36px",background:"rgba(15,23,42,0.8)",border:"1px solid rgba(96,165,250,0.15)",borderRadius:10,color:"#E2E8F0",fontSize:13,fontFamily:"inherit",outline:"none",boxSizing:"border-box"}}/>
                </div>
              </div>
              <div style={{flex:1,overflowY:"auto",padding:"12px 20px",display:"flex",flexDirection:"column",gap:8}}>
                {filteredEntries.length===0?(
                  <div style={{textAlign:"center",padding:"60px 20px",color:"#334155"}}>
                    <Icon d={icons.shield} size={48} stroke="#1E3A5F"/>
                    <p style={{marginTop:16,fontSize:14,lineHeight:1.7}}>
                      {entries.length===0?"Tu bóveda está vacía.\nCrea tu primera entrada.":"No se encontraron resultados."}
                    </p>
                  </div>
                ):filteredEntries.map(entry=>{
                  const cat = getCatConfig(entry.category);
                  return (
                    <div key={entry.id} onClick={()=>{setActiveEntry({mode:"view",data:entry});setRevealFields({});}} style={{padding:"14px 16px",borderRadius:12,cursor:"pointer",background:activeEntry?.data?.id===entry.id?"rgba(96,165,250,0.08)":"rgba(15,23,42,0.6)",border:`1px solid ${activeEntry?.data?.id===entry.id?"rgba(96,165,250,0.25)":"rgba(96,165,250,0.08)"}`,display:"flex",alignItems:"center",gap:14,transition:"all 0.15s ease"}}>
                      <div style={{width:38,height:38,borderRadius:10,flexShrink:0,background:`${cat.color}15`,border:`1px solid ${cat.color}30`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                        <Icon d={icons[cat.icon]} size={18} stroke={cat.color}/>
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:13,fontWeight:600,color:"#E2E8F0",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{entry.title}</div>
                        <div style={{fontSize:11,color:"#475569",marginTop:2}}>{entry.username||entry.ssid||cat.label}</div>
                      </div>
                      <div style={{fontSize:10,color:"#334155",flexShrink:0}}>{new Date(entry.updatedAt).toLocaleDateString("es-ES")}</div>
                    </div>
                  );
                })}
              </div>
            </main>

            {activeEntry&&(
              <EntryPanel mode={activeEntry.mode} data={activeEntry.mode==="new"?{}:activeEntry.data}
                editData={editData} setEditData={setEditData}
                selectedCat={selectedCat} setSelectedCat={setSelectedCat}
                revealFields={revealFields} setRevealFields={setRevealFields}
                onSave={handleSaveEntry}
                onClose={()=>{setActiveEntry(null);setEditData({});}}
                onEdit={()=>{setEditData({...activeEntry.data});setSelectedCat(activeEntry.data.category);setActiveEntry({mode:"edit",data:activeEntry.data});}}
                onDelete={()=>setShowDeleteConfirm(activeEntry.data.id)}
                onCopy={copyToClipboard}
                getCatConfig={getCatConfig}/>
            )}
          </div>
        )}
      </div>

      {showDeleteConfirm&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999,padding:20}}>
          <div style={{background:"#0F172A",border:"1px solid rgba(239,68,68,0.3)",borderRadius:16,padding:"28px 32px",maxWidth:360,width:"100%"}}>
            <h3 style={{margin:"0 0 12px",color:"#FCA5A5",fontSize:16}}>¿Eliminar entrada?</h3>
            <p style={{margin:"0 0 24px",color:"#64748B",fontSize:13}}>Esta acción no se puede deshacer.</p>
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>setShowDeleteConfirm(null)} style={btnStyle("#1E293B","#94A3B8")}>Cancelar</button>
              <button onClick={()=>handleDelete(showDeleteConfirm)} style={btnStyle("rgba(239,68,68,0.15)","#EF4444","rgba(239,68,68,0.3)",true)}>Eliminar</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&display=swap');
        *{box-sizing:border-box;}
        ::-webkit-scrollbar{width:4px;}
        ::-webkit-scrollbar-track{background:transparent;}
        ::-webkit-scrollbar-thumb{background:rgba(96,165,250,0.2);border-radius:99px;}
        input::placeholder,textarea::placeholder{color:#334155;}
        input:focus,textarea:focus{border-color:rgba(96,165,250,0.4)!important;outline:none!important;}
        @keyframes fadeIn{from{opacity:0;transform:translateX(-50%) translateY(-8px);}to{opacity:1;transform:translateX(-50%) translateY(0);}}
      `}</style>
    </div>
  );
}

// ─── SUB-COMPONENTS ────────────────────────────────────────────────────

function PasswordField({label,value,onChange,show,onToggle,onKeyDown,autoFocus}) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <div style={{position:"relative"}}>
        <input type={show?"text":"password"} value={value} onChange={e=>onChange(e.target.value)} onKeyDown={onKeyDown} autoFocus={autoFocus}
          style={{width:"100%",padding:"12px 44px 12px 14px",background:"rgba(15,23,42,0.8)",border:"1px solid rgba(96,165,250,0.15)",borderRadius:10,color:"#E2E8F0",fontSize:14,fontFamily:"inherit"}}/>
        <button onClick={onToggle} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:"#475569",padding:0}}>
          <Icon d={show?icons.eyeOff:icons.eye} size={18}/>
        </button>
      </div>
    </div>
  );
}

function SidebarItem({label,count,active,onClick,color,icon}) {
  return (
    <button onClick={onClick} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 16px",margin:"0 8px",background:active?"rgba(96,165,250,0.1)":"transparent",border:active?"1px solid rgba(96,165,250,0.15)":"1px solid transparent",borderRadius:8,cursor:"pointer",textAlign:"left",width:"calc(100% - 16px)",transition:"all 0.15s"}}>
      {icon&&<Icon d={icon} size={14} stroke={color||"#64748B"}/>}
      <span style={{flex:1,fontSize:12,color:active?"#E2E8F0":"#64748B",fontFamily:"inherit"}}>{label}</span>
      {count>0&&<span style={{fontSize:10,padding:"1px 6px",background:active?"rgba(96,165,250,0.2)":"rgba(96,165,250,0.05)",borderRadius:99,color:active?"#93C5FD":"#475569"}}>{count}</span>}
    </button>
  );
}

function EntryPanel({mode,data,editData,setEditData,selectedCat,setSelectedCat,revealFields,setRevealFields,onSave,onClose,onEdit,onDelete,onCopy,getCatConfig}) {
  const isView   = mode==="view";
  const isEdit   = mode==="edit"||mode==="new";
  const currentCat = isEdit?selectedCat:data?.category||"password";
  const fields   = FIELD_TEMPLATES[currentCat]||FIELD_TEMPLATES.password;
  const cat      = getCatConfig(currentCat);

  return (
    <div style={{width:340,flexShrink:0,background:"rgba(10,14,22,0.98)",borderLeft:"1px solid rgba(96,165,250,0.1)",display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <div style={{padding:"16px 20px",borderBottom:"1px solid rgba(96,165,250,0.08)",display:"flex",alignItems:"center",gap:10}}>
        <div style={{width:32,height:32,borderRadius:8,background:`${cat.color}15`,border:`1px solid ${cat.color}30`,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <Icon d={icons[cat.icon]} size={16} stroke={cat.color}/>
        </div>
        <span style={{flex:1,fontSize:13,color:"#94A3B8",fontWeight:600}}>
          {isEdit?(mode==="new"?"Nueva entrada":"Editar"):"Detalle"}
        </span>
        <div style={{display:"flex",gap:6}}>
          {isView&&(<><SmallBtn icon={icons.edit} onClick={onEdit}/><SmallBtn icon={icons.trash} onClick={onDelete} danger/></>)}
          <SmallBtn icon={icons.x} onClick={onClose}/>
        </div>
      </div>

      <div style={{flex:1,overflowY:"auto",padding:"20px"}}>
        {isEdit&&mode==="new"&&(
          <div style={{marginBottom:20}}>
            <label style={labelStyle}>Categoría</label>
            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
              {CATEGORIES.map(c=>(
                <button key={c.id} onClick={()=>setSelectedCat(c.id)} style={{padding:"5px 10px",borderRadius:6,fontSize:11,background:selectedCat===c.id?`${c.color}20`:"rgba(15,23,42,0.6)",border:`1px solid ${selectedCat===c.id?c.color+"40":"rgba(96,165,250,0.1)"}`,color:selectedCat===c.id?c.color:"#475569",cursor:"pointer",fontFamily:"inherit"}}>{c.label}</button>
              ))}
            </div>
          </div>
        )}

        <div style={{marginBottom:16}}>
          <label style={labelStyle}>Título</label>
          {isView?<p style={valueStyle}>{data.title}</p>
            :<input value={editData.title||""} onChange={e=>setEditData(p=>({...p,title:e.target.value}))} placeholder="Nombre de la entrada" style={inputStyle}/>}
        </div>

        {fields.map(f=>{
          const val=isView?data[f.key]:editData[f.key];
          if(isView&&!val) return null;
          const isSecret=f.type==="password";
          const revealed=revealFields[f.key];
          return (
            <div key={f.key} style={{marginBottom:16}}>
              <label style={labelStyle}>{f.label}</label>
              {isView?(
                <div style={{display:"flex",alignItems:"flex-start",gap:8}}>
                  <div style={{flex:1,padding:"8px 10px",background:"rgba(15,23,42,0.6)",border:"1px solid rgba(96,165,250,0.08)",borderRadius:8,fontSize:12,color:"#94A3B8",wordBreak:"break-all",fontFamily:"inherit"}}>
                    {isSecret&&!revealed?"•".repeat(Math.min((val||"").length,16)):(val||"—")}
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:4}}>
                    {isSecret&&<SmallBtn icon={revealed?icons.eyeOff:icons.eye} onClick={()=>setRevealFields(p=>({...p,[f.key]:!p[f.key]}))}/>}
                    {val&&<SmallBtn icon={icons.copy} onClick={()=>onCopy(val)}/>}
                  </div>
                </div>
              ):(
                <div>
                  {f.type==="textarea"
                    ?<textarea value={editData[f.key]||""} onChange={e=>setEditData(p=>({...p,[f.key]:e.target.value}))} placeholder={f.label} rows={3} style={{...inputStyle,resize:"vertical",minHeight:72}}/>
                    :(
                      <div style={{display:"flex",gap:6}}>
                        <input type={isSecret&&!revealFields[f.key]?"password":"text"} value={editData[f.key]||""} onChange={e=>setEditData(p=>({...p,[f.key]:e.target.value}))} placeholder={f.label} style={{...inputStyle,flex:1}}/>
                        {isSecret&&(
                          <>
                            <SmallBtn icon={revealFields[f.key]?icons.eyeOff:icons.eye} onClick={()=>setRevealFields(p=>({...p,[f.key]:!p[f.key]}))}/>
                            <SmallBtn icon={icons.refresh} title="Generar contraseña" onClick={()=>setEditData(p=>({...p,[f.key]:generatePassword()}))}/>
                          </>
                        )}
                      </div>
                    )}
                  {isSecret&&editData[f.key]&&(()=>{
                    const s=passwordStrength(editData[f.key]);
                    return(
                      <div style={{display:"flex",alignItems:"center",gap:6,marginTop:4}}>
                        <div style={{flex:1,height:2,background:"#1E293B",borderRadius:99,overflow:"hidden"}}>
                          <div style={{height:"100%",width:`${(s.score/5)*100}%`,background:s.color,borderRadius:99}}/>
                        </div>
                        <span style={{fontSize:10,color:s.color}}>{s.label}</span>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          );
        })}

        {isView&&(
          <div style={{marginTop:24,paddingTop:16,borderTop:"1px solid rgba(96,165,250,0.08)"}}>
            <div style={{fontSize:10,color:"#334155",lineHeight:2}}>
              <div>Creado: {new Date(data.createdAt).toLocaleString("es-ES")}</div>
              <div>Modificado: {new Date(data.updatedAt).toLocaleString("es-ES")}</div>
            </div>
          </div>
        )}
      </div>

      {isEdit&&(
        <div style={{padding:"16px 20px",borderTop:"1px solid rgba(96,165,250,0.08)"}}>
          <div style={{display:"flex",gap:8}}>
            <button onClick={onClose} style={btnStyle("#1E293B","#94A3B8")}>Cancelar</button>
            <button onClick={onSave} style={btnStyle("linear-gradient(135deg,#1D4ED8,#1E40AF)","#E2E8F0","rgba(96,165,250,0.3)",true)}>Guardar</button>
          </div>
        </div>
      )}
    </div>
  );
}

function SmallBtn({icon,onClick,danger,title}) {
  return (
    <button onClick={onClick} title={title} style={{padding:6,background:"rgba(15,23,42,0.8)",border:`1px solid ${danger?"rgba(239,68,68,0.2)":"rgba(96,165,250,0.1)"}`,borderRadius:6,cursor:"pointer",color:danger?"#EF4444":"#475569",display:"flex",alignItems:"center",flexShrink:0}}>
      <Icon d={icon} size={14}/>
    </button>
  );
}

const labelStyle = {display:"block",fontSize:10,color:"#475569",marginBottom:5,letterSpacing:"1px",textTransform:"uppercase"};
const valueStyle = {margin:0,fontSize:13,color:"#94A3B8",wordBreak:"break-all",fontFamily:"inherit"};
const inputStyle = {width:"100%",padding:"9px 12px",background:"rgba(15,23,42,0.8)",border:"1px solid rgba(96,165,250,0.15)",borderRadius:8,color:"#E2E8F0",fontSize:12,fontFamily:"inherit",boxSizing:"border-box"};
function btnStyle(bg,color,border,flex) {
  return {flex:flex?1:undefined,padding:"10px 16px",background:bg,border:`1px solid ${border||"transparent"}`,borderRadius:8,color,fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:600,letterSpacing:"0.5px"};
}
