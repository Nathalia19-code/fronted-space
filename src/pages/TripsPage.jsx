import { useNavigate } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import api from '../api/axiosConfig'

/**
 * Página de listado de itinerarios del usuario.
 *
 * <p>Al montar carga todos los itinerarios del usuario con GET {@code /viajes} (incluye
 * los propios y los compartidos) y los separa en dos secciones: Individuales y Grupales.
 *
 * <p>El botón "Crear Itinerario" abre un dropdown con las opciones Individual o Grupal.
 * Al seleccionar una opción se muestra un modal con título y fechas; al confirmar envía
 * POST {@code /viajes} y navega al editor del nuevo itinerario.
 *
 * <p>Cada itinerario se muestra en un componente {@code TripCard} que delega las
 * acciones al padre:
 * <ul>
 *   <li>Itinerario individual o creador de grupal: botón "Eliminar". Para itinerarios
 *       grupales llama {@code creadorSalirDeViaje} (DELETE {@code /viajes/{id}/creador-salir}),
 *       que transfiere la propiedad a un colaborador aleatorio o elimina el itinerario si
 *       no quedan colaboradores.
 *   <li>Colaborador invitado en grupal: botón "Salir del itinerario"
 *       (DELETE {@code /viajes/{id}/salir}).
 * </ul>
 *
 * <p>Todas las acciones de eliminación/salida tienen confirmación inline de dos pasos
 * ("¿Seguro?" → Sí/No) para evitar eliminaciones accidentales.
 */
