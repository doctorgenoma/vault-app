import React from 'react'
import ReactDOM from 'react-dom/client'
import VaultApp from './VaultApp.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <VaultApp />
  </React.StrictMode>
)

// Register Service Worker for PWA (offline support)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // SW registration failed silently — app still works
    })
  })
}
