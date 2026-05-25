import { useNavigate } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import api from '../api/axiosConfig'

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

  async function eliminarViaje(e, id) {
    e.stopPropagation()
    if (!confirm('¿Eliminar este viaje?')) return
    setDeleteError('')
    try {
      await api.delete(`/viajes/${id}`)
      setViajes(prev => prev.filter(v => v.id !== id))
    } catch {
      setDeleteError('No se pudo eliminar el viaje. Inténtalo de nuevo.')
    }
  }

  function openEditor(isGroup) {
    setDropdownOpen(false)
    setFormViaje({ titulo: '', fechaSalida: '', fechaLlegada: '', grupal: isGroup })
    setViajeError('')
    setShowFormViaje(true)
  }

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
          <div className="cards-grid">
            {individuales.map(viaje => (
              <TripCard key={viaje.id} viaje={viaje} usuarioId={usuarioId} onNavigate={() => navigate(`/viaje/${viaje.id}`)} onDelete={eliminarViaje} />
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
          <div className="cards-grid">
            {grupales.map(viaje => (
              <TripCard key={viaje.id} viaje={viaje} usuarioId={usuarioId} onNavigate={() => navigate(`/viaje/${viaje.id}`)} onDelete={eliminarViaje} />
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

function TripCard({ viaje, usuarioId, onNavigate, onDelete }) {
  return (
    <div className="card" onClick={onNavigate}>
      <div
        className="card-image placeholder-img"
        style={{ position: 'relative', backgroundColor: viaje.grupal ? '#e9d5ff' : '#bfdbfe' }}
      >
        <span
          className="badge"
          style={viaje.propietarioId === usuarioId
            ? { background: '#1a1a1a', color: 'white' }
            : { background: '#e5e7eb', color: '#111827' }
          }
        >
          {viaje.propietarioId === usuarioId ? 'Creador' : 'Invitado'}
        </span>
        {viaje.propietarioId === usuarioId && (
          <button
            className="btn-favorite"
            title="Eliminar viaje"
            onClick={e => onDelete(e, viaje.id)}
            style={{ position: 'absolute', top: '10px', right: '10px', background: 'white', borderRadius: '50%', padding: '6px' }}
          >
            <i className="ph ph-trash" style={{ color: '#ef4444' }}></i>
          </button>
        )}
      </div>
      <div className="card-content">
        <h3>{viaje.titulo}</h3>
        <p>{viaje.fechaSalida} → {viaje.fechaLlegada}</p>
        {viaje.propietarioId === usuarioId && (
          <button
            onClick={e => onDelete(e, viaje.id)}
            style={{
              marginTop: '10px', display: 'flex', alignItems: 'center', gap: '6px',
              background: 'none', border: '1px solid #fca5a5', borderRadius: '6px',
              color: '#ef4444', fontSize: '12px', fontWeight: '500', cursor: 'pointer',
              padding: '4px 10px', transition: 'background 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#fef2f2'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >
            <i className="ph ph-trash" style={{ fontSize: '13px' }}></i>
            Eliminar
          </button>
        )}
      </div>
    </div>
  )
}
