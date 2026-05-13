import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import Layout from './components/Layout'
import HomePage from './pages/HomePage'
import TripsPage from './pages/TripsPage'
import FavoritesPage from './pages/FavoritesPage'
import SettingsPage from './pages/SettingsPage'
import ItineraryPage from './pages/ItineraryPage'

function PrivateRoute() {
  return localStorage.getItem('token') ? <Outlet /> : <Navigate to="/login" replace />
}

export default function App() {
  return (
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
            <Route path="viaje/nuevo" element={<ItineraryPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
