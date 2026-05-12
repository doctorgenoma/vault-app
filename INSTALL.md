# VAULT APP — Guía Completa de Instalación
## Con terminal y sin terminal · GitHub Pages · PWA móvil

---

## ÍNDICE

1. Qué tienes en el ZIP
2. Ajuste previo obligatorio
3. OPCIÓN A — Con terminal
4. OPCIÓN B — Sin terminal (GitHub Desktop)
5. Activar GitHub Pages
6. Instalar como app en el móvil
7. Panel de Backup — cómo usarlo
8. Flujo de trabajo diario
9. Qué hace cada archivo
10. Seguridad — resumen técnico
11. Solución de problemas

---

## 1. Qué tienes en el ZIP

    vault-app-pages/
    ├── src/
    │   ├── VaultApp.jsx        ← Toda la app: bóveda + backup + cifrado
    │   └── main.jsx            ← Punto de entrada React + registro PWA
    ├── public/
    │   ├── manifest.json       ← Permite instalar como app en móvil
    │   ├── sw.js               ← Service Worker (funciona sin internet)
    │   └── icon.svg            ← Icono de la app
    ├── .github/workflows/
    │   └── deploy.yml          ← CI/CD: build automático en cada push
    ├── index.html
    ├── vite.config.js          ← EDITAR ANTES DE SUBIR
    ├── package.json
    ├── .gitignore
    └── INSTALL.md

---

## 2. Ajuste previo obligatorio

Abre vite.config.js con cualquier editor de texto y cambia:

    base: '/vault-app/',

por el nombre EXACTO del repositorio que vayas a crear en GitHub.

Ejemplos:
    base: '/mi-boveda/',      ← si el repo se llama "mi-boveda"
    base: '/passwords/',      ← si el repo se llama "passwords"
    base: '/',                ← si usas dominio propio

IMPORTANTE: Si este valor no coincide, la app carga en blanco.

---

## 3. OPCIÓN A — Con terminal

REQUISITOS (instalar una sola vez):
  - Node.js 18+: https://nodejs.org  (versión LTS)
  - Git:         https://git-scm.com/downloads
  - Cuenta en GitHub: https://github.com

PASO 1 — Instalar y probar en local

    cd vault-app-pages
    npm install
    npm run dev
    # Abre http://localhost:5173 — prueba la app antes de subir

PASO 2 — Crear repositorio vacío en GitHub

  Ve a https://github.com/new
  - Repository name: mismo que pusiste en vite.config.js
  - Visibility: Public  ← obligatorio para GitHub Pages gratis
  - NO marques ninguna casilla de inicialización
  - Clic en "Create repository"

PASO 3 — Subir el código

    git init
    git add .
    git commit -m "feat: vault app inicial"
    git remote add origin https://github.com/TU_USUARIO/vault-app.git
    git branch -M main
    git push -u origin main

El push lanza GitHub Actions automáticamente.
En ~2 minutos la app está en línea.

PASO 4 — Actualizaciones futuras

    git add .
    git commit -m "descripción del cambio"
    git push origin main
    # GitHub Pages se actualiza en ~2 min

---

## 4. OPCIÓN B — Sin terminal (GitHub Desktop)

No requiere instalar Node.js. El build ocurre en la nube (GitHub Actions).

PASO 1 — Instalar GitHub Desktop (una sola vez)

  Descarga: https://desktop.github.com
  Instala e inicia sesión con tu cuenta de GitHub.

PASO 2 — Crear repositorio vacío en GitHub (desde el navegador)

  1. Ve a https://github.com/new
  2. Repository name: mismo nombre que pusiste en vite.config.js
  3. Visibility: Public
  4. NO marques ninguna casilla de inicialización
  5. Clic en "Create repository"

PASO 3 — Abrir la carpeta en GitHub Desktop

  1. Abre GitHub Desktop
  2. Menú: File → Add Local Repository
  3. Navega hasta la carpeta vault-app-pages
  4. Si pregunta "Create a Git repository here?" → clic en Create repository here
  5. En el panel izquierdo verás todos los archivos listos

PASO 4 — Primer commit y publicación

  1. En el campo Summary escribe: feat: vault app inicial
  2. Clic en "Commit to main"
  3. Clic en "Publish repository" (botón azul arriba a la derecha)
  4. En el diálogo:
     - Asegúrate de que "Keep this code private" está DESMARCADO
     - El nombre del repositorio debe coincidir con el de vite.config.js
  5. Clic en "Publish repository"

