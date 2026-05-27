import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGoogleLogin } from '@react-oauth/google'
import api from '../api/axiosConfig'

/**
 * Página de autenticación: login y registro en un único componente, con toggle
 * controlado por el booleano {@code isRegister}.
 *
 * <p>Flujo de login:
 * <ul>
 *   <li>Formulario email + contraseña → POST {@code /auth/login} → {@code guardarSesion()}.
 *   <li>Botón Google → {@code useGoogleLogin} de {@code @react-oauth/google} obtiene el
 *       {@code access_token} y lo envía a POST {@code /auth/google}. En ambos casos, tras
 *       guardar la sesión, navega a {@code /}.
 * </ul>
 *
 * <p>Flujo de registro: validación client-side del email (regex) y teléfono antes de
 * enviar POST {@code /auth/register}. Los campos opcionales {@code telefono} y
 * {@code fechaNacimiento} se envían como {@code null} si están vacíos.
 *
 * <p>{@code guardarSesion()} escribe en {@code localStorage}: {@code token},
 * {@code usuarioId}, {@code nombreUsuario}, {@code nombre} y {@code email}.
 * Adicionalmente se guarda {@code loginMethod} ({@code "email"} o {@code "google"})
 * para que otros flujos (como la eliminación de cuenta) sepan si pedir contraseña.
 *
 * <p>La página NO redirige si ya hay token. El sentinel de sesión en {@code main.jsx}
 * garantiza que siempre se necesita re-login al abrir la aplicación.
 *
 * <p>El modal de recuperación de contraseña se controla con {@code showForgot}. Envía
 * POST {@code /auth/forgot-password} con el email. El estado {@code forgotStatus} puede
 * ser {@code ""}, {@code "loading"}, {@code "success"} o un mensaje de error.
 */
