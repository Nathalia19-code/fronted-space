import { useState, useEffect } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useGoogleLogin } from '@react-oauth/google'
import api from '../api/axiosConfig'

export default function LoginPage() {
  const [isRegister, setIsRegister] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showForgot, setShowForgot] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotStatus, setForgotStatus] = useState('')
  const navigate = useNavigate()

  const [loginData, setLoginData] = useState({ email: '', password: '' })
  const [registerData, setRegisterData] = useState({
    nombreUsuario: '', nombre: '', apellido: '',
    email: '', password: '', telefono: '', fechaNacimiento: ''
  })

  useEffect(() => {
    document.body.classList.add('login-body')
    return () => document.body.classList.remove('login-body')
  }, [])

  if (localStorage.getItem('token')) {
    return <Navigate to="/" replace />
  }

  function guardarSesion(data) {
    localStorage.setItem('token', data.token)
    localStorage.setItem('usuarioId', data.usuarioId)
    localStorage.setItem('nombreUsuario', data.nombreUsuario)
    localStorage.setItem('nombre', data.nombre)
    localStorage.setItem('email', data.email)
  }

  async function handleLogin(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await api.post('/auth/login', loginData)
      guardarSesion(res.data)
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.message || 'Email o contraseña incorrectos')
    } finally {
      setLoading(false)
    }
  }

  async function handleRegister(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await api.post('/auth/register', registerData)
      guardarSesion(res.data)
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.message || 'Error al crear la cuenta')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (response) => {
      setError('')
      setLoading(true)
      try {
        const res = await api.post('/auth/google', { accessToken: response.access_token })
        guardarSesion(res.data)
        navigate('/')
      } catch (err) {
        setError(err.response?.data?.message || 'Error al iniciar sesión con Google')
      } finally {
        setLoading(false)
      }
    },
    onError: () => setError('Error al iniciar sesión con Google')
  })

  async function handleForgotPassword(e) {
    e.preventDefault()
    setForgotStatus('loading')
    try {
      await api.post('/auth/forgot-password', { email: forgotEmail })
      setForgotStatus('success')
    } catch (err) {
      setForgotStatus(err.response?.data?.message || 'Error al enviar el email')
    }
  }

  function cambiarModo(registro) {
    setIsRegister(registro)
    setError('')
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

          {error && <p className="login-error">{error}</p>}

          {!isRegister ? (
            <>
              <h1>Te damos la bienvenida</h1>
              <p className="login-subtitle">Inicia sesión para planificar tu próxima aventura.</p>

              <button className="btn-google" onClick={() => handleGoogleLogin()}>
                <img
                  src="https://www.svgrepo.com/show/475656/google-color.svg"
                  alt="Google Logo"
                  className="google-icon"
                />
                Continuar con Google
              </button>

              <div className="login-divider">
                <span>o iniciar sesión con email</span>
              </div>

              <form onSubmit={handleLogin}>
                <div className="input-group">
                  <label htmlFor="email">Email</label>
                  <input
                    type="email"
                    id="email"
                    placeholder="ejemplo@correo.com"
                    required
                    value={loginData.email}
                    onChange={e => setLoginData({ ...loginData, email: e.target.value })}
                  />
                </div>
                <div className="input-group">
                  <label htmlFor="password">Contraseña</label>
                  <input
                    type="password"
                    id="password"
                    placeholder="••••••••"
                    required
                    value={loginData.password}
                    onChange={e => setLoginData({ ...loginData, password: e.target.value })}
                  />
                </div>
                <div className="login-options">
                  <a href="#" className="forgot-password" onClick={e => { e.preventDefault(); setShowForgot(true); setForgotStatus(''); setForgotEmail('') }}>
                    ¿Olvidaste tu contraseña?
                  </a>
                </div>
                <button type="submit" className="btn-submit" disabled={loading}>
                  {loading ? 'Cargando...' : 'Iniciar Sesión'}
                </button>
              </form>

              <p className="login-footer">
                ¿No tienes cuenta?{' '}
                <a href="#" onClick={e => { e.preventDefault(); cambiarModo(true) }}>
                  Regístrate gratis
                </a>
              </p>
            </>
          ) : (
            <>
              <h1>Crear cuenta</h1>
              <p className="login-subtitle">Únete a Naval y empieza a planificar tus viajes.</p>

              <form onSubmit={handleRegister}>
                <div className="input-group">
                  <label>Nombre de usuario</label>
                  <input
                    type="text"
                    placeholder="mi_usuario"
                    required
                    value={registerData.nombreUsuario}
                    onChange={e => setRegisterData({ ...registerData, nombreUsuario: e.target.value })}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div className="input-group">
                    <label>Nombre</label>
                    <input
                      type="text"
                      placeholder="Juan"
                      required
                      value={registerData.nombre}
                      onChange={e => setRegisterData({ ...registerData, nombre: e.target.value })}
                    />
                  </div>
                  <div className="input-group">
                    <label>Apellido</label>
                    <input
                      type="text"
                      placeholder="García"
                      required
                      value={registerData.apellido}
                      onChange={e => setRegisterData({ ...registerData, apellido: e.target.value })}
                    />
                  </div>
                </div>
                <div className="input-group">
                  <label>Email</label>
                  <input
                    type="email"
                    placeholder="ejemplo@correo.com"
                    required
                    value={registerData.email}
                    onChange={e => setRegisterData({ ...registerData, email: e.target.value })}
                  />
                </div>
                <div className="input-group">
                  <label>Contraseña</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    required
                    value={registerData.password}
                    onChange={e => setRegisterData({ ...registerData, password: e.target.value })}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div className="input-group">
                    <label>Teléfono</label>
                    <input
                      type="tel"
                      placeholder="+34 600 000 000"
                      value={registerData.telefono}
                      onChange={e => setRegisterData({ ...registerData, telefono: e.target.value })}
                    />
                  </div>
                  <div className="input-group">
                    <label>Fecha de nacimiento</label>
                    <input
                      type="date"
                      value={registerData.fechaNacimiento}
                      onChange={e => setRegisterData({ ...registerData, fechaNacimiento: e.target.value })}
                    />
                  </div>
                </div>
                <button type="submit" className="btn-submit" style={{ marginTop: '10px' }} disabled={loading}>
                  {loading ? 'Cargando...' : 'Crear cuenta'}
                </button>
              </form>

              <p className="login-footer">
                ¿Ya tienes cuenta?{' '}
                <a href="#" onClick={e => { e.preventDefault(); cambiarModo(false) }}>
                  Inicia sesión
                </a>
              </p>
            </>
          )}
        </div>
      </div>
      {showForgot && (
        <div className="modal-overlay" onClick={() => setShowForgot(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowForgot(false)}>
              <i className="ph ph-x"></i>
            </button>
            <h2 className="modal-title">Recuperar contraseña</h2>

            {forgotStatus === 'success' ? (
              <p className="login-success">
                Te hemos enviado un email con el enlace de recuperación. Revisa tu bandeja de entrada.
              </p>
            ) : (
              <form onSubmit={handleForgotPassword}>
                <p className="modal-description">
                  Introduce tu email y te enviaremos un enlace para restablecer tu contraseña.
                </p>
                {typeof forgotStatus === 'string' && forgotStatus !== '' && forgotStatus !== 'loading' && (
                  <p className="login-error">{forgotStatus}</p>
                )}
                <div className="input-group">
                  <label>Email</label>
                  <input
                    type="email"
                    placeholder="ejemplo@correo.com"
                    required
                    value={forgotEmail}
                    onChange={e => setForgotEmail(e.target.value)}
                  />
                </div>
                <button type="submit" className="modal-cta" disabled={forgotStatus === 'loading'}>
                  {forgotStatus === 'loading' ? 'Enviando...' : 'Enviar enlace'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
