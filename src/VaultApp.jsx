import { useState, useEffect, useCallback, useRef } from "react";

// ─── CRYPTO ────────────────────────────────────────────────────────────────
const PBKDF2_ITERATIONS = 310000;
const SALT_LEN = 32;
const IV_LEN   = 12;

async function deriveKey(password, salt) {
  const enc = new TextEncoder();
  const km  = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name:"PBKDF2", salt, iterations:PBKDF2_ITERATIONS, hash:"SHA-256" },
    km, { name:"AES-GCM", length:256 }, false, ["encrypt","decrypt"]
  );
}
async function encryptVault(data, password) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LEN));
  const iv   = crypto.getRandomValues(new Uint8Array(IV_LEN));
  const key  = await deriveKey(password, salt);
  const ct   = await crypto.subtle.encrypt({ name:"AES-GCM", iv }, key, new TextEncoder().encode(JSON.stringify(data)));
  const out  = new Uint8Array(SALT_LEN + IV_LEN + ct.byteLength);
  out.set(salt,0); out.set(iv,SALT_LEN); out.set(new Uint8Array(ct), SALT_LEN+IV_LEN);
  return btoa(String.fromCharCode(...out));
}
async function decryptVault(b64, password) {
  const raw   = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  const key   = await deriveKey(password, raw.slice(0,SALT_LEN));
  const plain = await crypto.subtle.decrypt({ name:"AES-GCM", iv:raw.slice(SALT_LEN,SALT_LEN+IV_LEN) }, key, raw.slice(SALT_LEN+IV_LEN));
  return JSON.parse(new TextDecoder().decode(plain));
}

// ─── STORAGE ───────────────────────────────────────────────────────────────
const STORAGE_KEY    = "vlt_enc";
const BACKUP_LOG_KEY = "vlt_backup_log";
const saveEncrypted  = b64  => localStorage.setItem(STORAGE_KEY, b64);
const loadEncrypted  = ()   => localStorage.getItem(STORAGE_KEY);
const loadBackupLog  = ()   => { try { return JSON.parse(localStorage.getItem(BACKUP_LOG_KEY)||"[]"); } catch { return []; } };
const saveBackupLog  = log  => localStorage.setItem(BACKUP_LOG_KEY, JSON.stringify(log));
function addBackupEntry(count) {
  const log = loadBackupLog();
  log.unshift({ date: new Date().toISOString(), entries: count });
  saveBackupLog(log.slice(0,10));
}

// ─── ICONS ─────────────────────────────────────────────────────────────────
const Icon = ({ d, size=20, stroke="currentColor", fill="none", sw=1.8 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke}
       strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
    {Array.isArray(d) ? d.map((p,i)=><path key={i} d={p}/>) : <path d={d}/>}
  </svg>
);
const IC = {
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
  menu:     "M3 12h18M3 6h18M3 18h18",
  chevronL: "M15 18l-6-6 6-6",
  user:     ["M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2","M12 3a4 4 0 100 8 4 4 0 000-8z"],
  phone:    ["M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.8 19.79 19.79 0 01.15 1.18 2 2 0 012.11 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 7.91a16 16 0 006.18 6.18l1.27-1.35a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"],
  hash:     ["M4 9h16M4 15h16M10 3L8 21M16 3l-2 18"],
};

// ─── CATEGORIES & FIELDS ───────────────────────────────────────────────────
const CATEGORIES = [
  { id:"password", label:"Contraseña",  icon:"key",   color:"#60A5FA" },
  { id:"card",     label:"Tarjeta",     icon:"card",  color:"#F472B6" },
  { id:"wifi",     label:"WiFi",        icon:"wifi",  color:"#34D399" },
  { id:"note",     label:"Nota",        icon:"note",  color:"#FBBF24" },
  { id:"identity", label:"Identidad",   icon:"user",  color:"#A78BFA" },
];

const FIELDS = {
  password: [
    { key:"url",      label:"Sitio web / URL",      type:"text",     icon:"globe",  placeholder:"https://ejemplo.com" },
    { key:"username", label:"Usuario o email",       type:"text",     icon:"user",   placeholder:"usuario@email.com"   },
    { key:"password", label:"Contraseña",            type:"password", icon:"lock",   placeholder:"contraseña"          },
    { key:"notes",    label:"Notas",                 type:"textarea", icon:"note",   placeholder:"Notas adicionales…"  },
  ],
  card: [
    { key:"cardNumber", label:"Número de tarjeta",   type:"text",     icon:"card",   placeholder:"0000 0000 0000 0000" },
    { key:"holder",     label:"Titular",             type:"text",     icon:"user",   placeholder:"Nombre Apellido"     },
    { key:"expiry",     label:"Vencimiento",         type:"text",     icon:"clock",  placeholder:"MM/AA"               },
    { key:"cvv",        label:"CVV / CVC",           type:"password", icon:"lock",   placeholder:"•••"                 },
    { key:"pin",        label:"PIN",                 type:"password", icon:"hash",   placeholder:"••••"                },
    { key:"bank",       label:"Banco / Entidad",     type:"text",     icon:"database",placeholder:"Nombre del banco"  },
    { key:"notes",      label:"Notas",               type:"textarea", icon:"note",   placeholder:"Notas adicionales…"  },
  ],
  wifi: [
    { key:"ssid",       label:"Nombre de red (SSID)",type:"text",     icon:"wifi",   placeholder:"MiRedWiFi"           },
    { key:"password",   label:"Contraseña WiFi",     type:"password", icon:"lock",   placeholder:"contraseña"          },
    { key:"security",   label:"Seguridad",           type:"text",     icon:"shield", placeholder:"WPA2 / WPA3"         },
    { key:"router",     label:"Modelo de router",    type:"text",     icon:"globe",  placeholder:"Marca y modelo"      },
    { key:"notes",      label:"Notas",               type:"textarea", icon:"note",   placeholder:"Notas adicionales…"  },
  ],
  note: [
    { key:"content",    label:"Contenido",           type:"textarea", icon:"note",   placeholder:"Escribe tu nota segura aquí…" },
  ],
  identity: [
    { key:"fullName",   label:"Nombre completo",     type:"text",     icon:"user",   placeholder:"Nombre Apellido"     },
    { key:"idNumber",   label:"Nº Documento (DNI/NIE/Pasaporte)", type:"text", icon:"hash", placeholder:"12345678A" },
    { key:"dob",        label:"Fecha de nacimiento", type:"text",     icon:"clock",  placeholder:"DD/MM/AAAA"          },
    { key:"nationality",label:"Nacionalidad",        type:"text",     icon:"globe",  placeholder:"Española"            },
    { key:"address",    label:"Dirección",           type:"textarea", icon:"note",   placeholder:"Calle, número, ciudad…" },
    { key:"phone",      label:"Teléfono",            type:"text",     icon:"phone",  placeholder:"+34 600 000 000"     },
    { key:"email",      label:"Email",               type:"text",     icon:"user",   placeholder:"email@ejemplo.com"   },
    { key:"notes",      label:"Notas",               type:"textarea", icon:"note",   placeholder:"Notas adicionales…"  },
  ],
};

