import { useState, useEffect } from 'react'
import api from '../api/axiosConfig'

export default function SettingsPage() {
  const [nombre, setNombre] = useState('')
  const [apellido, setApellido] = useState('')
  const [email, setEmail] = useState('')
  const [passwordActual, setPasswordActual] = useState('')
  const [nuevaPassword, setNuevaPassword] = useState('')
  const [notifPrecios, setNotifPrecios] = useState(true)
  const [notifCollab, setNotifCollab] = useState(true)
  const [profileMsg, setProfileMsg] = useState(null)
  const [passwordMsg, setPasswordMsg] = useState(null)
  const [loadingProfile, setLoadingProfile] = useState(false)
  const [loadingPassword, setLoadingPassword] = useState(false)

  useEffect(() => {
    api.get('/usuarios/me')
      .then(res => {
        setNombre(res.data.nombre || '')
        setApellido(res.data.apellido || '')
        setEmail(res.data.email || '')
      })
      .catch(() => {})
  }, [])

  async function handleSaveProfile(e) {
    e.preventDefault()
    setLoadingProfile(true)
    setProfileMsg(null)
    try {
      await api.put('/usuarios/me', { nombre, apellido, email })
      localStorage.setItem('nombre', nombre)
      setProfileMsg({ type: 'success', text: 'Cambios guardados correctamente.' })
    } catch (err) {
      setProfileMsg({
        type: 'error',
        text: err.response?.data?.message || 'Error al guardar los cambios.'
      })
    } finally {
      setLoadingProfile(false)
    }
  }

  async function handleSavePassword(e) {
    e.preventDefault()
    if (!passwordActual || !nuevaPassword) {
      setPasswordMsg({ type: 'error', text: 'Rellena ambos campos.' })
      return
    }
    setLoadingPassword(true)
    setPasswordMsg(null)
    try {
      await api.put('/usuarios/me/password', { passwordActual, nuevaPassword })
      setPasswordActual('')
      setNuevaPassword('')
      setPasswordMsg({ type: 'success', text: 'Contraseña actualizada correctamente.' })
    } catch (err) {
      setPasswordMsg({
        type: 'error',
        text: err.response?.data?.message || 'Error al actualizar la contraseña.'
      })
    } finally {
      setLoadingPassword(false)
    }
  }

  return (
    <div style={{ maxWidth: '600px' }}>
      <header className="section-header">
        <h2>Configuración de Cuenta</h2>
      </header>

      <div className="settings-card">
        <h3>Datos del Perfil</h3>
        <form onSubmit={handleSaveProfile}>
          <div className="input-group">
            <label>Nombre</label>
            <input
              type="text"
              value={nombre}
              onChange={e => setNombre(e.target.value)}
            />
          </div>
          <div className="input-group">
            <label>Apellido</label>
            <input
              type="text"
              value={apellido}
              onChange={e => setApellido(e.target.value)}
            />
          </div>
          <div className="input-group" style={{ marginBottom: '20px' }}>
            <label>Correo Electrónico</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>
          {profileMsg && (
            <p
              className={profileMsg.type === 'success' ? 'login-success' : 'login-error'}
              style={{ marginBottom: '12px' }}
            >
              {profileMsg.text}
            </p>
          )}
          <button type="submit" className="btn-buscar" disabled={loadingProfile}>
            {loadingProfile ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </form>
      </div>

      <div className="settings-card">
        <h3>Seguridad</h3>
        <form onSubmit={handleSavePassword}>
          <div className="input-group">
            <label>Contraseña Actual</label>
            <input
              type="password"
              placeholder="••••••••"
              value={passwordActual}
              onChange={e => setPasswordActual(e.target.value)}
            />
          </div>
          <div className="input-group" style={{ marginBottom: '20px' }}>
            <label>Nueva Contraseña</label>
            <input
              type="password"
              placeholder="••••••••"
              value={nuevaPassword}
              onChange={e => setNuevaPassword(e.target.value)}
            />
          </div>
          {passwordMsg && (
            <p
              className={passwordMsg.type === 'success' ? 'login-success' : 'login-error'}
              style={{ marginBottom: '12px' }}
            >
              {passwordMsg.text}
            </p>
          )}
          <button type="submit" className="btn-buscar" disabled={loadingPassword}>
            {loadingPassword ? 'Actualizando...' : 'Actualizar Contraseña'}
          </button>
        </form>
      </div>

      <div className="settings-card">
        <h3>Preferencias de Notificaciones</h3>
        <label style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '15px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={notifPrecios}
            onChange={e => setNotifPrecios(e.target.checked)}
          />
          Recibir alertas de bajada de precios en mis favoritos
        </label>
        <label style={{ display: 'flex', gap: '10px', alignItems: 'center', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={notifCollab}
            onChange={e => setNotifCollab(e.target.checked)}
          />
          Notificar cuando un colaborador edite un itinerario
        </label>
      </div>
    </div>
  )
}
