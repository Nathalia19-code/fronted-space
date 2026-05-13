import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import api from '../api/axiosConfig'

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token')

  const [nuevaPassword, setNuevaPassword] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [exito, setExito] = useState(false)

  useEffect(() => {
    document.body.classList.add('login-body')
    return () => document.body.classList.remove('login-body')
  }, [])

  if (!token) {
    return (
      <div className="login-container">
        <div className="login-form-section">
          <div className="login-form-wrapper">
            <div className="login-logo">
              <div className="logo-icon">N</div>
              <span className="logo-text">Naval</span>
            </div>
            <p className="login-error">Enlace no válido. Solicita uno nuevo desde la pantalla de inicio de sesión.</p>
          </div>
        </div>
      </div>
    )
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (nuevaPassword !== confirmar) {
      setError('Las contraseñas no coinciden')
      return
    }
    setError('')
    setLoading(true)
    try {
      await api.post('/auth/reset-password', { token, nuevaPassword })
      setExito(true)
      setTimeout(() => navigate('/login'), 3000)
    } catch (err) {
      setError(err.response?.data?.message || 'El enlace no es válido o ha caducado')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-container">
      <div className="login-image-section">
        <div className="login-quote">
          <h2>"El mundo es un libro, y quienes no viajan leen solo una página."</h2>
          <p>– San Agustín</p>
        </div>
      </div>

      <div className="login-form-section">
        <div className="login-form-wrapper">
          <div className="login-logo">
            <div className="logo-icon">N</div>
            <span className="logo-text">Naval</span>
          </div>

          <h1>Nueva contraseña</h1>
          <p className="login-subtitle">Introduce tu nueva contraseña para recuperar el acceso.</p>

          {error && <p className="login-error">{error}</p>}

          {exito ? (
            <p className="login-success">
              Contraseña actualizada. Redirigiendo al inicio de sesión...
            </p>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="input-group">
                <label>Nueva contraseña</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  required
                  value={nuevaPassword}
                  onChange={e => setNuevaPassword(e.target.value)}
                />
              </div>
              <div className="input-group">
                <label>Confirmar contraseña</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  required
                  value={confirmar}
                  onChange={e => setConfirmar(e.target.value)}
                />
              </div>
              <button type="submit" className="btn-submit" disabled={loading}>
                {loading ? 'Guardando...' : 'Cambiar contraseña'}
              </button>
            </form>
          )}

          <p className="login-footer">
            <a href="#" onClick={e => { e.preventDefault(); navigate('/login') }}>
              Volver al inicio de sesión
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