// ─── UTILS ─────────────────────────────────────────────────────────────────
function genPassword(len=20) {
  const c = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()-_=+[]{}";
  return Array.from(crypto.getRandomValues(new Uint8Array(len))).map(b=>c[b%c.length]).join("");
}
function pwStrength(pw) {
  if (!pw) return { score:0, label:"", color:"#374151" };
  let s=0;
  if(pw.length>=8)s++; if(pw.length>=16)s++;
  if(/[A-Z]/.test(pw))s++; if(/[0-9]/.test(pw))s++; if(/[^A-Za-z0-9]/.test(pw))s++;
  return [
    {label:"Muy débil",color:"#EF4444"},{label:"Débil",color:"#F97316"},
    {label:"Regular",color:"#EAB308"},{label:"Buena",color:"#84CC16"},
    {label:"Fuerte",color:"#22C55E"},{label:"Muy fuerte",color:"#10B981"},
  ][s];
}
function fmtDate(iso) {
  if(!iso) return "—";
  const d=new Date(iso);
  return d.toLocaleDateString("es-ES",{day:"2-digit",month:"short",year:"numeric"})
    +" · "+d.toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit"});
}
function daysSince(iso) {
  if(!iso) return null;
  return Math.floor((Date.now()-new Date(iso).getTime())/(864e5));
}
const getCat = id => CATEGORIES.find(c=>c.id===id)||CATEGORIES[0];

