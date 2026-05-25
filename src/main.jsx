import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { GoogleOAuthProvider } from '@react-oauth/google'
import './index.css'
import App from './App.jsx'

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ''

if (!sessionStorage.getItem('sessionActive')) {
  ;['token', 'usuarioId', 'nombreUsuario', 'nombre', 'email', 'loginMethod'].forEach(k => localStorage.removeItem(k))
}
sessionStorage.setItem('sessionActive', 'true')

try {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <GoogleOAuthProvider clientId={googleClientId}>
        <App />
      </GoogleOAuthProvider>
    </StrictMode>,
  )
} catch (e) {
  document.getElementById('root').innerHTML =
    '<div style="padding:40px;font-family:monospace"><h2 style="color:#dc2626">Error al iniciar</h2><pre style="margin-top:16px;background:#fef2f2;padding:16px;border-radius:8px;white-space:pre-wrap;font-size:13px">' +
    e.toString() + '\n\n' + e.stack + '</pre></div>'
}
