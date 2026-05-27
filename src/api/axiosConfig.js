import axios from 'axios'

/**
 * Instancia Axios configurada para toda la web.
 *
 * <p>La URL base se toma de {@code VITE_API_URL} en producción o cae a {@code http://localhost:8080} en desarrollo.
 *
 * <p>Interceptor de petición: adjunta la cabecera {@code Authorization: Bearer <token>}
 * leyendo el JWT de {@code localStorage} si existe.
 *
 * <p>Interceptor de respuesta: ante un 401 o 403 en cualquier endpoint que no sea
 * {@code /auth/}, elimina las seis claves de sesión de {@code localStorage} y redirige
 * a {@code /login}. Esto fuerza re-login cuando el JWT ha expirado o es inválido.
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8080',
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401 || err.response?.status === 403) {
      const isAuthEndpoint = err.config?.url?.includes('/auth/')
      if (!isAuthEndpoint) {
        ['token', 'usuarioId', 'nombreUsuario', 'nombre', 'email', 'loginMethod'].forEach(k =>
          localStorage.removeItem(k)
        )
        window.location.href = '/login'
      }
    }
    return Promise.reject(err)
  }
)

export default api