GitHub Desktop sube todo. GitHub Actions empieza el build.

PASO 5 — Actualizaciones futuras (sin terminal)

  Cuando modifiques algún archivo:
  1. Abre GitHub Desktop — los cambios aparecen en el panel izquierdo
  2. Escribe un Summary descriptivo
  3. Clic en "Commit to main"
  4. Clic en "Push origin"
  5. En ~2 min GitHub Pages se actualiza

---

## 5. Activar GitHub Pages

Hacer UNA SOLA VEZ (igual con terminal o sin terminal):

  1. Ve a: https://github.com/TU_USUARIO/vault-app
  2. Pestaña Settings
  3. Menú lateral izquierdo → Pages
  4. En "Source" selecciona: GitHub Actions
  5. Clic en Save

La URL de tu app será:
    https://TU_USUARIO.github.io/vault-app/

Para verificar el deploy:
  Repo → pestaña Actions → workflow "Deploy to GitHub Pages"
  Círculo verde = OK · Círculo rojo = hay un error (clic para ver)

---

## 6. Instalar como app en el móvil

La app es una PWA: se instala como app nativa sin App Store ni Play Store.

iOS — Safari (obligatorio usar Safari):
  1. Abre la URL en Safari
  2. Botón compartir (cuadrado con flecha)
  3. Desplázate → "Añadir a pantalla de inicio"
  4. Confirmar → la app aparece en el inicio del iPhone/iPad

Android — Chrome:
  1. Abre la URL en Chrome
  2. Banner automático "Añadir a pantalla de inicio" → Instalar
  3. Si no aparece: menú ⋮ → "Instalar aplicación"

Windows / Mac / Linux — Chrome o Edge:
  1. Abre la URL
  2. Icono de instalación en la barra de direcciones (⊕)
  3. Clic → Instalar → la app abre en ventana propia

---

## 7. Panel de Backup — cómo usarlo

La bóveda vive en TU dispositivo (localStorage cifrado).
El backup protege tus datos ante pérdida o rotura del dispositivo.

ACCEDER AL PANEL:
  Una vez dentro de la bóveda → pestaña "Backup" en el menú superior.
  Si hace más de 7 días sin backup, verás un punto naranja de alerta.

EXPORTAR BACKUP:
  1. Panel Backup → botón "Exportar ahora"
  2. Se descarga: vault-backup-FECHA.vault
  3. Este archivo está cifrado con AES-256-GCM
     Sin tu contraseña maestra es completamente ilegible.

  Dónde guardar el .vault:
    Recomendado:  Google Drive, Dropbox, iCloud
    Alternativa:  Disco externo, pendrive
    Emergencia:   Email a ti mismo
    Evitar:       Solo en el mismo dispositivo que tiene la bóveda

RESTAURAR BACKUP:
  1. Panel Backup → "Seleccionar archivo"
  2. Elige el archivo .vault
  3. Introduce la contraseña maestra con la que se cifró
  4. Los datos se restauran en el dispositivo

  AVISO: restaurar reemplaza los datos actuales.
  Si quieres conservar ambos, exporta primero.

HISTORIAL DE BACKUPS:
  El panel muestra los últimos 10 backups (fecha, hora, nº de entradas).
  Es un registro local para saber cuándo fue el último.

ABRIR .VAULT EN WINDOWS/LINUX/MAC (script Python):

    import json, base64
    from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
    from cryptography.hazmat.primitives import hashes
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM

    def decrypt_vault(filepath, password):
        with open(filepath) as f:
            data = json.load(f)
        raw  = base64.b64decode(data['vault'])
        salt = raw[:32]; iv = raw[32:44]; ct = raw[44:]
        kdf  = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32,
                          salt=salt, iterations=310000)
        key  = kdf.derive(password.encode())
        return json.loads(AESGCM(key).decrypt(iv, ct, None))

    # Uso:
    entries = decrypt_vault("vault-backup-2026-05-12.vault", "tu_contraseña")
    for e in entries:
        print(e['title'], '-', e.get('username', ''))

    # Instalar dependencia: pip install cryptography

---

## 8. Flujo de trabajo diario

USO NORMAL:
  1. Abrir app (icono en pantalla de inicio o navegador)
  2. Introducir contraseña maestra → Desbloquear
  3. Buscar / ver / añadir / editar entradas
  4. Bloqueo automático tras 3 min de inactividad
  5. O bloquear manualmente: botón "Bloquear" (esquina superior derecha)

