import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import api from '../api/axiosConfig'

export default function TripsPage() {
  const navigate = useNavigate()
  const [viajes, setViajes]     = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [deleteError, setDeleteError] = useState('')
  const usuarioId = localStorage.getItem('usuarioId')

  useEffect(() => {
    api.get('/viajes')
      .then(res => setViajes(res.data))
      .catch(() => setError('No se pudieron cargar los viajes. Comprueba tu conexión.'))
      .finally(() => setLoading(false))
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

  if (loading) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>
        <i className="ph ph-circle-notch" style={{ fontSize: '36px', animation: 'spin 1s linear infinite' }}></i>
        <p style={{ marginTop: '12px' }}>Cargando viajes...</p>
      </div>
    )
  }

  return (
    <div>
      <header className="section-header">
        <h2>Mis Itinerarios</h2>
        <p>Viajes que has creado o a los que te han invitado.</p>
      </header>

      {error && (
        <p className="login-error" style={{ marginBottom: '20px' }}>{error}</p>
      )}
      {deleteError && (
        <p className="login-error" style={{ marginBottom: '16px' }}>{deleteError}</p>
      )}

      <div className="cards-grid">
        {viajes.map(viaje => (
          <div
            key={viaje.id}
            className="card"
            onClick={() => navigate(`/viaje/${viaje.id}`)}
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
                  className="btn-favorite"
                  title="Eliminar viaje"
                  onClick={e => eliminarViaje(e, viaje.id)}
                  style={{ position: 'absolute', top: '10px', right: '10px', background: 'white', borderRadius: '50%', padding: '6px' }}
                >
                  <i className="ph ph-trash" style={{ color: '#ef4444' }}></i>
                </button>
              )}
            </div>
            <div className="card-content">
              <h3>{viaje.titulo}</h3>
              <p>{viaje.fechaSalida} → {viaje.fechaLlegada}</p>
            </div>
          </div>
        ))}

        {viajes.length === 0 && !error && (
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            No tienes viajes todavía. ¡Crea uno desde la página de Explorar!
          </p>
        )}
      </div>
    </div>
  )
}
