import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import api from '../api/axiosConfig'

export default function TripsPage() {
  const navigate = useNavigate()
  const [viajes, setViajes] = useState([])
  const usuarioId = localStorage.getItem('usuarioId')

  useEffect(() => {
    api.get('/viajes')
      .then(res => setViajes(res.data))
  }, [])

  async function eliminarViaje(e, id) {
    e.stopPropagation()
    if (!confirm('¿Eliminar este viaje?')) return
    try {
      await api.delete(`/viajes/${id}`)
      setViajes(prev => prev.filter(v => v.id !== id))
    } catch (err) {
      alert('Error al eliminar el viaje')
    }
  }

  return (
    <div>
      <header className="section-header">
        <h2>Mis Itinerarios</h2>
        <p>Viajes que has creado o a los que te han invitado.</p>
      </header>

      <div className="cards-grid">
        {viajes.map(viaje => (
          <div
            key={viaje.id}
            className="card"
            onClick={() => navigate('/viaje/nuevo', { state: { isGroup: viaje.grupal, viajeId: viaje.id } })}
          >
            <div className="card-image placeholder-img" style={{ position: 'relative' }}>
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
                  title="Eliminar viaje"
                  onClick={e => eliminarViaje(e, viaje.id)}
                  style={{
                    position: 'absolute', top: '10px', right: '10px',
                    background: 'white', border: 'none', borderRadius: '50%',
                    width: '32px', height: '32px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.2)', zIndex: 10
                  }}
                >
                  <i className="ph ph-trash" style={{ color: '#ef4444', fontSize: '16px' }}></i>
                </button>
              )}
            </div>
            <div className="card-content">
              <h3>{viaje.titulo}</h3>
              <p>{viaje.fechaSalida} → {viaje.fechaLlegada}</p>
            </div>
          </div>
        ))}

        {viajes.length === 0 && (
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            No tienes viajes todavía. ¡Crea uno desde la página de Explorar!
          </p>
        )}
      </div>
    </div>
  )
}
