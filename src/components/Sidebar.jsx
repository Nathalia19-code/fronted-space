import { NavLink, useNavigate } from 'react-router-dom'

export default function Sidebar() {
  const navClass = ({ isActive }) => `nav-item${isActive ? ' active' : ''}`
  const navigate = useNavigate()
  const nombreUsuario = localStorage.getItem('nombreUsuario')

  function handleLogout() {
    ;['token', 'usuarioId', 'nombreUsuario', 'nombre', 'email'].forEach(k => localStorage.removeItem(k))
    navigate('/login')
  }

  return (
    <aside className="sidebar">
      <div className="logo-section">
        <div className="logo-icon">N</div>
        <span className="logo-text">Naval</span>
        <i className="ph ph-caret-down"></i>
      </div>

      <nav className="nav-menu">
        <NavLink to="/" end className={navClass}>
          <i className="ph ph-magnifying-glass"></i> Explorar
        </NavLink>
        <NavLink to="/favoritos" className={navClass}>
          <i className="ph ph-heart"></i> Lugares Favoritos
        </NavLink>
        <NavLink to="/itinerarios" className={navClass}>
          <i className="ph ph-map-trifold"></i> Mis Itinerarios
        </NavLink>
        <NavLink to="/configuracion" className={navClass}>
          <i className="ph ph-gear"></i> Configuración
        </NavLink>
      </nav>

      <div className="sidebar-footer">
        {nombreUsuario ? (
          <>
            <p className="sidebar-username">{nombreUsuario}</p>
            <button className="nav-item login-link" onClick={handleLogout}>
              <i className="ph ph-sign-out"></i> Cerrar Sesión
            </button>
          </>
        ) : (
          <NavLink to="/login" className="nav-item login-link">
            <i className="ph ph-sign-in"></i> Iniciar Sesión
          </NavLink>
        )}
      </div>
    </aside>
  )
}
