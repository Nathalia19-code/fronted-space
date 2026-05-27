import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { Component, lazy, Suspense } from 'react'
import LoginPage from './pages/LoginPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import Layout from './components/Layout'
import HomePage from './pages/HomePage'
import TripsPage from './pages/TripsPage'
import FavoritesPage from './pages/FavoritesPage'
import SettingsPage from './pages/SettingsPage'
const ItineraryPage = lazy(() => import('./pages/ItineraryPage'))

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(error) { return { error } }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: '40px', fontFamily: 'monospace' }}>
          <h2 style={{ color: '#dc2626' }}>Error de la aplicación</h2>
          <pre style={{ marginTop: '16px', background: '#fef2f2', padding: '16px', borderRadius: '8px', whiteSpace: 'pre-wrap', fontSize: '13px' }}>
            {this.state.error.toString()}
            {'\n\n'}
            {this.state.error.stack}
          </pre>
        </div>
      )
    }
    return this.props.children
  }
}

function PrivateRoute() {
  return localStorage.getItem('token') ? <Outlet /> : <Navigate to="/login" replace />
}

/**
 * Componente raíz de la web. Define el árbol de rutas con React Router.
 *
 * <p>{@code PrivateRoute} comprueba {@code localStorage.getItem('token')}; si no hay
 * token redirige a {@code /login}. No verifica la expiración: el interceptor de axios
 * se encarga de redirigir al recibir un 401 o 403 del backend.
 *
 * <p>{@code ErrorBoundary} captura errores de render en cualquier hijo y muestra un
 * panel de diagnóstico inline en lugar de dejar la pantalla en blanco.
 *
 * <p>{@code ItineraryPage} se carga con {@code React.lazy} para separarlo del bundle
 * principal, ya que importa Yjs, Tiptap y html2canvas.
 *
 * <p>Rutas:
 * <ul>
 *   <li>{@code /login} -> LoginPage (pública)
 *   <li>{@code /reset-password} -> ResetPasswordPage (pública)
 *   <li>{@code /} -> HomePage (privada)
 *   <li>{@code /itinerarios} -> TripsPage (privada)
 *   <li>{@code /favoritos} -> FavoritesPage (privada)
 *   <li>{@code /configuracion} -> SettingsPage (privada)
 *   <li>{@code /viaje/:id} -> ItineraryPage (privada, lazy)
 *   <li>Resto -> redirige a {@code /}
 * </ul>
 */
export default function App() {
  return (
    <ErrorBoundary>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route element={<PrivateRoute />}>
          <Route path="/" element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="itinerarios" element={<TripsPage />} />
            <Route path="favoritos" element={<FavoritesPage />} />
            <Route path="configuracion" element={<SettingsPage />} />
            <Route path="viaje/:id" element={<Suspense fallback={null}><ItineraryPage /></Suspense>} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
    </ErrorBoundary>
  )
}
