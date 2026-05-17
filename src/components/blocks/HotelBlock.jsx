import { useState, useRef } from 'react'
import api from '../../api/axiosConfig'

export default function HotelBlock({ bloque, viajeId, onDelete }) {
  const dato = bloque?.dato ?? {}
  const [campos, setCampos] = useState({
    nombre:    dato.nombre    ?? '',
    checkin:   dato.checkin   ?? '',
    checkout:  dato.checkout  ?? '',
    direccion: dato.direccion ?? '',
  })
  const debounce = useRef(null)

  function handleChange(e) {
    const next = { ...campos, [e.target.name]: e.target.value }
    setCampos(next)
    clearTimeout(debounce.current)
    debounce.current = setTimeout(() => {
      api.put(`/viajes/${viajeId}/itinerario/bloque/${bloque.id}`, {
        tipo: 'hotel', contenido: null, dato: next,
      }).catch(() => {})
    }, 800)
  }

  return (
    <div className="itinerary-block">
      <div className="block-controls">
        <i className="ph ph-dots-six-vertical drag-handle"></i>
        <button onClick={onDelete} className="btn-block-delete" title="Eliminar">
          <i className="ph ph-trash"></i>
        </button>
      </div>
      <div className="block-content">
        <div className="mock-block mock-hotel">
          <div className="mock-icon"><i className="ph ph-buildings"></i></div>
          <div className="mock-details">
            <input
              className="block-field-input block-field-title"
              name="nombre"
              placeholder="Nombre del alojamiento..."
              value={campos.nombre}
              onChange={handleChange}
            />
            <div className="block-field-row">
              <label className="block-field-label">Check-in</label>
              <input className="block-field-input" type="date" name="checkin"  value={campos.checkin}  onChange={handleChange} />
              <label className="block-field-label">Check-out</label>
              <input className="block-field-input" type="date" name="checkout" value={campos.checkout} onChange={handleChange} />
            </div>
            <input
              className="block-field-input"
              name="direccion"
              placeholder="Dirección..."
              value={campos.direccion}
              onChange={handleChange}
              style={{ marginTop: '6px' }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
