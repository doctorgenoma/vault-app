import React from 'react'
import ReactDOM from 'react-dom/client'
import VaultApp from './VaultApp.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <VaultApp />
  </React.StrictMode>
)

// Registrar Service Worker para PWA offline
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {})
  })
}
