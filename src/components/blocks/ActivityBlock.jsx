import { useState, useRef, useEffect } from 'react'
import api from '../../api/axiosConfig'

const T = { border: 'none', outline: 'none', background: 'transparent', padding: 0, fontFamily: 'inherit', color: 'inherit', width: '100%' }

export default function ActivityBlock({ bloque, viajeId, onDelete, onDesvincular, onContentSaved }) {
  const dr = bloque?.datosReferencia
  const dato = bloque?.dato ?? {}
  const [campos, setCampos] = useState({
    nombre:           dato.nombre           || dr?.nombre        || '',
    ciudad:           dato.ciudad           || dr?.ciudad        || '',
    pais:             dato.pais             || dr?.pais          || '',
    descripcion:      dato.descripcion      || dr?.descripcion   || '',
    tipoActividad:    dato.tipoActividad    || (dr?.tipoActividad ? dr.tipoActividad.join(', ') : ''),
    fecha:            dato.fecha            || dr?.fecha         || '',
    duracion:         dato.duracion         || dr?.duracion      || '',
    puntuacion:       dato.puntuacion       || (dr?.puntuacion != null ? String(dr.puntuacion) : ''),
    menoresIncluidos: (dato.menoresIncluidos !== undefined && dato.menoresIncluidos !== null && dato.menoresIncluidos !== '') ? dato.menoresIncluidos : (dr?.menoresIncluidos != null ? String(dr.menoresIncluidos) : 'false'),
    precio:           dato.precio           || (dr?.precio != null ? String(dr.precio) : ''),
  })
  const [precioError, setPrecioError] = useState(() => {
    const raw = dato.precio || ''
    return raw !== '' && isNaN(parseFloat(String(raw).replace(',', '.')))
  })
  const debounce        = useRef(null)
  const blockFocused    = useRef(false)
  const lastDrRef       = useRef(dr)
  const hasDesvinculado = useRef(false)
  if (dr) lastDrRef.current = dr

  useEffect(() => {
    if (dr) { hasDesvinculado.current = false; return }
    const isFirst = !hasDesvinculado.current
    hasDesvinculado.current = true
    if (!isFirst && blockFocused.current) return
    const d = bloque?.dato ?? {}
    setCampos({
      nombre:           d.nombre           || '',
      ciudad:           d.ciudad           || '',
      pais:             d.pais             || '',
      descripcion:      d.descripcion      || '',
      tipoActividad:    d.tipoActividad    || '',
      fecha:            d.fecha            || '',
      duracion:         d.duracion         || '',
      puntuacion:       d.puntuacion       || '',
      menoresIncluidos: d.menoresIncluidos || 'false',
      precio:           d.precio           || '',
    })
  }, [bloque])

  async function handleChange(e) {
    const value = e.target.type === 'checkbox' ? String(e.target.checked) : e.target.value
    const next = { ...campos, [e.target.name]: value }
    setCampos(next)
    if (e.target.name === 'precio') {
      setPrecioError(value !== '' && isNaN(parseFloat(value.replace(',', '.'))))
    }
    clearTimeout(debounce.current)
    debounce.current = setTimeout(async () => {
      try {
        await api.put(`/viajes/${viajeId}/itinerario/bloque/${bloque.id}`, {
          tipo: 'actividad', contenido: null, dato: next,
        })
        onContentSaved?.()
      } catch {}
    }, 800)
  }

  const controles = (
    <div className="block-controls">
      <i className="ph ph-dots-six-vertical drag-handle"></i>
      {bloque?.referenciaId && (
        <button onClick={onDesvincular} className="btn-block-delete" title="Hacer bloque editable">
          <i className="ph ph-pencil-simple"></i>
        </button>
      )}
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
      <div className="itinerary-block" onFocus={() => { blockFocused.current = true }} onBlur={() => { blockFocused.current = false }}>
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
                {dr.precio === 0 ? 'Gratis' : `${Number(dr.precio).toFixed(1).replace('.', ',')} EUR`}
              </span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="itinerary-block" onFocus={() => { blockFocused.current = true }} onBlur={() => { blockFocused.current = false }}>
      {controles}
      <div className="block-content">
        <div style={cardWrap}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
            <i className="ph ph-ticket" style={{ color: '#3b82f6', fontSize: '18px', flexShrink: 0 }}></i>
            <input name="ciudad" value={campos.ciudad} onChange={handleChange} placeholder="Ciudad..." style={{ ...T, fontWeight: 600, fontSize: '13px', color: 'var(--text-secondary)', flex: 1 }} />
            <span style={{ color: 'var(--text-secondary)', fontSize: '13px', flexShrink: 0 }}>,</span>
            <input name="pais" value={campos.pais} onChange={handleChange} placeholder="País" style={{ ...T, fontWeight: 600, fontSize: '13px', color: 'var(--text-secondary)', flex: 1 }} />
          </div>
          <input name="nombre" value={campos.nombre} onChange={handleChange} placeholder="Nombre de la actividad..." style={{ ...T, fontWeight: 600, fontSize: '16px', marginBottom: '6px', display: 'block' }} />
          <input name="descripcion" value={campos.descripcion} onChange={handleChange} placeholder="Descripción..." style={{ ...T, fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4, marginBottom: '8px', display: 'block' }} />
          <input name="tipoActividad" value={campos.tipoActividad} onChange={handleChange} placeholder="Tipos (ej: Museo, Arte, ...)" style={{ ...T, fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '10px', display: 'block' }} />
          <div style={{ display: 'flex', gap: '12px', marginBottom: '10px', fontSize: '12px', color: 'var(--text-secondary)' }}>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '12px', color: '#f5b400' }}>
                <span>★</span>
                <input name="puntuacion" type="number" min="0" max="5" step="0.1" value={campos.puntuacion} onChange={handleChange} placeholder="0.0" style={{ ...T, width: '36px', fontSize: '12px', color: '#f5b400', fontWeight: 600 }} />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <input type="checkbox" name="menoresIncluidos" checked={campos.menoresIncluidos === 'true'} onChange={handleChange} style={{ margin: 0 }} />
                Familiar
              </label>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
              <span className="tag tag-green" style={{ fontSize: '15px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px', ...(precioError ? { background: '#fee2e2', color: '#dc2626' } : {}) }}>
                <input name="precio" type="text" value={campos.precio} onChange={handleChange} placeholder="—" style={{ ...T, width: '60px', textAlign: 'right', fontWeight: 700, fontSize: '15px', color: 'inherit' }} />
                EUR
              </span>
              {precioError && <span style={{ fontSize: '10px', color: '#dc2626' }}>Formato inválido</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
