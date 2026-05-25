import { useState, useEffect } from 'react'
import api from '../api/axiosConfig'

const PASSWORD_REGEX = /^(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/
const PASSWORD_HINT = 'Mínimo 8 caracteres, un número y un símbolo'

export default function SettingsPage() {
  const [nombre, setNombre] = useState('')
  const [apellido, setApellido] = useState('')
  const [email, setEmail] = useState('')
  const [passwordActual, setPasswordActual] = useState('')
  const [nuevaPassword, setNuevaPassword] = useState('')
  const [confirmarPassword, setConfirmarPassword] = useState('')
  const [profileMsg, setProfileMsg] = useState(null)
  const [passwordMsg, setPasswordMsg] = useState(null)
  const [loadingProfile, setLoadingProfile] = useState(false)
  const [loadingPassword, setLoadingPassword] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [passwordConf, setPasswordConf] = useState('')
  const [confirmError, setConfirmError] = useState('')
  const esGoogle = localStorage.getItem('loginMethod') === 'google'

  useEffect(() => {
    api.get('/usuarios/me')
      .then(res => {
        setNombre(res.data.nombre || '')
        setApellido(res.data.apellido || '')
        setEmail(res.data.email || '')
      })
      .catch(() => {})
  }, [])

  function handleSaveProfile(e) {
    e.preventDefault()
    if (esGoogle) {
      submitProfile('')
    } else {
      setPasswordConf('')
      setConfirmError('')
      setShowConfirmModal(true)
    }
  }

  async function submitProfile(conf) {
    setLoadingProfile(true)
    setProfileMsg(null)
    try {
      const payload = esGoogle
        ? { nombre, apellido }
        : { nombre, apellido, email, passwordConfirmacion: conf }
      await api.put('/usuarios/me', payload)
      localStorage.setItem('nombre', nombre)
      if (!esGoogle) localStorage.setItem('email', email)
      setProfileMsg({ type: 'success', text: 'Cambios guardados correctamente.' })
    } catch (err) {
      const msg = err.response?.data?.message || 'Error al guardar los cambios.'
      if (!esGoogle && msg.toLowerCase().includes('contraseña')) {
        setConfirmError(msg)
        setShowConfirmModal(true)
      } else {
        setProfileMsg({ type: 'error', text: msg })
      }
    } finally {
      setLoadingProfile(false)
    }
  }

  async function handleConfirmModal(e) {
    e.preventDefault()
    if (!passwordConf) {
      setConfirmError('Introduce tu contraseña actual.')
      return
    }
    setShowConfirmModal(false)
    await submitProfile(passwordConf)
    setPasswordConf('')
  }

  async function handleSavePassword(e) {
    e.preventDefault()
    if (!passwordActual || !nuevaPassword || !confirmarPassword) {
      setPasswordMsg({ type: 'error', text: 'Rellena todos los campos.' })
      return
    }
    if (!PASSWORD_REGEX.test(nuevaPassword)) {
      setPasswordMsg({ type: 'error', text: `La nueva contraseña no cumple los requisitos: ${PASSWORD_HINT}.` })
      return
    }
    if (nuevaPassword !== confirmarPassword) {
      setPasswordMsg({ type: 'error', text: 'Las contraseñas nuevas no coinciden.' })
      return
    }
    setLoadingPassword(true)
    setPasswordMsg(null)
    try {
      await api.put('/usuarios/me/password', { passwordActual, nuevaPassword })
      setPasswordActual('')
      setNuevaPassword('')
      setConfirmarPassword('')
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
          <div className="input-group" style={{ marginBottom: esGoogle ? '8px' : '20px' }}>
            <label>Correo Electrónico</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              disabled={esGoogle}
              style={esGoogle ? { opacity: 0.6, cursor: 'not-allowed' } : {}}
            />
          </div>
          {esGoogle && (
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
              El correo está vinculado a tu cuenta de Google y no puede modificarse aquí.
            </p>
          )}
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
        {esGoogle ? (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '14px 16px', background: 'var(--surface-2)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <i className="ph ph-google-logo" style={{ fontSize: '20px', color: 'var(--text-secondary)', flexShrink: 0, marginTop: '2px' }}></i>
            <div>
              <p style={{ margin: '0 0 4px 0', fontWeight: '600', fontSize: '14px' }}>Cuenta vinculada con Google</p>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
                Tu acceso está gestionado por Google. La contraseña se administra desde tu cuenta de Google y no puede cambiarse aquí.
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSavePassword}>
            <div className="input-group">
              <label>Contraseña Actual</label>
              <input
                type="password"
                placeholder="••••••••"
                value={passwordActual}
                onChange={e => setPasswordActual(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <div className="input-group">
              <label>Nueva Contraseña</label>
              <input
                type="password"
                placeholder={PASSWORD_HINT}
                value={nuevaPassword}
                onChange={e => setNuevaPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <div className="input-group" style={{ marginBottom: '20px' }}>
              <label>Confirmar Nueva Contraseña</label>
              <input
                type="password"
                placeholder="••••••••"
                value={confirmarPassword}
                onChange={e => setConfirmarPassword(e.target.value)}
                autoComplete="new-password"
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
        )}
      </div>

      {showConfirmModal && (
        <div className="modal-overlay" onClick={() => setShowConfirmModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowConfirmModal(false)}>
              <i className="ph ph-x"></i>
            </button>
            <h2 className="modal-title">Confirmar cambios</h2>
            <p className="modal-description">Introduce tu contraseña actual para guardar los cambios del perfil.</p>
            {confirmError && <p className="login-error" style={{ marginBottom: '12px' }}>{confirmError}</p>}
            <form onSubmit={handleConfirmModal}>
              <div className="input-group" style={{ marginBottom: '20px' }}>
                <label>Contraseña actual</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={passwordConf}
                  onChange={e => setPasswordConf(e.target.value)}
                  autoComplete="current-password"
                  autoFocus
                />
              </div>
              <button type="submit" className="modal-cta" disabled={loadingProfile}>
                {loadingProfile ? 'Guardando...' : 'Confirmar y guardar'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