RUTINA DE BACKUP RECOMENDADA:
  Semanal:  Backup → Exportar → Google Drive
  Mensual:  Copia adicional en disco externo
  Siempre:  Antes de cambiar de dispositivo o formatear el móvil

CAMBIAR DE DISPOSITIVO:
  1. En el dispositivo viejo: Backup → Exportar → guardar el .vault
  2. En el dispositivo nuevo: abrir la app → crear bóveda (misma contraseña)
  3. Backup → Restaurar → seleccionar el .vault exportado

---

## 9. Qué hace cada archivo

  VaultApp.jsx       Toda la app: UI, cifrado AES-256, backup, categorías
  main.jsx           Punto de entrada React + registro Service Worker
  manifest.json      Define la PWA: nombre, icono, modo standalone
  sw.js              Cachea la app para uso offline (sin internet)
  icon.svg           Icono del escudo para pantalla de inicio
  index.html         HTML raíz de la Single Page App
  vite.config.js     Build: base URL y optimizaciones de producción
  package.json       Dependencias: React 18, Vite 5
  deploy.yml         CI/CD: build automático en cada git push
  .gitignore         Excluye node_modules, dist y .env del repositorio

---

## 10. Seguridad — resumen técnico

  Algoritmo de cifrado:  AES-256-GCM
  Derivación de clave:   PBKDF2-SHA256
  Iteraciones PBKDF2:    310.000 (recomendación NIST 2024)
  Salt:                  32 bytes aleatorios por cifrado
  IV/Nonce:              12 bytes aleatorios por cifrado
  Almacenamiento:        localStorage cifrado, nunca en claro
  Contraseña maestra:    nunca se almacena ni transmite al servidor
  Motor de cifrado:      Web Crypto API del navegador (nativa, auditada)
  Transporte:            HTTPS TLS 1.3 (GitHub Pages + Let's Encrypt)
  Servidores externos:   ninguno — GitHub solo sirve archivos estáticos
  Auto-lock:             3 minutos de inactividad
  Portabilidad backup:   .vault funciona en cualquier SO con Python

QUÉ PASA SI PIERDO LA CONTRASEÑA MAESTRA:
  No hay recuperación posible. AES-256-GCM sin la clave
  es matemáticamente irrecuperable con la tecnología actual.
  Guarda la contraseña maestra en papel en un lugar seguro
  o en un segundo factor de confianza (gestor físico, caja fuerte).

---

## 11. Solución de problemas

PROBLEMA: La app carga en blanco
  Causa:    El valor de "base" en vite.config.js no coincide con el repo.
  Solución: Corregir base: '/nombre-exacto/' y hacer push.

PROBLEMA: "Page not found" (404) en GitHub Pages
  Causa:    El deploy aún no terminó, o Pages no está activado.
  Solución: Esperar 3 min. Comprobar repo → Actions → que esté verde.
            Comprobar Settings → Pages → Source = GitHub Actions.

PROBLEMA: La app no se instala en iOS
  Causa:    Solo Safari permite instalar PWAs en iOS.
  Solución: Abrir la URL en Safari (no Chrome, no Firefox).

PROBLEMA: El backup no se descarga en móvil
  En Safari iOS: el archivo se abre en pantalla.
  Solución: Toca "Compartir" → "Guardar en Archivos" → elige ubicación.
  En Android: asegúrate de que el navegador tiene permiso de descarga.

PROBLEMA: "Contraseña incorrecta" al restaurar backup
  Causa:    El .vault fue cifrado con una contraseña maestra diferente.
  Solución: Prueba contraseñas anteriores. El cifrado es correcto,
            solo la contraseña puede abrir ese backup.

PROBLEMA: Quiero cambiar la contraseña maestra
  Esta función llega en la próxima versión.
  Por ahora: exporta backup con contraseña actual → crea nueva bóveda
  con la nueva contraseña → importa el backup (pedirá la contraseña antigua).

PROBLEMA: Quiero usar un dominio propio
  1. En vite.config.js cambia base a: '/'
  2. Settings → Pages → Custom domain → escribe tudominio.com
  3. En tu DNS añade estos registros tipo A:
       185.199.108.153
       185.199.109.153
       185.199.110.153
       185.199.111.153
  4. GitHub activa HTTPS automáticamente (puede tardar hasta 24h).

---

VAULT App · AES-256-GCM · Sin servidores · Datos 100% locales
