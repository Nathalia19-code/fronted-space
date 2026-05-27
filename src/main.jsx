import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { GoogleOAuthProvider } from '@react-oauth/google'
import './index.css'
import App from './App.jsx'

/**
 * Punto de entrada de la web.
 *
 * <p>Implementa un sentinel de sesión con {@code sessionStorage}: al cargar (nueva
 * pestaña, refresh o apertura del navegador), comprueba si {@code sessionActive} existe.
 * Si no existe, limpia las seis claves de sesión de {@code localStorage} (token,
 * usuarioId, nombreUsuario, nombre, email, loginMethod) para forzar re-login. Tras el
 * check, escribe {@code sessionActive}, que persiste mientras la pestaña viva pero se
 * borra al cerrarla o refrescarla.
 *
 * <p>Envuelve la aplicación en {@code StrictMode} y {@code GoogleOAuthProvider}. Si
 * {@code createRoot} lanza una excepción, renderiza un panel de error inline sin
 * crashear el proceso.
 */
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
