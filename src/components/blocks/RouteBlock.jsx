import { useState, useRef } from 'react'
import api from '../../api/axiosConfig'

export default function RouteBlock({ bloque, viajeId, onDelete }) {
  const dato = bloque?.dato ?? {}
  const [campos, setCampos] = useState({
    nombre:      dato.nombre      ?? '',
    ciudad:      dato.ciudad      ?? '',
    descripcion: dato.descripcion ?? '',
  })
  const [guardado, setGuardado] = useState(false)
  const debounce = useRef(null)

  function handleChange(e) {
    const next = { ...campos, [e.target.name]: e.target.value }
    setCampos(next)
    clearTimeout(debounce.current)
    debounce.current = setTimeout(() => {
      api.put(`/viajes/${viajeId}/itinerario/bloque/${bloque.id}`, {
        tipo: 'lugar', contenido: null, dato: next,
      }).catch(() => {})
    }, 800)
  }

  async function guardarFavorito() {
    try {
      await api.post('/favoritos', { tipo: 'lugar', datos: campos })
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
        <div className="mock-block mock-route">
          <div className="mock-icon"><i className="ph ph-map-pin-line"></i></div>
          <div className="mock-details">
            <input
              className="block-field-input block-field-title"
              name="nombre"
              placeholder="Lugar o ruta..."
              value={campos.nombre}
              onChange={handleChange}
            />
            <div className="block-field-row">
              <input className="block-field-input" name="ciudad" placeholder="Ciudad" value={campos.ciudad} onChange={handleChange} />
            </div>
            <input
              className="block-field-input"
              name="descripcion"
              placeholder="Descripción o precio de entrada..."
              value={campos.descripcion}
              onChange={handleChange}
              style={{ marginTop: '6px' }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
