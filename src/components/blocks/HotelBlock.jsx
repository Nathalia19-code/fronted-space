import { useState, useRef } from 'react'
import api from '../../api/axiosConfig'

const T = { border: 'none', outline: 'none', background: 'transparent', padding: 0, fontFamily: 'inherit', color: 'inherit', width: '100%' }

export default function HotelBlock({ bloque, viajeId, onDelete }) {
  const dr = bloque?.datosReferencia
  const dato = bloque?.dato ?? {}
  const [campos, setCampos] = useState({
    nombre:      dato.nombre      ?? '',
    ciudad:      dato.ciudad      ?? '',
    checkin:     dato.checkin     ?? dato.fechaEntrada ?? '',
    checkout:    dato.checkout    ?? dato.fechaSalida  ?? '',
    direccion:   dato.direccion   ?? '',
    precioNoche: dato.precioNoche ?? '',
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

  const controles = (
    <div className="block-controls">
      <i className="ph ph-dots-six-vertical drag-handle"></i>
      <button onClick={() => window.open('/', '_blank')} className="btn-block-delete" title="Buscar en Explorar">
        <i className="ph ph-magnifying-glass"></i>
      </button>
      <button onClick={onDelete} className="btn-block-delete" title="Eliminar bloque">
        <i className="ph ph-trash"></i>
      </button>
    </div>
  )

  const cardWrap = { border: '1px solid var(--border-color)', borderRadius: '12px', background: 'white', padding: '16px' }

  if (dr) {
    const estrellas = parseInt(dr.categoria) || 0
    return (
      <div className="itinerary-block">
        {controles}
        <div className="block-content">
          <div style={cardWrap}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <i className="ph ph-buildings" style={{ color: '#3b82f6', fontSize: '18px' }}></i>
              <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-secondary)' }}>{dr.ciudad}, {dr.pais}</span>
            </div>
            <h3 style={{ margin: '6px 0 6px', fontSize: '16px' }}>{dr.hotel}</h3>
            {dr.direccion && (
              <p style={{ margin: '0 0 10px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                <i className="ph ph-map-pin"></i> {dr.direccion}
              </p>
            )}
            {estrellas > 0 && (
              <div style={{ marginBottom: '10px', color: '#f5b400', fontSize: '15px' }}>
                {'★'.repeat(estrellas)}{'☆'.repeat(Math.max(0, 5 - estrellas))}
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
              <div>
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '0 0 2px' }}>ENTRADA</p>
                <p style={{ margin: 0, fontWeight: 600, fontSize: '13px' }}>{dr.fechaEntrada || '—'}</p>
              </div>
              <div>
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '0 0 2px' }}>SALIDA</p>
                <p style={{ margin: 0, fontWeight: 600, fontSize: '13px' }}>{dr.fechaSalida || '—'}</p>
              </div>
            </div>
            {dr.serviciosIncluidos && dr.serviciosIncluidos.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '10px' }}>
                {dr.serviciosIncluidos.map((s, i) => (
                  <span key={i} style={{ fontSize: '10px', background: '#f3f4f6', color: 'var(--text-secondary)', padding: '3px 8px', borderRadius: '10px' }}>{s}</span>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>por noche</span>
              <span className="tag tag-green" style={{ fontSize: '15px', fontWeight: 700 }}>
                {dr.precioNoche != null ? Number(dr.precioNoche).toFixed(2) : '—'} €
              </span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="itinerary-block">
      {controles}
      <div className="block-content">
        <div style={cardWrap}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <i className="ph ph-buildings" style={{ color: '#3b82f6', fontSize: '18px', flexShrink: 0 }}></i>
            <input name="ciudad" value={campos.ciudad} onChange={handleChange} placeholder="Ciudad, País..." style={{ ...T, fontWeight: 600, fontSize: '13px', color: 'var(--text-secondary)' }} />
          </div>
          <input name="nombre" value={campos.nombre} onChange={handleChange} placeholder="Nombre del alojamiento..." style={{ ...T, fontWeight: 600, fontSize: '16px', marginBottom: '6px', display: 'block' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '10px', fontSize: '12px', color: 'var(--text-secondary)' }}>
            <i className="ph ph-map-pin" style={{ flexShrink: 0 }}></i>
            <input name="direccion" value={campos.direccion} onChange={handleChange} placeholder="Dirección..." style={{ ...T, fontSize: '12px', color: 'var(--text-secondary)' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
            <div style={{ minWidth: 0, overflow: 'hidden' }}>
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '0 0 2px' }}>ENTRADA</p>
              <input name="checkin" type="date" value={campos.checkin} onChange={handleChange} style={{ ...T, width: 'max-content', display: 'block', fontWeight: 600, fontSize: '13px' }} />
            </div>
            <div style={{ minWidth: 0, overflow: 'hidden' }}>
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '0 0 2px' }}>SALIDA</p>
              <input name="checkout" type="date" value={campos.checkout} onChange={handleChange} style={{ ...T, width: 'max-content', display: 'block', fontWeight: 600, fontSize: '13px' }} />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>por noche</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <input name="precioNoche" type="number" value={campos.precioNoche} onChange={handleChange} placeholder="—" style={{ ...T, width: '60px', textAlign: 'right', fontWeight: 700, fontSize: '15px', color: '#16a34a' }} />
              <span style={{ fontSize: '13px', color: '#16a34a' }}>€</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
