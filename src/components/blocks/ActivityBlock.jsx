import { useState, useRef } from 'react'
import api from '../../api/axiosConfig'

const T = { border: 'none', outline: 'none', background: 'transparent', padding: 0, fontFamily: 'inherit', color: 'inherit', width: '100%' }

export default function ActivityBlock({ bloque, viajeId, onDelete }) {
  const dr = bloque?.datosReferencia
  const dato = bloque?.dato ?? {}
  const [campos, setCampos] = useState({
    nombre:   dato.nombre   ?? '',
    ciudad:   dato.ciudad   ?? '',
    fecha:    dato.fecha    ?? '',
    duracion: dato.duracion ?? '',
    precio:   dato.precio   ?? '',
  })
  const debounce = useRef(null)

  function handleChange(e) {
    const next = { ...campos, [e.target.name]: e.target.value }
    setCampos(next)
    clearTimeout(debounce.current)
    debounce.current = setTimeout(() => {
      api.put(`/viajes/${viajeId}/itinerario/bloque/${bloque.id}`, {
        tipo: 'actividad', contenido: null, dato: next,
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
    return (
      <div className="itinerary-block">
        {controles}
        <div className="block-content">
          <div style={cardWrap}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <i className="ph ph-ticket" style={{ color: '#3b82f6', fontSize: '18px' }}></i>
              <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-secondary)' }}>{dr.ciudad}, {dr.pais}</span>
            </div>
            <h3 style={{ margin: '6px 0 6px', fontSize: '16px' }}>{dr.nombre}</h3>
            {dr.descripcion && (
              <p style={{ margin: '0 0 10px', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{dr.descripcion}</p>
            )}
            {dr.tipoActividad && dr.tipoActividad.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '10px' }}>
                {dr.tipoActividad.map((t, i) => (
                  <span key={i} style={{ fontSize: '10px', background: '#f3f4f6', color: 'var(--text-secondary)', padding: '3px 8px', borderRadius: '10px' }}>{t}</span>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '10px', fontSize: '12px', color: 'var(--text-secondary)' }}>
              {dr.fecha && <span><i className="ph ph-calendar"></i> {dr.fecha}</span>}
              {dr.duracion && <span><i className="ph ph-clock"></i> {dr.duracion}</span>}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {dr.puntuacion > 0 && <span style={{ fontSize: '12px', color: '#f5b400', fontWeight: 600 }}>★ {Number(dr.puntuacion).toFixed(1)}</span>}
                {dr.menoresIncluidos && <span style={{ fontSize: '10px', background: '#e8f5e9', color: '#2e7d32', padding: '2px 8px', borderRadius: '10px' }}>Familiar</span>}
              </div>
              <span className="tag tag-green" style={{ fontSize: '15px', fontWeight: 700 }}>
                {dr.precio === 0 ? 'Gratis' : `${Number(dr.precio).toFixed(2)} €`}
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
            <i className="ph ph-ticket" style={{ color: '#3b82f6', fontSize: '18px', flexShrink: 0 }}></i>
            <input name="ciudad" value={campos.ciudad} onChange={handleChange} placeholder="Ciudad..." style={{ ...T, fontWeight: 600, fontSize: '13px', color: 'var(--text-secondary)' }} />
          </div>
          <input name="nombre" value={campos.nombre} onChange={handleChange} placeholder="Nombre de la actividad..." style={{ ...T, fontWeight: 600, fontSize: '16px', marginBottom: '12px', display: 'block' }} />
          <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', fontSize: '12px', color: 'var(--text-secondary)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <i className="ph ph-calendar"></i>
              <input name="fecha" type="date" value={campos.fecha} onChange={handleChange} style={{ ...T, width: 'max-content', fontSize: '12px', color: 'var(--text-secondary)' }} />
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <i className="ph ph-clock"></i>
              <input name="duracion" value={campos.duracion} onChange={handleChange} placeholder="Duración" style={{ ...T, width: '80px', fontSize: '12px', color: 'var(--text-secondary)' }} />
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
            <span></span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <input name="precio" type="number" value={campos.precio} onChange={handleChange} placeholder="—" style={{ ...T, width: '60px', textAlign: 'right', fontWeight: 700, fontSize: '15px', color: '#16a34a' }} />
              <span style={{ fontSize: '13px', color: '#16a34a' }}>€</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
