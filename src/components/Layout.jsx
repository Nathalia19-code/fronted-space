import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'

/**
 * Componente raíz del área privada de la web.
 *
 * <p>Compone el {@code Sidebar} lateral con el contenido de la página activa mediante
 * {@code <Outlet />} de React Router. Todas las rutas protegidas renderizan sus páginas
 * dentro de este componente.
 */
export default function Layout() {
  return (
    <div className="app-container">
      <Sidebar />
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  )
}
