import { useState, useRef } from 'react'
import api from '../../api/axiosConfig'

const T = { border: 'none', outline: 'none', background: 'transparent', padding: 0, fontFamily: 'inherit', color: 'inherit', width: '100%' }

export default function FlightBlock({ bloque, viajeId, onDelete }) {
  const dr = bloque?.datosReferencia
  const dato = bloque?.dato ?? {}
  const [campos, setCampos] = useState({
    aerolinea: dato.aerolinea ?? '',
    origen:    dato.origen    ?? '',
    destino:   dato.destino   ?? '',
    fechaSal:  dato.fechaSal  ?? dato.fecha ?? '',
    horaSal:   dato.horaSal   ?? dato.hora  ?? '',
    fechaLleg: dato.fechaLleg ?? '',
    horaLleg:  dato.horaLleg  ?? '',
    duracion:  dato.duracion  ?? '',
    clase:     dato.clase     ?? 'ECONOMY',
    precio:    dato.precio    ?? '',
    moneda:    dato.moneda    ?? 'EUR',
  })
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
    const [fechaSal, horaSal] = dr.horaSalida ? dr.horaSalida.split('T') : ['', '']
    const [fechaLleg, horaLleg] = dr.horaLlegada ? dr.horaLlegada.split('T') : ['', '']
    return (
      <div className="itinerary-block">
        {controles}
        <div className="block-content">
          <div style={cardWrap}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <i className="ph ph-airplane-tilt" style={{ color: '#3b82f6', fontSize: '18px' }}></i>
              <span style={{ fontWeight: 600, fontSize: '15px' }}>{dr.aerolinea}</span>
            </div>
            <h3 style={{ margin: '6px 0 12px', fontSize: '16px' }}>{dr.origen} → {dr.destino}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
              <div>
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '0 0 2px' }}>SALIDA</p>
                <p style={{ margin: 0, fontWeight: 600 }}>{horaSal ? horaSal.slice(0, 5) : '—'}</p>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>{fechaSal}</p>
              </div>
              <div>
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '0 0 2px' }}>LLEGADA</p>
                <p style={{ margin: 0, fontWeight: 600 }}>{horaLleg ? horaLleg.slice(0, 5) : '—'}</p>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>{fechaLleg}</p>
              </div>
            </div>
            {dr.duracion && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                <i className="ph ph-clock"></i><span>Duración: {dr.duracion}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="tag" style={{ background: '#f3f4f6', color: 'var(--text-secondary)', fontSize: '12px' }}>
                {{ ECONOMY: 'Turista', BUSINESS: 'Negocios', FIRST: 'Primera Clase' }[dr.clase] || dr.clase}
              </span>
              <span className="tag tag-green" style={{ fontSize: '15px', fontWeight: 700 }}>
                {dr.precio != null ? Number(dr.precio).toFixed(2) : '—'} {dr.moneda}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <i className="ph ph-airplane-tilt" style={{ color: '#3b82f6', fontSize: '18px', flexShrink: 0 }}></i>
            <input name="aerolinea" value={campos.aerolinea} onChange={handleChange} placeholder="Aerolínea..." style={{ ...T, fontWeight: 600, fontSize: '15px' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <input name="origen" value={campos.origen} onChange={handleChange} placeholder="Origen" style={{ ...T, flex: 1 }} />
            <span style={{ color: 'var(--text-secondary)', flexShrink: 0 }}>→</span>
            <input name="destino" value={campos.destino} onChange={handleChange} placeholder="Destino" style={{ ...T, flex: 1 }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
            <div style={{ minWidth: 0, overflow: 'hidden' }}>
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '0 0 4px' }}>SALIDA</p>
              <input name="horaSal" type="time" value={campos.horaSal} onChange={handleChange} style={{ ...T, width: 'max-content', display: 'block', fontWeight: 600, marginBottom: '4px' }} />
              <input name="fechaSal" type="date" value={campos.fechaSal} onChange={handleChange} style={{ ...T, width: 'max-content', display: 'block', fontSize: '12px', color: 'var(--text-secondary)' }} />
            </div>
            <div style={{ minWidth: 0, overflow: 'hidden' }}>
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '0 0 4px' }}>LLEGADA</p>
              <input name="horaLleg" type="time" value={campos.horaLleg} onChange={handleChange} style={{ ...T, width: 'max-content', display: 'block', fontWeight: 600, marginBottom: '4px' }} />
              <input name="fechaLleg" type="date" value={campos.fechaLleg} onChange={handleChange} style={{ ...T, width: 'max-content', display: 'block', fontSize: '12px', color: 'var(--text-secondary)' }} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px', color: 'var(--text-secondary)', fontSize: '13px' }}>
            <i className="ph ph-clock"></i>
            <input name="duracion" value={campos.duracion} onChange={handleChange} placeholder="Duración (ej: 2h 30m)" style={{ ...T, fontSize: '13px', color: 'var(--text-secondary)' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <select name="clase" value={campos.clase} onChange={handleChange} style={{ ...T, width: 'auto', fontSize: '12px', background: '#f3f4f6', padding: '3px 8px', borderRadius: '10px', cursor: 'pointer' }}>
              <option value="ECONOMY">Turista</option>
              <option value="BUSINESS">Negocios</option>
              <option value="FIRST">Primera Clase</option>
            </select>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <input name="precio" type="number" value={campos.precio} onChange={handleChange} placeholder="—" style={{ ...T, width: '60px', textAlign: 'right', fontWeight: 700, fontSize: '15px', color: '#16a34a' }} />
              <input name="moneda" value={campos.moneda} onChange={handleChange} placeholder="EUR" style={{ ...T, width: '40px', fontSize: '13px', color: '#16a34a' }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