export default function TripsPage() {
  const navigate = useNavigate()
  const [viajes, setViajes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const usuarioId = localStorage.getItem('usuarioId')

  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [showFormViaje, setShowFormViaje] = useState(false)
  const [formViaje, setFormViaje] = useState({ titulo: '', fechaSalida: '', fechaLlegada: '', grupal: false })
  const [viajeError, setViajeError] = useState('')
  const containerRef = useRef(null)

  useEffect(() => {
    api.get('/viajes')
      .then(res => setViajes(res.data))
      .catch(() => setError('No se pudieron cargar los viajes. Comprueba tu conexión.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  /**
   * Elimina un itinerario del que el usuario es propietario (individual o grupal sin colaboradores activos).
   *
   * <p>Envía {@code DELETE /viajes/{id}} y filtra el itinerario del estado local. Solo
   * debe llamarse cuando el usuario es propietario y el itinerario es individual; para
   * grupales se usa {@link creadorSalirDeViaje}.
   *
   * @param {React.MouseEvent} e - Evento del botón; se detiene la propagación para evitar
   *   navegar al editor al confirmar.
   * @param {string} id - Identificador del itinerario a eliminar.
   */
  async function eliminarViaje(e, id) {
    e.stopPropagation()
    setDeleteError('')
    try {
      await api.delete(`/viajes/${id}`)
      setViajes(prev => prev.filter(v => v.id !== id))
    } catch {
      setDeleteError('No se pudo eliminar el viaje. Inténtalo de nuevo.')
    }
  }

  /**
   * El creador sale de un itinerario grupal, transfiriendo la propiedad o eliminándolo.
   *
   * <p>Envía {@code delete /viajes/{id}/creador-salir}. El backend transfiere la propiedad
   * a un colaborador aleatorio, o elimina el itinerario si no quedan colaboradores. El
   * itinerario desaparece del listado en ambos casos.
   *
   * @param {React.MouseEvent} e - Evento del botón; se detiene la propagación.
   * @param {string} id - Identificador del itinerario grupal.
   */
  async function creadorSalirDeViaje(e, id) {
    e.stopPropagation()
    setDeleteError('')
    try {
      await api.delete(`/viajes/${id}/creador-salir`)
      setViajes(prev => prev.filter(v => v.id !== id))
    } catch {
      setDeleteError('No se pudo completar la acción. Inténtalo de nuevo.')
    }
  }

  /**
   * El colaborador invitado sale voluntariamente de un itinerario grupal.
   *
   * <p>Envía {@code delete /viajes/{id}/salir}. El backend notifica al propietario vía
   * WebSocket. El itinerario desaparece del listado del colaborador.
   *
   * @param {React.MouseEvent} e - Evento del botón; se detiene la propagación.
   * @param {string} id - Identificador del itinerario del que salir.
   */
  async function salirDeViaje(e, id) {
    e.stopPropagation()
    setDeleteError('')
    try {
      await api.delete(`/viajes/${id}/salir`)
      setViajes(prev => prev.filter(v => v.id !== id))
    } catch {
      setDeleteError('No se pudo salir del viaje. Inténtalo de nuevo.')
    }
  }

  /**
   * Abre el modal de creación de itinerario con el tipo preseleccionado.
   *
   * @param {boolean} isGroup - Si {@code true} crea un itinerario grupal.
   */
  function openEditor(isGroup) {
    setDropdownOpen(false)
    setFormViaje({ titulo: '', fechaSalida: '', fechaLlegada: '', grupal: isGroup })
    setViajeError('')
    setShowFormViaje(true)
  }

  /**
   * Envía el formulario de creación de itinerario y navega al editor.
   *
   * <p>Llama a POST {@code /viajes} con los datos de {@code formViaje}. Si tiene éxito,
   * cierra el modal y navega a {@code /viaje/{id}} para abrir directamente el editor.
   */
  async function handleCrearViaje() {
    setViajeError('')
    try {
      const res = await api.post('/viajes', formViaje)
      setShowFormViaje(false)
      navigate(`/viaje/${res.data.id}`)
    } catch (err) {
      setViajeError(err.response?.data?.message || 'Error al crear el viaje.')
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>
        <i className="ph ph-circle-notch" style={{ fontSize: '36px', animation: 'spin 1s linear infinite' }}></i>
        <p style={{ marginTop: '12px' }}>Cargando viajes...</p>
      </div>
    )
  }

  const individuales = viajes.filter(v => !v.grupal)
  const grupales = viajes.filter(v => v.grupal)

  return (
    <div>
      <header className="section-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2>Mis Itinerarios</h2>
          <p>Viajes que has creado o a los que te han invitado.</p>
        </div>
        <div ref={containerRef} className="create-itinerary-container" style={{ marginTop: '4px' }}>
          <button
            className={`btn-create-itinerary${dropdownOpen ? ' active' : ''}`}
            onClick={() => setDropdownOpen(prev => !prev)}
          >
            <i className="ph ph-plus"></i>
            <span>Crear Itinerario</span>
            <i className="ph ph-caret-down trailing-icon"></i>
          </button>
          <div className={`dropdown-menu${dropdownOpen ? ' show' : ''}`}>
            <button className="dropdown-item" onClick={() => openEditor(false)}>
              <i className="ph ph-user"></i>
              Itinerario Individual
            </button>
            <button className="dropdown-item" onClick={() => openEditor(true)}>
              <i className="ph ph-users-three"></i>
              Itinerario Grupal
            </button>
          </div>
        </div>
      </header>

      {error && <p className="login-error" style={{ marginBottom: '20px' }}>{error}</p>}
      {deleteError && <p className="login-error" style={{ marginBottom: '16px' }}>{deleteError}</p>}

      {viajes.length === 0 && !error && (
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          No tienes viajes todavía. ¡Crea uno con el botón de arriba!
        </p>
      )}

      {individuales.length > 0 && (
        <div style={{ marginBottom: '40px' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px', fontWeight: '700', marginBottom: '16px', color: 'var(--text-secondary)' }}>
            <i className="ph ph-user"></i> Individuales
            <span style={{ fontSize: '13px', fontWeight: '400' }}>({individuales.length})</span>
          </h3>
          <div className="cards-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
            {individuales.map(viaje => (
              <TripCard
                key={viaje.id}
                viaje={viaje}
                usuarioId={usuarioId}
                onNavigate={() => navigate(`/viaje/${viaje.id}`)}
                onDelete={eliminarViaje}
                onCreadorSalir={creadorSalirDeViaje}
                onSalir={salirDeViaje}
              />
            ))}
          </div>
        </div>
      )}

      {grupales.length > 0 && (
        <div style={{ marginBottom: '40px' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px', fontWeight: '700', marginBottom: '16px', color: 'var(--text-secondary)' }}>
            <i className="ph ph-users-three"></i> Grupales
            <span style={{ fontSize: '13px', fontWeight: '400' }}>({grupales.length})</span>
          </h3>
          <div className="cards-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
            {grupales.map(viaje => (
              <TripCard
                key={viaje.id}
                viaje={viaje}
                usuarioId={usuarioId}
                onNavigate={() => navigate(`/viaje/${viaje.id}`)}
                onDelete={eliminarViaje}
                onCreadorSalir={creadorSalirDeViaje}
                onSalir={salirDeViaje}
              />
            ))}
          </div>
        </div>
      )}

      {showFormViaje && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowFormViaje(false)}>
          <div className="modal-box">
            <button className="modal-close" onClick={() => setShowFormViaje(false)}>
              <i className="ph ph-x"></i>
            </button>
            <h3 className="modal-title">Nuevo Itinerario</h3>
            <div className="input-group">
              <label>Título</label>
              <input
                type="text"
                placeholder="Escapada a Roma"
                value={formViaje.titulo}
                onChange={e => setFormViaje({ ...formViaje, titulo: e.target.value })}
              />
            </div>
            <div className="input-group">
              <label>Fecha de salida</label>
              <input
                type="date"
                value={formViaje.fechaSalida}
                onChange={e => setFormViaje({ ...formViaje, fechaSalida: e.target.value })}
              />
            </div>
            <div className="input-group">
              <label>Fecha de llegada</label>
              <input
                type="date"
                value={formViaje.fechaLlegada}
                onChange={e => setFormViaje({ ...formViaje, fechaLlegada: e.target.value })}
              />
            </div>
            {viajeError && <p className="login-error" style={{ marginBottom: '12px' }}>{viajeError}</p>}
            <button className="modal-cta" onClick={handleCrearViaje}>
              <i className="ph ph-plus"></i> Crear viaje
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Tarjeta de resumen de un itinerario en la lista.
 *
 * <p>Muestra la portada (o un placeholder de color según si es grupal o individual),
 * el badge Creador/Invitado, el título, las fechas y (solo en grupales) un desplegable
 * con la lista de participantes con nombre y email.
 *
 * <p>El botón de acción (Eliminar / Salir) tiene confirmación de dos pasos: primero
 * muestra "¿Seguro?" con botones Sí/No para evitar eliminaciones accidentales.
 *
 * @param {Object} viaje - Objeto itinerario con campos {@code id}, {@code titulo}, {@code fechaSalida}, {@code fechaLlegada}, {@code grupal}, {@code propietarioId}, {@code portadaUrl}, {@code participantes}.
 * @param {string} usuarioId - ID del usuario en sesión, para determinar si es creador.
 * @param {Function} onNavigate - Navega al editor del itinerario al hacer clic en la tarjeta.
 * @param {Function} onDelete - Callback de eliminación (itinerarios individuales).
 * @param {Function} onCreadorSalir - Callback para creador que sale de un itinerario grupal.
 * @param {Function} onSalir - Callback para colaborador que sale voluntariamente.
 */
function TripCard({ viaje, usuarioId, onNavigate, onDelete, onCreadorSalir, onSalir }) {
  const [confirmando, setConfirmando] = useState(false)
  const [showParticipantes, setShowParticipantes] = useState(false)
  const esCreador = viaje.propietarioId === usuarioId
  const esGrupal = viaje.grupal

  let accionLabel, accionHandler, accionColor, accionIcon
  if (!esGrupal) {
    accionLabel = 'Eliminar'
    accionHandler = onDelete
    accionColor = '#ef4444'
    accionIcon = 'ph-trash'
  } else if (esCreador) {
    accionLabel = 'Eliminar'
    accionHandler = onCreadorSalir
    accionColor = '#ef4444'
    accionIcon = 'ph-trash'
  } else {
    accionLabel = 'Salir del itinerario'
    accionHandler = onSalir
    accionColor = '#f59e0b'
    accionIcon = 'ph-sign-out'
  }

  return (
    <div className="card" onClick={onNavigate}>
      <div
        className="card-image placeholder-img"
        style={{ position: 'relative', backgroundColor: viaje.grupal ? '#e9d5ff' : '#bfdbfe', overflow: 'hidden' }}
      >
        {viaje.portadaUrl && (
          <img src={viaje.portadaUrl} alt="portada" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        )}
        <span
          className="badge"
          style={{
            position: 'absolute', top: '10px', left: '10px', zIndex: 1,
            ...(esCreador
              ? { background: '#1a1a1a', color: 'white' }
              : { background: '#e5e7eb', color: '#111827' })
          }}
        >
          {esCreador ? 'Creador' : 'Invitado'}
        </span>
      </div>
      <div className="card-content">
        <h3>{viaje.titulo}</h3>
        <p style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: '12px' }}>
          {viaje.fechaSalida || '—'} → {viaje.fechaLlegada || '—'}
        </p>
        {esGrupal && viaje.participantes && (
          <div onClick={e => e.stopPropagation()} style={{ marginBottom: '12px' }}>
            <button
              onClick={() => setShowParticipantes(p => !p)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                background: 'none', border: '1px solid var(--border-color)',
                borderRadius: '8px', padding: '5px 12px',
                fontSize: '13px', color: 'var(--text-secondary)', cursor: 'pointer', width: '100%'
              }}
            >
              <i className="ph ph-users-three"></i>
              <span style={{ flex: 1, textAlign: 'left' }}>Participantes · {viaje.participantes.length}</span>
              <i className={`ph ph-caret-${showParticipantes ? 'up' : 'down'}`}></i>
            </button>
            {showParticipantes && (
              <div style={{ marginTop: '6px', paddingLeft: '4px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {viaje.participantes.map(p => (
                  <span key={p.email} style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <i className="ph ph-user" style={{ flexShrink: 0 }}></i>
                    <span style={{ fontWeight: '500', color: 'var(--text-primary)' }}>{p.nombre}</span>
                    <span style={{ color: 'var(--text-secondary)' }}>·</span>
                    <span>{p.email}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
        <div onClick={e => e.stopPropagation()} style={{ marginTop: 'auto' }}>
          {!confirmando ? (
            <button
              onClick={() => setConfirmando(true)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                background: 'none', border: `1px solid ${accionColor}`,
                color: accionColor, borderRadius: '8px', padding: '6px 14px',
                fontSize: '13px', fontWeight: '500', cursor: 'pointer'
              }}
            >
              <i className={`ph ${accionIcon}`}></i>
              {accionLabel}
            </button>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>¿Seguro?</span>
              <button
                onClick={e => { accionHandler(e, viaje.id); setConfirmando(false) }}
                style={{
                  background: accionColor, color: 'white', border: 'none',
                  borderRadius: '6px', padding: '5px 14px', fontSize: '13px',
                  fontWeight: '500', cursor: 'pointer'
                }}
              >
                Sí
              </button>
              <button
                onClick={() => setConfirmando(false)}
                style={{
                  background: 'none', border: '1px solid var(--border-color)',
                  borderRadius: '6px', padding: '5px 14px', fontSize: '13px', cursor: 'pointer'
                }}
              >
                No
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