// ─── MAIN APP ──────────────────────────────────────────────────────────────
export default function VaultApp() {
  const [phase,setPhase]             = useState("boot");
  const [masterPw,setMasterPw]       = useState("");
  const [confirmPw,setConfirmPw]     = useState("");
  const [showPw,setShowPw]           = useState(false);
  const [entries,setEntries]         = useState([]);
  const [search,setSearch]           = useState("");
  const [filterCat,setFilterCat]     = useState("all");
  const [activeEntry,setActiveEntry] = useState(null);  // {mode,data}
  const [panel,setPanel]             = useState("vault"); // vault|backup
  const [toast,setToast]             = useState(null);
  const [loading,setLoading]         = useState(false);
  const [revealed,setRevealed]       = useState({});
  const [editData,setEditData]       = useState({});
  const [editCat,setEditCat]         = useState("password");
  const [delConfirm,setDelConfirm]   = useState(null);
  const [backupLog,setBackupLog]     = useState([]);
  const [importing,setImporting]     = useState(false);
  const [sidebarOpen,setSidebarOpen] = useState(false);
  const autoLockRef = useRef(null);

  // ── Boot
  useEffect(()=>{ setPhase(loadEncrypted()?"unlock":"setup"); setBackupLog(loadBackupLog()); },[]);

  // ── Auto-lock 3min
  const resetLock = useCallback(()=>{
    clearTimeout(autoLockRef.current);
    autoLockRef.current = setTimeout(()=>{
      setPhase("unlock"); setEntries([]); setMasterPw("");
      notify("🔒 Bóveda bloqueada por inactividad","info");
    }, 3*60*1000);
  },[]);
  useEffect(()=>{
    if(phase!=="vault") return;
    const evts=["mousemove","keydown","touchstart","click","scroll"];
    evts.forEach(e=>window.addEventListener(e,resetLock,{passive:true}));
    resetLock();
    return()=>evts.forEach(e=>window.removeEventListener(e,resetLock));
  },[phase,resetLock]);

  const notify = (msg,type="success")=>{ setToast({msg,type}); setTimeout(()=>setToast(null),3500); };

  const persist = useCallback(async(data,pw)=>{
    saveEncrypted(await encryptVault(data,pw));
  },[]);

  const handleSetup = async()=>{
    if(masterPw.length<8) return notify("Mínimo 8 caracteres","error");
    if(masterPw!==confirmPw) return notify("Las contraseñas no coinciden","error");
    setLoading(true); await persist([],masterPw); setLoading(false);
    setEntries([]); setPhase("vault"); notify("✅ Bóveda creada");
  };

  const handleUnlock = async()=>{
    if(!masterPw) return; setLoading(true);
    try {
      const data=await decryptVault(loadEncrypted(),masterPw);
      setEntries(data); setPhase("vault"); notify("✅ Bóveda desbloqueada");
    } catch { notify("Contraseña incorrecta","error"); }
    setLoading(false);
  };

  // ── FIX: guardar con la categoría correcta
  const handleSave = async()=>{
    if(!editData.title?.trim()) return notify("El título es obligatorio","error");
    let updated;
    if(activeEntry.mode==="new") {
      // editCat contiene la categoría seleccionada al crear
      updated=[...entries,{
        ...editData,
        id: Date.now().toString(),
        category: editCat,           // ← categoría correcta
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }];
    } else {
      updated=entries.map(e=>e.id===activeEntry.data.id
        ?{...e,...editData, category:editCat, updatedAt:new Date().toISOString()}:e);
    }
    setEntries(updated); await persist(updated,masterPw);
    setActiveEntry(null); setEditData({}); notify("✅ Entrada guardada");
  };

  const handleDelete = async(id)=>{
    const updated=entries.filter(e=>e.id!==id);
    setEntries(updated); await persist(updated,masterPw);
    setActiveEntry(null); setDelConfirm(null); notify("🗑️ Eliminada");
  };

  // ── Export
  const handleExport = async()=>{
    const stored=loadEncrypted();
    if(!stored) return notify("No hay datos","error");
    const blob=new Blob([JSON.stringify({version:"1.0",app:"VAULT",exportedAt:new Date().toISOString(),entries:entries.length,vault:stored},null,2)],{type:"application/json"});
    const a=document.createElement("a");
    a.href=URL.createObjectURL(blob);
    a.download=`vault-backup-${new Date().toISOString().slice(0,10)}.vault`;
    a.click(); URL.revokeObjectURL(a.href);
    addBackupEntry(entries.length); setBackupLog(loadBackupLog());
    notify(`📦 Backup de ${entries.length} entradas exportado`);
  };

  // ── FIX: import acepta .vault, .json y cualquier archivo en iOS
  const handleImport = e=>{
    const file=e.target.files[0]; if(!file) return;
    setImporting(true);
    const reader=new FileReader();
    reader.onload=async ev=>{
      try {
        const text=ev.target.result;
        const parsed=JSON.parse(text);
        const raw=parsed.vault||parsed;
        const data=await decryptVault(typeof raw==="string"?raw:JSON.stringify(raw),masterPw);
        setEntries(data); await persist(data,masterPw);
        notify(`✅ ${data.length} entradas restauradas`);
      } catch(err) {
        notify("Error: contraseña incorrecta o archivo dañado","error");
      }
      setImporting(false);
    };
    reader.readAsText(file); e.target.value="";
  };

  const copy = val=>{ navigator.clipboard?.writeText(val); notify("📋 Copiado"); };

  const filtered=entries.filter(e=>{
    const mc=filterCat==="all"||e.category===filterCat;
    const q=search.toLowerCase();
    const ms=!q||e.title?.toLowerCase().includes(q)||
      Object.values(e).some(v=>typeof v==="string"&&v.toLowerCase().includes(q));
    return mc&&ms;
  });
  const counts={}; entries.forEach(e=>{ counts[e.category]=(counts[e.category]||0)+1; });

  const lastBk=backupLog[0];
  const dSince=daysSince(lastBk?.date);
  const bkWarn=dSince===null||dSince>7;

  // ── STYLES (responsive-first) ──────────────────────────────────────────
  const isMobile = typeof window!=="undefined" && window.innerWidth<640;

  const css = {
    app: {
      minHeight:"100vh", minHeight:"100dvh",
      background:"#0A0D14", color:"#E2E8F0",
      fontFamily:"'DM Mono','Fira Code','Courier New',monospace",
      overflowX:"hidden", position:"relative",
    },
    grid: {
      position:"fixed",inset:0,
      backgroundImage:"linear-gradient(rgba(96,165,250,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(96,165,250,0.03) 1px,transparent 1px)",
      backgroundSize:"40px 40px",pointerEvents:"none",zIndex:0,
    },
  };

  // ── BOOT
  if(phase==="boot") return (
    <div style={{...css.app,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={css.grid}/>
      <div style={{textAlign:"center",zIndex:1,position:"relative"}}>
        <div style={{fontSize:48}}>🔐</div>
        <p style={{color:"#64748B",marginTop:8,fontSize:14}}>Iniciando bóveda…</p>
      </div>
    </div>
  );

  // ── SETUP / UNLOCK
  if(phase==="setup"||phase==="unlock") {
    const isSetup=phase==="setup";
    const str=isSetup?pwStrength(masterPw):null;
    return (
      <div style={{...css.app,display:"flex",alignItems:"center",justifyContent:"center",padding:"16px"}}>
        <div style={css.grid}/>
        <div style={{
          position:"relative",zIndex:1,
          width:"100%",maxWidth:420,
          background:"rgba(15,20,30,0.97)",
          border:"1px solid rgba(96,165,250,0.15)",
          borderRadius:20,
          // FIX: padding responsive, no overflow en móvil
          padding:"clamp(24px,5vw,40px) clamp(20px,5vw,36px)",
          boxShadow:"0 0 60px rgba(96,165,250,0.05),0 24px 48px rgba(0,0,0,0.5)",
          boxSizing:"border-box",
        }}>
          {/* Logo */}
          <div style={{textAlign:"center",marginBottom:32}}>
            <div style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:68,height:68,borderRadius:18,background:"linear-gradient(135deg,#1E3A5F,#0F172A)",border:"1px solid rgba(96,165,250,0.3)",marginBottom:16,boxShadow:"0 0 30px rgba(96,165,250,0.1)"}}>
              <Icon d={IC.shield} size={34} stroke="#60A5FA"/>
            </div>
            <h1 style={{margin:0,fontSize:22,fontWeight:700,color:"#F1F5F9",letterSpacing:"-0.5px"}}>VAULT</h1>
            <p style={{margin:"4px 0 0",fontSize:11,color:"#475569",letterSpacing:"3px",textTransform:"uppercase"}}>
              {isSetup?"Configuración inicial":"Acceso seguro"}
            </p>
          </div>

          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            {isSetup&&(
              <div style={{background:"rgba(96,165,250,0.05)",border:"1px solid rgba(96,165,250,0.1)",borderRadius:10,padding:"10px 14px",fontSize:11,color:"#64748B",lineHeight:1.7}}>
                🔐 AES-256-GCM · PBKDF2 · {PBKDF2_ITERATIONS.toLocaleString()} iteraciones<br/>
                Contraseña maestra <strong style={{color:"#94A3B8"}}>nunca sale del dispositivo</strong>
              </div>
            )}

            {/* FIX: campo de contraseña con width:100% y box-sizing */}
            <PwField label="Contraseña maestra" value={masterPw} onChange={setMasterPw}
              show={showPw} onToggle={()=>setShowPw(p=>!p)} autoFocus
              onKeyDown={e=>e.key==="Enter"&&(isSetup?confirmPw&&handleSetup():handleUnlock())}/>

            {isSetup&&str?.label&&(
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <div style={{flex:1,height:3,background:"#1E293B",borderRadius:99,overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${(str.score/5)*100}%`,background:str.color,borderRadius:99,transition:"all 0.3s"}}/>
                </div>
                <span style={{fontSize:11,color:str.color,whiteSpace:"nowrap"}}>{str.label}</span>
              </div>
            )}

            {isSetup&&(
              <PwField label="Confirmar contraseña" value={confirmPw} onChange={setConfirmPw}
                show={showPw} onToggle={()=>setShowPw(p=>!p)}
                onKeyDown={e=>e.key==="Enter"&&masterPw&&handleSetup()}/>
            )}

            <button onClick={isSetup?handleSetup:handleUnlock}
              disabled={loading||!masterPw}
              style={{width:"100%",padding:"13px",background:loading||!masterPw?"rgba(96,165,250,0.08)":"linear-gradient(135deg,#1D4ED8,#1E40AF)",border:"1px solid rgba(96,165,250,0.3)",borderRadius:10,color:"#E2E8F0",fontSize:14,fontWeight:600,cursor:loading||!masterPw?"not-allowed":"pointer",letterSpacing:"1px",textTransform:"uppercase",fontFamily:"inherit"}}>
              {loading?"⏳ Procesando…":isSetup?"Crear Bóveda":"Desbloquear"}
            </button>
          </div>

          <p style={{textAlign:"center",marginTop:20,color:"#334155",fontSize:10}}>
            Cifrado local · Sin servidores externos
          </p>
        </div>

        {/* Toast */}
        {toast&&<Toast msg={toast.msg} type={toast.type}/>}

        <style>{globalCSS}</style>
      </div>
    );
  }

  // ── VAULT ─────────────────────────────────────────────────────────────
  return (
    <div style={css.app}>
      <div style={css.grid}/>
      {toast&&<Toast msg={toast.msg} type={toast.type}/>}

      {/* ── HEADER — safe-area para Dynamic Island / notch iOS */}
      <header style={{
        display:"flex",alignItems:"center",gap:10,
        paddingTop:"max(12px, calc(12px + env(safe-area-inset-top)))",
        paddingBottom:"12px",
        paddingLeft:"max(16px, env(safe-area-inset-left))",
        paddingRight:"max(16px, env(safe-area-inset-right))",
        background:"rgba(10,13,20,0.97)",
        borderBottom:"1px solid rgba(96,165,250,0.1)",
        position:"sticky",top:0,zIndex:200,
        boxSizing:"border-box",width:"100%",
      }}>
        {/* Hamburger en móvil */}
        <button onClick={()=>setSidebarOpen(p=>!p)} style={btnIcon} title="Categorías">
          <Icon d={IC.menu} size={18} stroke="#64748B"/>
        </button>

        {/* Logo */}
        <div style={{display:"flex",alignItems:"center",gap:8,flex:1,minWidth:0}}>
          <Icon d={IC.shield} size={20} stroke="#60A5FA"/>
          <span style={{fontSize:15,fontWeight:700,color:"#F1F5F9",letterSpacing:"2px"}}>VAULT</span>
          <span style={{fontSize:10,padding:"1px 6px",background:"rgba(96,165,250,0.1)",border:"1px solid rgba(96,165,250,0.2)",borderRadius:4,color:"#60A5FA",whiteSpace:"nowrap"}}>
            {entries.length}
          </span>
        </div>

        {/* Nav tabs */}
        <div style={{display:"flex",gap:4}}>
          {[{id:"vault",label:"Bóveda",icon:IC.database},{id:"backup",label:"Backup",icon:IC.backup,warn:bkWarn}].map(t=>(
            <button key={t.id} onClick={()=>setPanel(t.id)} style={{
              display:"flex",alignItems:"center",gap:5,
              padding:"6px 10px",borderRadius:8,
              background:panel===t.id?"rgba(96,165,250,0.12)":"transparent",
              border:`1px solid ${panel===t.id?"rgba(96,165,250,0.25)":"transparent"}`,
              color:panel===t.id?"#93C5FD":"#475569",
              cursor:"pointer",fontSize:11,fontFamily:"inherit",fontWeight:panel===t.id?600:400,
              position:"relative",
            }}>
              <Icon d={t.icon} size={14} stroke={panel===t.id?"#93C5FD":"#475569"}/>
              <span style={{display:"none"}} className="tab-label">{t.label}</span>
              {t.warn&&<span style={{position:"absolute",top:-3,right:-3,width:7,height:7,borderRadius:"50%",background:"#F59E0B",boxShadow:"0 0 5px rgba(245,158,11,0.7)"}}/>}
            </button>
          ))}
        </div>

        {/* Lock */}
        <button onClick={()=>{setPhase("unlock");setEntries([]);setMasterPw("");}} style={{...btnIcon,borderColor:"rgba(239,68,68,0.2)",color:"#EF4444"}} title="Bloquear">
          <Icon d={IC.lock} size={16} stroke="#EF4444"/>
        </button>
      </header>

      {/* ── BACKUP PANEL */}
      {panel==="backup"&&(
        <div style={{padding:"20px 16px",paddingBottom:"calc(20px + 60px + env(safe-area-inset-bottom))",maxWidth:680,margin:"0 auto",boxSizing:"border-box",width:"100%"}}>
          <h2 style={{margin:"0 0 6px",fontSize:17,color:"#F1F5F9",fontWeight:700}}>Copias de seguridad</h2>
          <p style={{margin:"0 0 20px",fontSize:12,color:"#475569",lineHeight:1.6}}>
            El archivo <code style={{color:"#60A5FA",fontSize:11}}>.vault</code> está cifrado con AES-256-GCM. Solo accesible con tu contraseña maestra.
          </p>

          {/* Status */}
          <div style={{padding:"16px",borderRadius:14,marginBottom:16,background:bkWarn?"rgba(245,158,11,0.06)":"rgba(16,185,129,0.06)",border:`1px solid ${bkWarn?"rgba(245,158,11,0.2)":"rgba(16,185,129,0.2)"}`}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
              <Icon d={bkWarn?IC.alertTri:IC.check} size={18} stroke={bkWarn?"#F59E0B":"#10B981"}/>
              <span style={{fontSize:13,fontWeight:600,color:bkWarn?"#FCD34D":"#6EE7B7"}}>
                {bkWarn?(lastBk?`Último backup hace ${dSince} días`:"Sin backup registrado"):`Backup al día · hace ${dSince===0?"hoy":`${dSince}d`}`}
              </span>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
              {[
                {l:"Entradas",v:entries.length},
                {l:"Último backup",v:lastBk?fmtDate(lastBk.date).split(" · ")[0]:"Nunca"},
                {l:"Total backups",v:backupLog.length},
              ].map(s=>(
                <div key={s.l} style={{background:"rgba(15,23,42,0.6)",border:"1px solid rgba(96,165,250,0.08)",borderRadius:10,padding:"10px 12px"}}>
                  <div style={{fontSize:17,fontWeight:700,color:"#E2E8F0"}}>{s.v}</div>
                  <div style={{fontSize:10,color:"#475569",marginTop:2}}>{s.l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
            {/* Export */}
            <div style={{padding:"18px",borderRadius:14,background:"rgba(15,23,42,0.8)",border:"1px solid rgba(96,165,250,0.12)"}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                <div style={{width:36,height:36,borderRadius:9,background:"rgba(96,165,250,0.1)",border:"1px solid rgba(96,165,250,0.2)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  <Icon d={IC.download} size={16} stroke="#60A5FA"/>
                </div>
                <div>
                  <div style={{fontSize:12,fontWeight:600,color:"#E2E8F0"}}>Exportar</div>
                  <div style={{fontSize:10,color:"#475569"}}>Descarga .vault</div>
                </div>
              </div>
              <button onClick={handleExport} style={{width:"100%",padding:"10px",background:"linear-gradient(135deg,#1D4ED8,#1E40AF)",border:"1px solid rgba(96,165,250,0.3)",borderRadius:8,color:"#E2E8F0",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:5}}>
                <Icon d={IC.download} size={13}/>
                Exportar ahora
              </button>
            </div>

            {/* Import — FIX: accept ampliado para iOS */}
            <div style={{padding:"18px",borderRadius:14,background:"rgba(15,23,42,0.8)",border:"1px solid rgba(96,165,250,0.12)"}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                <div style={{width:36,height:36,borderRadius:9,background:"rgba(52,211,153,0.1)",border:"1px solid rgba(52,211,153,0.2)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  <Icon d={IC.upload} size={16} stroke="#34D399"/>
                </div>
                <div>
                  <div style={{fontSize:12,fontWeight:600,color:"#E2E8F0"}}>Restaurar</div>
                  <div style={{fontSize:10,color:"#475569"}}>Carga .vault</div>
                </div>
              </div>
              <button onClick={()=>document.getElementById("vltImport").click()}
                disabled={importing}
                style={{width:"100%",padding:"10px",background:importing?"rgba(52,211,153,0.03)":"rgba(52,211,153,0.1)",border:"1px solid rgba(52,211,153,0.25)",borderRadius:8,color:importing?"#475569":"#34D399",fontSize:11,fontWeight:600,cursor:importing?"not-allowed":"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:5}}>
                <Icon d={importing?IC.refresh:IC.upload} size={13} stroke={importing?"#475569":"#34D399"}/>
                {importing?"Restaurando…":"Seleccionar archivo"}
              </button>
              {/* FIX: accept con tipos MIME amplios + extensiones para que iOS lo muestre */}
              <input id="vltImport" type="file"
                accept=".vault,.json,application/json,text/plain,*/*"
                onChange={handleImport} style={{display:"none"}}/>
            </div>
          </div>

          {/* Info */}
          <div style={{padding:"12px 16px",borderRadius:12,marginBottom:20,background:"rgba(96,165,250,0.04)",border:"1px solid rgba(96,165,250,0.1)",display:"flex",gap:10,alignItems:"flex-start"}}>
            <Icon d={IC.info} size={15} stroke="#60A5FA"/>
            <p style={{margin:0,fontSize:11,color:"#475569",lineHeight:1.7}}>
              <strong style={{color:"#64748B"}}>¿Dónde guardar el backup?</strong><br/>
              Google Drive · Dropbox · iCloud · Disco externo · Email cifrado
            </p>
          </div>

          {/* History */}
          {backupLog.length>0&&(
            <div>
              <h3 style={{margin:"0 0 10px",fontSize:11,color:"#475569",letterSpacing:"2px",textTransform:"uppercase"}}>Historial</h3>
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {backupLog.map((b,i)=>(
                  <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"9px 14px",borderRadius:10,background:"rgba(15,23,42,0.6)",border:"1px solid rgba(96,165,250,0.07)"}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,minWidth:0}}>
                      <Icon d={IC.clock} size={13} stroke={i===0?"#60A5FA":"#334155"}/>
                      <span style={{fontSize:11,color:i===0?"#94A3B8":"#475569",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{fmtDate(b.date)}</span>
                      {i===0&&<span style={{fontSize:9,padding:"1px 5px",background:"rgba(96,165,250,0.1)",borderRadius:99,color:"#60A5FA",whiteSpace:"nowrap",flexShrink:0}}>ÚLTIMO</span>}
                    </div>
                    <span style={{fontSize:11,color:"#334155",flexShrink:0,marginLeft:8}}>{b.entries} ent.</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── VAULT PANEL */}
      {panel==="vault"&&(
        <div style={{display:"flex",height:"calc(100dvh - 53px - 60px - env(safe-area-inset-bottom))",overflow:"hidden",position:"relative"}}>

          {/* Sidebar overlay en móvil */}
          {sidebarOpen&&(
            <div onClick={()=>setSidebarOpen(false)}
              style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:150}}/>
          )}

          {/* Sidebar */}
          <aside style={{
            width:200,flexShrink:0,
            background:"rgba(10,13,20,0.97)",
            borderRight:"1px solid rgba(96,165,250,0.08)",
            padding:"12px 0",
            display:"flex",flexDirection:"column",gap:2,
            // FIX: en móvil es drawer lateral
            position: "fixed",
            left: sidebarOpen ? 0 : -220,
            top: 'calc(53px + env(safe-area-inset-top))',
            bottom: 0,
            zIndex: 160,
            transition:"left 0.25s ease",
            overflowY:"auto",
            // En pantallas grandes es siempre visible
            "@media(min-width:640px)": {position:"static",left:0},
          }}>
            <button onClick={()=>{
              setEditCat("password");
              setEditData({title:""});
              setActiveEntry({mode:"new",data:{}});
              setSidebarOpen(false);
            }} style={{margin:"0 10px 10px",padding:"10px",background:"linear-gradient(135deg,#1D4ED8,#1E40AF)",border:"1px solid rgba(96,165,250,0.3)",borderRadius:10,color:"#E2E8F0",cursor:"pointer",fontSize:12,display:"flex",alignItems:"center",justifyContent:"center",gap:6,fontFamily:"inherit",fontWeight:600}}>
              <Icon d={IC.plus} size={14}/>
              Nueva entrada
            </button>

            <SideItem label="Todas" count={entries.length} active={filterCat==="all"}
              onClick={()=>{setFilterCat("all");setSidebarOpen(false);}}/>
            <div style={{height:1,background:"rgba(96,165,250,0.08)",margin:"6px 10px"}}/>
            {CATEGORIES.map(cat=>(
              <SideItem key={cat.id} label={cat.label} count={counts[cat.id]||0}
                active={filterCat===cat.id} color={cat.color} icon={IC[cat.icon]}
                onClick={()=>{setFilterCat(cat.id);setSidebarOpen(false);}}/>
            ))}
          </aside>

          {/* Lista de entradas */}
          <main style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minWidth:0}}>
            {/* Search */}
            <div style={{padding:"12px 14px",borderBottom:"1px solid rgba(96,165,250,0.08)",flexShrink:0}}>
              <div style={{position:"relative"}}>
                <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:"#475569",pointerEvents:"none"}}>
                  <Icon d={IC.search} size={15}/>
                </span>
                <input value={search} onChange={e=>setSearch(e.target.value)}
                  placeholder="Buscar…"
                  style={{width:"100%",padding:"9px 10px 9px 32px",background:"rgba(15,23,42,0.8)",border:"1px solid rgba(96,165,250,0.15)",borderRadius:10,color:"#E2E8F0",fontSize:13,fontFamily:"inherit",outline:"none",boxSizing:"border-box"}}/>
              </div>
            </div>

            {/* Entries */}
            <div style={{flex:1,overflowY:"auto",padding:"10px 12px",display:"flex",flexDirection:"column",gap:7}}>
              {filtered.length===0?(
                <div style={{textAlign:"center",padding:"50px 20px",color:"#334155"}}>
                  <Icon d={IC.shield} size={44} stroke="#1E3A5F"/>
                  <p style={{marginTop:14,fontSize:13,lineHeight:1.7,color:"#475569"}}>
                    {entries.length===0?"Tu bóveda está vacía.\nCrea tu primera entrada.":"Sin resultados."}
                  </p>
                </div>
              ):filtered.map(e=>{
                const cat=getCat(e.category);
                const isActive=activeEntry?.data?.id===e.id;
                return (
                  <div key={e.id}
                    onClick={()=>{setActiveEntry({mode:"view",data:e});setRevealed({});setSidebarOpen(false);}}
                    style={{padding:"12px 14px",borderRadius:12,cursor:"pointer",
                      background:isActive?"rgba(96,165,250,0.08)":"rgba(15,23,42,0.6)",
                      border:`1px solid ${isActive?"rgba(96,165,250,0.25)":"rgba(96,165,250,0.08)"}`,
                      display:"flex",alignItems:"center",gap:12,transition:"all 0.15s"}}>
                    <div style={{width:36,height:36,borderRadius:9,flexShrink:0,background:`${cat.color}15`,border:`1px solid ${cat.color}30`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                      <Icon d={IC[cat.icon]} size={17} stroke={cat.color}/>
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:13,fontWeight:600,color:"#E2E8F0",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.title}</div>
                      <div style={{fontSize:11,color:"#475569",marginTop:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                        {e.username||e.ssid||e.cardNumber?.replace(/(.{4})/g,"$1 ").trim()||cat.label}
                      </div>
                    </div>
                    <div style={{fontSize:10,color:"#334155",flexShrink:0}}>{new Date(e.updatedAt).toLocaleDateString("es-ES",{day:"2-digit",month:"2-digit"})}</div>
                  </div>
                );
              })}
            </div>
          </main>

          {/* Detail panel */}
          {activeEntry&&(
            <DetailPanel
              mode={activeEntry.mode}
              data={activeEntry.data}
              editData={editData} setEditData={setEditData}
              editCat={editCat} setEditCat={cat=>{
                setEditCat(cat);
                setEditData(d=>({title:d.title})); // limpiar campos al cambiar categoría
              }}
              revealed={revealed} setRevealed={setRevealed}
              onSave={handleSave}
              onClose={()=>{setActiveEntry(null);setEditData({});}}
              onEdit={()=>{
                setEditData({...activeEntry.data});
                setEditCat(activeEntry.data.category||"password");
                setActiveEntry({mode:"edit",data:activeEntry.data});
              }}
              onDelete={()=>setDelConfirm(activeEntry.data.id)}
              onCopy={copy}
            />
          )}
        </div>
      )}

      {/* ── BOTTOM TAB BAR — siempre visible, nunca tapado */}
      <nav style={{
        position:'fixed', bottom:0, left:0, right:0,
        paddingBottom:'max(8px, env(safe-area-inset-bottom))',
        paddingTop:'10px',
        paddingLeft:'max(16px, env(safe-area-inset-left))',
        paddingRight:'max(16px, env(safe-area-inset-right))',
        background:'rgba(10,13,20,0.98)',
        borderTop:'1px solid rgba(96,165,250,0.1)',
        display:'flex', alignItems:'center', justifyContent:'space-around',
        zIndex:300,
        backdropFilter:'blur(12px)',
      }}>
        {/* Inicio / Bóveda */}
        <button onClick={()=>{setPanel('vault');setActiveEntry(null);setSidebarOpen(false);}} style={{
          display:'flex',flexDirection:'column',alignItems:'center',gap:3,
          padding:'6px 16px', borderRadius:10,
          background:panel==='vault'&&!activeEntry?'rgba(96,165,250,0.1)':'transparent',
          border:'1px solid '+(panel==='vault'&&!activeEntry?'rgba(96,165,250,0.2)':'transparent'),
          cursor:'pointer', color:panel==='vault'&&!activeEntry?'#93C5FD':'#475569',
          fontFamily:'inherit',
        }}>
          <Icon d={IC.shield} size={20} stroke={panel==='vault'&&!activeEntry?'#93C5FD':'#475569'}/>
          <span style={{fontSize:9,letterSpacing:'0.5px'}}>BÓVEDA</span>
        </button>

        {/* Nueva entrada — botón central destacado */}
        <button onClick={()=>{setEditCat('password');setEditData({title:''});setActiveEntry({mode:'new',data:{}});setPanel('vault');}} style={{
          display:'flex',flexDirection:'column',alignItems:'center',gap:3,
          padding:'6px 16px', borderRadius:10,
          background:'linear-gradient(135deg,#1D4ED8,#1E40AF)',
          border:'1px solid rgba(96,165,250,0.3)',
          cursor:'pointer', color:'#E2E8F0',
          fontFamily:'inherit',
          boxShadow:'0 0 16px rgba(29,78,216,0.4)',
        }}>
          <Icon d={IC.plus} size={20} stroke='#E2E8F0'/>
          <span style={{fontSize:9,letterSpacing:'0.5px'}}>AÑADIR</span>
        </button>

        {/* Backup */}
        <button onClick={()=>{setPanel('backup');setActiveEntry(null);}} style={{
          display:'flex',flexDirection:'column',alignItems:'center',gap:3,
          padding:'6px 16px', borderRadius:10,
          background:panel==='backup'?'rgba(96,165,250,0.1)':'transparent',
          border:'1px solid '+(panel==='backup'?'rgba(96,165,250,0.2)':'transparent'),
          cursor:'pointer', color:panel==='backup'?'#93C5FD':'#475569',
          fontFamily:'inherit',
          position:'relative',
        }}>
          <Icon d={IC.backup} size={20} stroke={panel==='backup'?'#93C5FD':'#475569'}/>
          <span style={{fontSize:9,letterSpacing:'0.5px'}}>BACKUP</span>
          {bkWarn&&<span style={{position:'absolute',top:4,right:12,width:7,height:7,borderRadius:'50%',background:'#F59E0B',boxShadow:'0 0 5px rgba(245,158,11,0.7)'}}/>}
        </button>

        {/* Bloquear */}
        <button onClick={()=>{setPhase('unlock');setEntries([]);setMasterPw('');}} style={{
          display:'flex',flexDirection:'column',alignItems:'center',gap:3,
          padding:'6px 16px', borderRadius:10,
          background:'transparent',
          border:'1px solid transparent',
          cursor:'pointer', color:'#EF4444',
          fontFamily:'inherit',
        }}>
          <Icon d={IC.lock} size={20} stroke='#EF4444'/>
          <span style={{fontSize:9,letterSpacing:'0.5px'}}>CERRAR</span>
        </button>
      </nav>

      {/* Delete modal */}
      {delConfirm&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999,padding:20}}>
          <div style={{background:"#0F172A",border:"1px solid rgba(239,68,68,0.3)",borderRadius:16,padding:"24px 28px",maxWidth:340,width:"100%"}}>
            <h3 style={{margin:"0 0 10px",color:"#FCA5A5",fontSize:15}}>¿Eliminar entrada?</h3>
            <p style={{margin:"0 0 20px",color:"#64748B",fontSize:12}}>Esta acción no se puede deshacer.</p>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>setDelConfirm(null)} style={btnSecondary}>Cancelar</button>
              <button onClick={()=>handleDelete(delConfirm)} style={{...btnSecondary,flex:1,background:"rgba(239,68,68,0.15)",borderColor:"rgba(239,68,68,0.3)",color:"#EF4444"}}>Eliminar</button>
            </div>
          </div>
        </div>
      )}

      <style>{globalCSS}</style>
    </div>
  );
}

// ─── DETAIL PANEL ──────────────────────────────────────────────────────────
function DetailPanel({mode,data,editData,setEditData,editCat,setEditCat,revealed,setRevealed,onSave,onClose,onEdit,onDelete,onCopy}) {
  const isView = mode==="view";
  const isEdit = !isView;
  // FIX: en vista usa la categoría del dato; en edición usa editCat
  const cat    = getCat(isView ? (data?.category||"password") : editCat);
  const fields = FIELDS[cat.id]||FIELDS.password;

  return (
    <div style={{
      // FIX: en móvil ocupa toda la pantalla como overlay; en desktop panel lateral
      position:"fixed", inset:0, zIndex:180,
      background:"rgba(10,14,22,0.99)",
      display:"flex", flexDirection:"column",
      overflowY:"auto",
      // En desktop sería lateral — por ahora full-screen en todos para simplicidad móvil
    }}>
      {/* Panel header */}
      <div style={{display:"flex",alignItems:"center",gap:10,paddingTop:"max(14px, calc(14px + env(safe-area-inset-top)))",paddingBottom:"14px",paddingLeft:"16px",paddingRight:"16px",borderBottom:"1px solid rgba(96,165,250,0.1)",position:"sticky",top:0,background:"rgba(10,14,22,0.99)",zIndex:10,flexShrink:0}}>
        <button onClick={onClose} style={btnIcon}>
          <Icon d={IC.chevronL} size={18} stroke="#64748B"/>
        </button>
        <div style={{width:30,height:30,borderRadius:8,background:`${cat.color}15`,border:`1px solid ${cat.color}30`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          <Icon d={IC[cat.icon]} size={15} stroke={cat.color}/>
        </div>
        <span style={{flex:1,fontSize:13,color:"#94A3B8",fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
          {isEdit?(mode==="new"?"Nueva entrada":"Editar entrada"):(data?.title||"Detalle")}
        </span>
        {isView&&(
          <div style={{display:"flex",gap:6}}>
            <SmBtn icon={IC.edit} onClick={onEdit}/>
            <SmBtn icon={IC.trash} onClick={onDelete} danger/>
          </div>
        )}
      </div>

      <div style={{flex:1,padding:"16px",paddingBottom:"calc(16px + 60px + env(safe-area-inset-bottom))",display:"flex",flexDirection:"column",gap:14,maxWidth:600,width:"100%",margin:"0 auto",boxSizing:"border-box"}}>

        {/* FIX: selector de categoría en nueva entrada */}
        {isEdit&&mode==="new"&&(
          <div>
            <label style={lbl}>Categoría</label>
            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
              {CATEGORIES.map(c=>(
                <button key={c.id} onClick={()=>setEditCat(c.id)} style={{
                  padding:"6px 12px",borderRadius:8,fontSize:12,
                  background:editCat===c.id?`${c.color}20`:"rgba(15,23,42,0.6)",
                  border:`1px solid ${editCat===c.id?c.color+"50":"rgba(96,165,250,0.1)"}`,
                  color:editCat===c.id?c.color:"#64748B",
                  cursor:"pointer",fontFamily:"inherit",
                  display:"flex",alignItems:"center",gap:5,
                }}>
                  <Icon d={IC[c.icon]} size={12} stroke={editCat===c.id?c.color:"#64748B"}/>
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Título */}
        <div>
          <label style={lbl}>Título</label>
          {isView
            ?<p style={val}>{data?.title}</p>
            :<input value={editData.title||""} onChange={e=>setEditData(p=>({...p,title:e.target.value}))}
               placeholder="Nombre de la entrada" style={inp} autoFocus/>}
        </div>

        {/* FIX: campos específicos por categoría */}
        {fields.map(f=>{
          const v = isView ? data?.[f.key] : editData[f.key];
          if(isView&&!v) return null;
          const secret = f.type==="password";
          const shown  = revealed[f.key];
          return (
            <div key={f.key}>
              <label style={lbl}>{f.label}</label>
              {isView?(
                <div style={{display:"flex",alignItems:"flex-start",gap:8}}>
                  <div style={{flex:1,padding:"9px 11px",background:"rgba(15,23,42,0.6)",border:"1px solid rgba(96,165,250,0.08)",borderRadius:9,fontSize:13,color:"#94A3B8",wordBreak:"break-all",fontFamily:"inherit",lineHeight:1.5}}>
                    {secret&&!shown?"•".repeat(Math.min((v||"").length,16)):(v||"—")}
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:5,flexShrink:0}}>
                    {secret&&<SmBtn icon={shown?IC.eyeOff:IC.eye} onClick={()=>setRevealed(p=>({...p,[f.key]:!p[f.key]}))}/>}
                    {v&&<SmBtn icon={IC.copy} onClick={()=>onCopy(v)}/>}
                  </div>
                </div>
              ):(
                <div>
                  {f.type==="textarea"
                    ?<textarea value={editData[f.key]||""} onChange={e=>setEditData(p=>({...p,[f.key]:e.target.value}))}
                       placeholder={f.placeholder} rows={3}
                       style={{...inp,resize:"vertical",minHeight:72}}/>
                    :(
                      <div style={{display:"flex",gap:6}}>
                        <input type={secret&&!revealed[f.key]?"password":"text"}
                          value={editData[f.key]||""}
                          onChange={e=>setEditData(p=>({...p,[f.key]:e.target.value}))}
                          placeholder={f.placeholder}
                          style={{...inp,flex:1}}/>
                        {secret&&(
                          <>
                            <SmBtn icon={revealed[f.key]?IC.eyeOff:IC.eye} onClick={()=>setRevealed(p=>({...p,[f.key]:!p[f.key]}))}/>
                            <SmBtn icon={IC.refresh} title="Generar" onClick={()=>setEditData(p=>({...p,[f.key]:genPassword()}))}/>
                          </>
                        )}
                      </div>
                    )}
                  {secret&&editData[f.key]&&(()=>{
                    const s=pwStrength(editData[f.key]);
                    return(
                      <div style={{display:"flex",alignItems:"center",gap:6,marginTop:5}}>
                        <div style={{flex:1,height:2,background:"#1E293B",borderRadius:99,overflow:"hidden"}}>
                          <div style={{height:"100%",width:`${(s.score/5)*100}%`,background:s.color,borderRadius:99}}/>
                        </div>
                        <span style={{fontSize:10,color:s.color,whiteSpace:"nowrap"}}>{s.label}</span>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          );
        })}

        {/* Metadata */}
        {isView&&data?.createdAt&&(
          <div style={{paddingTop:14,borderTop:"1px solid rgba(96,165,250,0.08)"}}>
            <div style={{fontSize:10,color:"#334155",lineHeight:2}}>
              <div>Creado: {new Date(data.createdAt).toLocaleString("es-ES")}</div>
              <div>Modificado: {new Date(data.updatedAt).toLocaleString("es-ES")}</div>
              <div style={{marginTop:4,padding:"4px 8px",background:`${getCat(data.category).color}10`,border:`1px solid ${getCat(data.category).color}30`,borderRadius:6,display:"inline-flex",alignItems:"center",gap:5}}>
                <Icon d={IC[getCat(data.category).icon]} size={11} stroke={getCat(data.category).color}/>
                <span style={{color:getCat(data.category).color,fontSize:10}}>{getCat(data.category).label}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Save bar */}
      {isEdit&&(
        <div style={{padding:"12px 16px",paddingBottom:"calc(12px + env(safe-area-inset-bottom))",borderTop:"1px solid rgba(96,165,250,0.08)",background:"rgba(10,14,22,0.99)",position:"sticky",bottom:0,flexShrink:0}}>
          <div style={{display:"flex",gap:8,maxWidth:600,margin:"0 auto"}}>
            <button onClick={onClose} style={btnSecondary}>Cancelar</button>
            <button onClick={onSave} style={{...btnSecondary,flex:1,background:"linear-gradient(135deg,#1D4ED8,#1E40AF)",borderColor:"rgba(96,165,250,0.3)",color:"#E2E8F0"}}>Guardar</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── SMALL COMPONENTS ──────────────────────────────────────────────────────
function PwField({label,value,onChange,show,onToggle,onKeyDown,autoFocus}) {
  return (
    <div style={{width:"100%"}}>
      <label style={lbl}>{label}</label>
      {/* FIX: width:100% + boxSizing para que no se salga */}
      <div style={{position:"relative",width:"100%"}}>
        <input type={show?"text":"password"} value={value}
          onChange={e=>onChange(e.target.value)}
          onKeyDown={onKeyDown} autoFocus={autoFocus}
          style={{
            width:"100%", boxSizing:"border-box",
            padding:"12px 44px 12px 14px",
            background:"rgba(15,23,42,0.8)",
            border:"1px solid rgba(96,165,250,0.15)",
            borderRadius:10, color:"#E2E8F0",
            fontSize:16, // 16px evita zoom automático en iOS
            fontFamily:"inherit",
          }}/>
        <button onClick={onToggle} type="button" style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:"#475569",padding:4,touchAction:"manipulation"}}>
          <Icon d={show?IC.eyeOff:IC.eye} size={18}/>
        </button>
      </div>
    </div>
  );
}

function Toast({msg,type}) {
  const bg = type==="error"?"rgba(239,68,68,0.95)":type==="info"?"rgba(59,130,246,0.95)":"rgba(16,185,129,0.95)";
  return (
    <div style={{position:"fixed",top:16,left:"50%",transform:"translateX(-50%)",background:bg,color:"#fff",padding:"10px 18px",borderRadius:10,fontSize:13,zIndex:9999,boxShadow:"0 4px 20px rgba(0,0,0,0.4)",fontFamily:"'DM Mono',monospace",whiteSpace:"nowrap",maxWidth:"90vw",overflow:"hidden",textOverflow:"ellipsis",animation:"fadeIn 0.2s ease"}}>
      {msg}
    </div>
  );
}

function SideItem({label,count,active,onClick,color,icon}) {
  return (
    <button onClick={onClick} style={{display:"flex",alignItems:"center",gap:9,padding:"8px 14px",margin:"0 8px",background:active?"rgba(96,165,250,0.1)":"transparent",border:active?"1px solid rgba(96,165,250,0.15)":"1px solid transparent",borderRadius:8,cursor:"pointer",textAlign:"left",width:"calc(100% - 16px)",transition:"all 0.15s",fontFamily:"inherit"}}>
      {icon&&<Icon d={icon} size={13} stroke={color||"#64748B"}/>}
      <span style={{flex:1,fontSize:12,color:active?"#E2E8F0":"#64748B"}}>{label}</span>
      {count>0&&<span style={{fontSize:10,padding:"1px 5px",background:active?"rgba(96,165,250,0.2)":"rgba(96,165,250,0.05)",borderRadius:99,color:active?"#93C5FD":"#475569"}}>{count}</span>}
    </button>
  );
}

function SmBtn({icon,onClick,danger,title}) {
  return (
    <button onClick={onClick} title={title} style={{padding:7,background:"rgba(15,23,42,0.8)",border:`1px solid ${danger?"rgba(239,68,68,0.2)":"rgba(96,165,250,0.1)"}`,borderRadius:7,cursor:"pointer",color:danger?"#EF4444":"#475569",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,touchAction:"manipulation"}}>
      <Icon d={icon} size={14}/>
    </button>
  );
}

// ─── SHARED STYLES ─────────────────────────────────────────────────────────
const lbl = {display:"block",fontSize:10,color:"#475569",marginBottom:5,letterSpacing:"1px",textTransform:"uppercase"};
const val = {margin:0,fontSize:13,color:"#94A3B8",wordBreak:"break-all",fontFamily:"inherit",lineHeight:1.5};
const inp = {width:"100%",padding:"10px 12px",background:"rgba(15,23,42,0.8)",border:"1px solid rgba(96,165,250,0.15)",borderRadius:9,color:"#E2E8F0",fontSize:14,fontFamily:"inherit",boxSizing:"border-box",outline:"none"};
const btnIcon = {padding:7,background:"rgba(15,23,42,0.8)",border:"1px solid rgba(96,165,250,0.1)",borderRadius:8,cursor:"pointer",color:"#64748B",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,touchAction:"manipulation"};
const btnSecondary = {padding:"11px 16px",background:"#1E293B",border:"1px solid rgba(96,165,250,0.1)",borderRadius:9,color:"#94A3B8",fontSize:13,cursor:"pointer",fontFamily:"inherit",fontWeight:600};

const globalCSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    height: 100%;
    overflow-x: hidden;
    /* Respetar safe-area en todo el documento */
    padding-top: env(safe-area-inset-top);
    padding-top: 0; /* el header ya lo gestiona con max() */
  }
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
  /* Sidebar visible en pantallas grandes */
  @media(min-width: 640px) {
    aside { position: static !important; left: auto !important; }
  }
  /* Tab labels visibles en pantallas medianas */
  @media(min-width: 480px) {
    .tab-label { display: inline !important; }
  }
`;
