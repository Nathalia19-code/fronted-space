import { useState, useRef } from 'react'
import api from '../../api/axiosConfig'

export default function FlightBlock({ bloque, viajeId, onDelete }) {
  const dato = bloque?.dato ?? {}
  const [campos, setCampos] = useState({
    aerolinea: dato.aerolinea ?? '',
    origen:    dato.origen    ?? '',
    destino:   dato.destino   ?? '',
    fecha:     dato.fecha     ?? '',
    hora:      dato.hora      ?? '',
  })
  const [guardado, setGuardado] = useState(false)
  const debounce = useRef(null)

  function handleChange(e) {
    const next = { ...campos, [e.target.name]: e.target.value }
    setCampos(next)
    clearTimeout(debounce.current)
    debounce.current = setTimeout(() => {
      api.put(`/viajes/${viajeId}/itinerario/bloque/${bloque.id}`, {
        tipo: 'vuelo', contenido: null, dato: next,
      }).catch(() => {})
    }, 800)
  }

  async function guardarFavorito() {
    try {
      await api.post('/favoritos', { tipo: 'vuelo', datos: campos })
      setGuardado(true)
    } catch {
      alert('Error al guardar en favoritos')
    }
  }

  return (
    <div className="itinerary-block">
      <div className="block-controls">
        <i className="ph ph-dots-six-vertical drag-handle"></i>
        <button onClick={guardarFavorito} className="btn-block-delete" title="Guardar en favoritos" disabled={guardado}>
          <i className={`ph ${guardado ? 'ph-heart-fill' : 'ph-heart'}`} style={{ color: guardado ? '#ef4444' : undefined }}></i>
        </button>
        <button onClick={onDelete} className="btn-block-delete" title="Eliminar">
          <i className="ph ph-trash"></i>
        </button>
      </div>
      <div className="block-content">
        <div className="mock-block mock-flight">
          <div className="mock-icon"><i className="ph ph-airplane-tilt"></i></div>
          <div className="mock-details">
            <input
              className="block-field-input block-field-title"
              name="aerolinea"
              placeholder="Aerolínea y número de vuelo..."
              value={campos.aerolinea}
              onChange={handleChange}
            />
            <div className="block-field-row">
              <input className="block-field-input" name="origen"  placeholder="Origen"  value={campos.origen}  onChange={handleChange} />
              <span style={{ color: 'var(--text-secondary)' }}>→</span>
              <input className="block-field-input" name="destino" placeholder="Destino" value={campos.destino} onChange={handleChange} />
              <input className="block-field-input" type="date" name="fecha" value={campos.fecha} onChange={handleChange} />
              <input className="block-field-input" type="time" name="hora"  value={campos.hora}  onChange={handleChange} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
