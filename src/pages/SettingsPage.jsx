import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/axiosConfig'

const PASSWORD_REGEX = /^(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/
const PASSWORD_HINT = 'Mínimo 8 caracteres, un número y un símbolo'

/**
 * Página de configuración de la cuenta del usuario.
 *
 * <p>Al montar carga el perfil con GET {@code /usuarios/me} y rellena los campos de
 * nombre, apellido y email.
 *
 * <p>Sección <em>Datos del Perfil</em>: PUT {@code /usuarios/me} con nombre, apellido
 * y (si no es cuenta Google) email y confirmación de contraseña. Para cuentas de email,
 * el guardado muestra un modal de confirmación de contraseña antes de enviar. Si el
 * backend devuelve error de contraseña, reabre el modal con el mensaje de error.
 * Para cuentas Google, el email no es editable y no se pide confirmación.
 * Tras guardar con éxito actualiza {@code nombre} en {@code localStorage} para que el
 * {@code Sidebar} lo muestre inmediatamente.
 *
 * <p>Sección <em>Seguridad</em>: PUT {@code /usuarios/me/password} con
 * {@code passwordActual} y {@code nuevaPassword}. No disponible para cuentas Google
 * (muestra un aviso informativo). Valida client-side la política de contraseña y que
 * los dos campos coincidan antes de enviar.
 *
 * <p>Sección <em>Zona de peligro</em>: DELETE {@code /usuarios/me} con
 * {@code passwordActual} (o {@code null} para cuentas Google). Solicita confirmación
 * en un modal. Tras la eliminación limpia el {@code localStorage} y redirige a
 * {@code /login}.
 */
export default function SettingsPage() {
  const navigate = useNavigate()
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

  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [deletingAccount, setDeletingAccount] = useState(false)

  useEffect(() => {
    api.get('/usuarios/me')
      .then(res => {
        setNombre(res.data.nombre || '')
        setApellido(res.data.apellido || '')
        setEmail(res.data.email || '')
      })
      .catch(() => {})
  }, [])

  /**
   * Inicia el guardado del perfil. Para cuentas Google lo envía directamente; para
   * cuentas de email abre el modal de confirmación de contraseña.
   *
   * @param {React.FormEvent} e - Evento de envío del formulario de perfil.
   */
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

  /**
   * Envía el perfil actualizado al backend y actualiza {@code localStorage}.
   *
   * <p>Para cuentas de email incluye {@code passwordConfirmacion} en el payload. Si el
   * backend rechaza la contraseña, reabre el modal con el mensaje de error en lugar de
   * mostrarlo como error de perfil. Tras guardar con éxito actualiza {@code nombre} (y
   * {@code email} para cuentas de email) en {@code localStorage} para que el Sidebar lo
   * muestre sin recargar.
   *
   * @param {string} conf - Contraseña de confirmación; cadena vacía para cuentas Google.
   */
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

  /**
   * Valida la contraseña introducida en el modal de confirmación y envía el perfil.
   *
   * <p>Si el campo está vacío muestra un error inline en el modal sin cerrarlo. Si hay
   * contraseña, cierra el modal y delega en {@link submitProfile}.
   *
   * @param {React.FormEvent} e - Evento de envío del formulario del modal.
   */
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

  /**
   * Valida y envía el cambio de contraseña al backend.
   *
   * <p>Comprueba que los tres campos estén rellenos, que la nueva contraseña cumpla la
   * política ({@code PASSWORD_REGEX}: mínimo 8 caracteres, un número y un símbolo) y que
   * los dos campos de nueva contraseña coincidan. Si la validación pasa, envía
   * {@code PUT /usuarios/me/password} y limpia los campos tras el éxito.
   *
   * @param {React.FormEvent} e - Evento de envío del formulario de contraseña.
   */
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

  /**
   * Elimina la cuenta del usuario tras la confirmación en el modal de la zona de peligro.
   *
   * <p>Para cuentas de email exige que se introduzca la contraseña actual; para cuentas
   * Google envía {@code passwordActual: null} (el backend acepta {@code null} en ese caso).
   * Tras la eliminación limpia las seis claves de {@code localStorage} y redirige a
   * {@code /login}.
   *
   * @param {React.FormEvent} e - Evento de envío del formulario del modal de eliminación.
   */
  async function handleEliminarCuenta(e) {
    e.preventDefault()
    if (!esGoogle && !deletePassword) {
      setDeleteError('Introduce tu contraseña para confirmar.')
      return
    }
    setDeletingAccount(true)
    setDeleteError('')
    try {
      await api.delete('/usuarios/me', { data: { passwordActual: deletePassword } })
      ;['token', 'usuarioId', 'nombreUsuario', 'nombre', 'email', 'loginMethod'].forEach(k =>
        localStorage.removeItem(k)
      )
      navigate('/login')
    } catch (err) {
      setDeleteError(err.response?.data?.message || 'Error al eliminar la cuenta.')
      setDeletingAccount(false)
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

      <div className="settings-card" style={{ borderColor: '#fecaca' }}>
        <h3 style={{ color: '#dc2626' }}>Zona de peligro</h3>
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.6 }}>
          Eliminar tu cuenta es una acción permanente e irreversible. Tus itinerarios individuales
          y grupales sin colaboradores se eliminarán. Los itinerarios grupales compartidos se
          transferirán automáticamente a uno de los colaboradores.
        </p>
        <button
          type="button"
          onClick={() => { setDeletePassword(''); setDeleteError(''); setShowDeleteModal(true) }}
          style={{
            background: '#fef2f2',
            color: '#dc2626',
            border: '1px solid #fecaca',
            padding: '10px 18px',
            borderRadius: '8px',
            fontWeight: '600',
            fontSize: '14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <i className="ph ph-trash"></i>
          Eliminar mi cuenta
        </button>
      </div>

      {showDeleteModal && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowDeleteModal(false)}>
              <i className="ph ph-x"></i>
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <i className="ph ph-warning" style={{ fontSize: '20px', color: '#dc2626' }}></i>
              </div>
              <h2 className="modal-title" style={{ margin: 0, color: '#dc2626' }}>Eliminar cuenta</h2>
            </div>
            <p className="modal-description">
              Esta acción es <strong>permanente e irreversible</strong>. Se eliminarán tus favoritos
              y tus itinerarios individuales. Los itinerarios grupales compartidos pasarán a otro colaborador.
            </p>
            {deleteError && <p className="login-error" style={{ marginBottom: '12px' }}>{deleteError}</p>}
            <form onSubmit={handleEliminarCuenta}>
              {!esGoogle && (
                <div className="input-group" style={{ marginBottom: '20px' }}>
                  <label>Introduce tu contraseña para confirmar</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={deletePassword}
                    onChange={e => setDeletePassword(e.target.value)}
                    autoComplete="current-password"
                    autoFocus
                  />
                </div>
              )}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'transparent', cursor: 'pointer', fontWeight: '500', fontSize: '14px' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={deletingAccount}
                  style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: '#dc2626', color: 'white', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}
                >
                  {deletingAccount ? 'Eliminando...' : 'Eliminar permanentemente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