export default function LoginPage() {
  const [isRegister, setIsRegister] = useState(false)
  const [loginData, setLoginData] = useState({ email: '', password: '' })
  const [registerData, setRegisterData] = useState({
    nombreUsuario: '', nombre: '', apellido: '',
    email: '', password: '', telefono: '', fechaNacimiento: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showForgot, setShowForgot] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotStatus, setForgotStatus] = useState('')
  const navigate = useNavigate()

  const loginConGoogle = useGoogleLogin({
    onSuccess: async (response) => {
      try {
        const res = await api.post('/auth/google', { accessToken: response.access_token })
        guardarSesion(res.data)
        localStorage.setItem('loginMethod', 'google')
        navigate('/')
      } catch (err) {
        setError(err.response?.data?.message || 'Error al iniciar sesión con Google')
      }
    },
    onError: () => setError('Error al conectar con Google'),
  })

  useEffect(() => {
    document.body.classList.add('login-body')
    return () => document.body.classList.remove('login-body')
  }, [])


  /**
   * Persiste los datos de sesión del usuario en {@code localStorage}.
   *
   * <p>Guarda las cinco claves necesarias para que el resto de la aplicación funcione:
   * {@code token} (JWT para las peticiones), {@code usuarioId}, {@code nombreUsuario},
   * {@code nombre} (nombre real, leído por el Sidebar) y {@code email}. El campo
   * {@code loginMethod} ({@code "email"} o {@code "google"}) se guarda justo después
   * en el punto de llamada.
   *
   * @param {{ token: string, usuarioId: string, nombreUsuario: string, nombre: string, email: string }} data
   *   Respuesta del backend tras login o registro.
   */
  function guardarSesion(data) {
    localStorage.setItem('token', data.token)
    localStorage.setItem('usuarioId', data.usuarioId)
    localStorage.setItem('nombreUsuario', data.nombreUsuario)
    localStorage.setItem('nombre', data.nombre)
    localStorage.setItem('email', data.email)
  }

  /**
   * Envía las credenciales de email/contraseña al backend y persiste la sesión.
   *
   * <p>Llama a POST {@code /auth/login}. Si tiene éxito, invoca {@link guardarSesion},
   * guarda {@code loginMethod='email'} y navega a {@code /}.
   *
   * @param {React.FormEvent} e - Evento de envío del formulario.
   */
  async function handleLogin(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await api.post('/auth/login', loginData)
      guardarSesion(res.data)
      localStorage.setItem('loginMethod', 'email')
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.message || 'Email o contraseña incorrectos')
    } finally {
      setLoading(false)
    }
  }

  /**
   * Valida los datos del formulario de registro y crea la cuenta.
   *
   * <p>Comprueba en el cliente el formato del email (regex RFC-like) y el teléfono
   * (9-15 dígitos si se rellena). Los campos opcionales {@code telefono} y
   * {@code fechaNacimiento} se envían como {@code null} si están vacíos para que el
   * backend no los interprete como strings vacíos. Tras el registro persiste la sesión
   * con {@link guardarSesion} y navega a {@code /}.
   *
   * @param {React.FormEvent} e - Evento de envío del formulario.
   */
  async function handleRegister(e) {
    e.preventDefault()
    setError('')
    const emailValido = /^[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(registerData.email)
    if (!emailValido) {
      setError('El formato del email no es válido')
      return
    }
    if (registerData.telefono && !/^[0-9]{9,15}$/.test(registerData.telefono)) {
      setError('El teléfono debe tener entre 9 y 15 dígitos')
      return
    }
    setLoading(true)
    try {
      const payload = {
        ...registerData,
        telefono: registerData.telefono || null,
        fechaNacimiento: registerData.fechaNacimiento || null,
      }
      const res = await api.post('/auth/register', payload)
      guardarSesion(res.data)
      localStorage.setItem('loginMethod', 'email')
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.message || 'Error al crear la cuenta')
    } finally {
      setLoading(false)
    }
  }

  /**
   * Envía la petición de recuperación de contraseña al backend.
   *
   * <p>Llama a POST {@code /auth/forgot-password} con el email introducido. Actualiza
   * {@code forgotStatus} con {@code "loading"} mientras espera, {@code "success"} si
   * tiene éxito, o el mensaje de error del backend si falla. El backend usa la API de
   * Brevo para enviar el email con el enlace de reset.
   *
   * @param {React.FormEvent} e - Evento de envío del formulario del modal.
   */
  async function handleForgotPassword(e) {
    e.preventDefault()
    setForgotStatus('loading')
    try {
      await api.post('/auth/forgot-password', { email: forgotEmail })
      setForgotStatus('success')
    } catch (err) {
      setForgotStatus(err.response?.data?.message || 'Error al enviar el correo')
    }
  }

  function cerrarModalForgot() {
    setShowForgot(false)
    setForgotStatus('')
    setForgotEmail('')
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
              <p className="login-subtitle">Inicia sesión para planificar tu próximo viaje</p>

              <button className="btn-google" type="button" onClick={() => loginConGoogle()}>
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
                    type="email" id="email" placeholder="ejemplo@correo.com" required
                    value={loginData.email}
                    onChange={e => setLoginData({ ...loginData, email: e.target.value })}
                  />
                </div>
                <div className="input-group">
                  <label htmlFor="password">Contraseña</label>
                  <input
                    type="password" id="password" placeholder="••••••••" required
                    value={loginData.password}
                    onChange={e => setLoginData({ ...loginData, password: e.target.value })}
                  />
                </div>
                <div className="login-options">
                  <a
                    href="#"
                    className="forgot-password"
                    onClick={e => { e.preventDefault(); setShowForgot(true) }}
                  >
                    ¿Olvidaste tu contraseña?
                  </a>
                </div>
                <button type="submit" className="btn-submit" disabled={loading}>
                  {loading ? 'Cargando...' : 'Iniciar Sesión'}
                </button>
              </form>

              <p className="login-footer">
                ¿No tienes cuenta?{' '}
                <a href="#" onClick={e => { e.preventDefault(); setIsRegister(true); setError('') }}>
                  Regístrate
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
                    type="text" placeholder="mi_usuario" required
                    value={registerData.nombreUsuario}
                    onChange={e => setRegisterData({ ...registerData, nombreUsuario: e.target.value })}
                  />
                </div>
                <div className="form-grid-2">
                  <div className="input-group">
                    <label>Nombre</label>
                    <input
                      type="text" placeholder="Juan" required
                      value={registerData.nombre}
                      onChange={e => setRegisterData({ ...registerData, nombre: e.target.value })}
                    />
                  </div>
                  <div className="input-group">
                    <label>Apellido</label>
                    <input
                      type="text" placeholder="García" required
                      value={registerData.apellido}
                      onChange={e => setRegisterData({ ...registerData, apellido: e.target.value })}
                    />
                  </div>
                </div>
                <div className="input-group">
                  <label>Email</label>
                  <input
                    type="email" placeholder="ejemplo@correo.com" required
                    value={registerData.email}
                    onChange={e => setRegisterData({ ...registerData, email: e.target.value })}
                  />
                </div>
                <div className="input-group">
                  <label>Contraseña</label>
                  <input
                    type="password" placeholder="••••••••" required
                    value={registerData.password}
                    onChange={e => setRegisterData({ ...registerData, password: e.target.value })}
                  />
                </div>
                <div className="form-grid-2">
                  <div className="input-group">
                    <label>Teléfono</label>
                    <input
                      type="tel" placeholder="+34 600 000 000"
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
                <button type="submit" className="btn-submit" disabled={loading} style={{ marginTop: '10px' }}>
                  {loading ? 'Cargando...' : 'Crear cuenta'}
                </button>
              </form>

              <p className="login-footer">
                ¿Ya tienes cuenta?{' '}
                <a href="#" onClick={e => { e.preventDefault(); setIsRegister(false); setError('') }}>
                  Inicia sesión
                </a>
              </p>
            </>
          )}
        </div>
      </div>

      {showForgot && (
        <div className="modal-overlay" onClick={cerrarModalForgot}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={cerrarModalForgot}>
              <i className="ph ph-x"></i>
            </button>
            <h2 className="modal-title">Recuperar contraseña</h2>
            <p className="modal-description">
              Introduce tu email y te enviaremos un enlace para restablecer tu contraseña.
            </p>

            {forgotStatus === 'success' ? (
              <p className="login-success">Correo enviado. Revisa tu bandeja de entrada.</p>
            ) : (
              <form onSubmit={handleForgotPassword}>
                {forgotStatus && forgotStatus !== 'loading' && (
                  <p className="login-error">{forgotStatus}</p>
                )}
                <div className="input-group">
                  <label>Email</label>
                  <input
                    type="email" placeholder="ejemplo@correo.com" required
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
