import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import api from '../api/axiosConfig'

export default function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const nombreUsuario = localStorage.getItem('nombre') || localStorage.getItem('nombreUsuario')
  const navClass = ({ isActive }) => `nav-item${isActive ? ' active' : ''}`

  const enItinerario = location.pathname.startsWith('/viaje/')
  const [prevEnItinerario, setPrevEnItinerario] = useState(enItinerario)
  const [colapsado, setColapsado] = useState(enItinerario)
  const [menuMovil, setMenuMovil] = useState(false)

  const [stats, setStats] = useState(null)

  useEffect(() => {
    Promise.all([
      api.get('/viajes'),
      api.get('/favoritos/vuelos'),
      api.get('/favoritos/alojamientos'),
      api.get('/favoritos/actividades'),
    ]).then(([viajes, vuelos, aloj, act]) => {
      setStats({
        itinerarios: viajes.data.length,
        favoritos: vuelos.data.length + aloj.data.length + act.data.length,
      })
    }).catch(() => {})
  }, [location.pathname])

  if (prevEnItinerario !== enItinerario) {
    setPrevEnItinerario(enItinerario)
    setColapsado(enItinerario)
  }

  function handleLogout() {
    ['token', 'usuarioId', 'nombreUsuario', 'nombre', 'email', 'loginMethod'].forEach(k => localStorage.removeItem(k))
    navigate('/login')
  }

  function cerrarMovil() { setMenuMovil(false) }

  return (
    <>
      <aside className={`sidebar${colapsado ? ' sidebar-colapsada' : ''}`}>
        <div className="logo-section">
          <div className="logo-icon">N</div>
          <span className="logo-text">Naval</span>
          {enItinerario && (
            <button
              className="btn-colapsar"
              onClick={() => setColapsado(p => !p)}
              title={colapsado ? 'Expandir menú' : 'Colapsar menú'}
            >
              <i className={`ph ${colapsado ? 'ph-caret-right' : 'ph-caret-left'}`}></i>
            </button>
          )}
        </div>

        <nav className="nav-menu sidebar-nav">
          <NavLink to="/" end className={navClass}>
            <i className="ph ph-magnifying-glass"></i>
            <span className="nav-label">Explorar</span>
          </NavLink>
          <NavLink to="/favoritos" className={navClass}>
            <i className="ph ph-heart"></i>
            <span className="nav-label">Favoritos</span>
          </NavLink>
          <NavLink to="/itinerarios" className={navClass}>
            <i className="ph ph-map-trifold"></i>
            <span className="nav-label">Mis Itinerarios</span>
          </NavLink>
          <NavLink to="/configuracion" className={navClass}>
            <i className="ph ph-gear"></i>
            <span className="nav-label">Configuración</span>
          </NavLink>
        </nav>

        {stats && !colapsado && (
          <div style={{ padding: '0 12px', marginBottom: '8px' }}>
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  <i className="ph ph-map-trifold" style={{ fontSize: '15px' }}></i> Itinerarios
                </span>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>{stats.itinerarios}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  <i className="ph ph-heart" style={{ fontSize: '15px' }}></i> Favoritos
                </span>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>{stats.favoritos}</span>
              </div>
            </div>
          </div>
        )}

        <div className="sidebar-footer sidebar-nav">
          {nombreUsuario ? (
            <>
              <span className="sidebar-username">
                <i className="ph ph-user-circle"></i>
                <span className="nav-label">{nombreUsuario}</span>
              </span>
              <button className="nav-item login-link" onClick={handleLogout} style={{ background: 'none', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left' }}>
                <i className="ph ph-sign-out"></i>
                <span className="nav-label">Cerrar Sesión</span>
              </button>
            </>
          ) : (
            <NavLink to="/login" className="nav-item login-link">
              <i className="ph ph-sign-in"></i>
              <span className="nav-label">Iniciar Sesión</span>
            </NavLink>
          )}
        </div>
      </aside>

      {menuMovil && <div className="movil-overlay" onClick={cerrarMovil} />}

      <div className={`movil-panel${menuMovil ? ' abierto' : ''}`}>
        <div className="movil-panel-header">
          <div className="logo-icon" style={{ width: '28px', height: '28px', fontSize: '13px' }}>N</div>
          <span style={{ fontWeight: 700, fontSize: '15px' }}>Naval</span>
        </div>
        <nav style={{ padding: '4px 8px' }}>
          <NavLink to="/" end className={navClass} onClick={cerrarMovil}>
            <i className="ph ph-magnifying-glass"></i>
            <span>Explorar</span>
          </NavLink>
          <NavLink to="/favoritos" className={navClass} onClick={cerrarMovil}>
            <i className="ph ph-heart"></i>
            <span>Favoritos</span>
          </NavLink>
          <NavLink to="/itinerarios" className={navClass} onClick={cerrarMovil}>
            <i className="ph ph-map-trifold"></i>
            <span>Mis Itinerarios</span>
          </NavLink>
          <NavLink to="/configuracion" className={navClass} onClick={cerrarMovil}>
            <i className="ph ph-gear"></i>
            <span>Configuración</span>
          </NavLink>
        </nav>
        {nombreUsuario && (
          <div style={{ padding: '4px 8px', borderTop: '1px solid var(--border-color)', marginTop: '4px' }}>
            <button
              className="nav-item login-link"
              onClick={() => { cerrarMovil(); handleLogout() }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left' }}
            >
              <i className="ph ph-sign-out"></i>
              <span>Cerrar Sesión</span>
            </button>
          </div>
        )}
      </div>

      <button className="movil-fab" onClick={() => setMenuMovil(p => !p)} title="Menú">
        <i className={`ph ${menuMovil ? 'ph-x' : 'ph-list'}`}></i>
      </button>
    </>
  )
}
