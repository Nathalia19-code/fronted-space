import { useState, useRef, useEffect } from 'react'
import api from '../../api/axiosConfig'

const T = { border: 'none', outline: 'none', background: 'transparent', padding: 0, fontFamily: 'inherit', color: 'inherit', width: '100%' }

/**
 * Bloque de vuelo del editor de itinerarios.
 *
 * <p>Puede estar en modo <em>vinculado</em> (cuando {@code bloque.datosReferencia} es no
 * nulo) o modo <em>manual</em> (cuando {@code referenciaId} es nulo). En ambos casos la
 * UI es idéntica: la tarjeta muestra aerolínea, ruta, horarios, duración, clase y precio.
 * En modo vinculado los datos son de solo lectura; en modo manual cada campo es editable.
 *
 * <p>Los campos se inicializan con el patrón {@code dato.X || dr?.X || ''}: si el bloque
 * tiene datos manuales ({@code dato}) se usan primero; si no, se leen de
 * {@code datosReferencia}. Los campos de hora se obtienen con {@code .split('T')} porque
 * {@code horaSalida}/{@code horaLlegada} son Strings ISO {@code "yyyy-MM-ddTHH:mm"} en
 * el modelo del backend.
 *
 * <p>La transición vinculado -> manual se gestiona con los refs {@code hasDesvinculado} y
 * {@code lastDrRef}: al detectar que {@code dr} pasa a {@code null} se reinician los
 * {@code campos} desde {@code bloque.dato}. Si el bloque está en foco ({@code blockFocused})
 * y ya se había desvinculado antes, no se sobreescriben los cambios del usuario.
 *
 * <p>El icono de lápiz solo es visible cuando {@code bloque.referenciaId != null}. Al
 * pulsarlo llama {@code onDesvincular}, que en el padre ejecuta PATCH
 * {@code /viajes/{id}/itinerario/bloque/{bloqueId}/desvincular}.
 *
 * <p>Todos los cambios manuales se guardan con debounce de 800 ms via PUT
 * {@code /viajes/{id}/itinerario/bloque/{bloqueId}}.
 *
 * @param {Object} bloque - Bloque del itinerario con campos {@code id}, {@code dato}, {@code datosReferencia}, {@code referenciaId}.
 * @param {string} viajeId - ID del itinerario padre.
 * @param {Function} onDelete - Callback para eliminar este bloque.
 * @param {Function} onDesvincular - Callback para desvincular el bloque del favorito.
 * @param {Function} onContentSaved - Callback invocado tras guardar en el backend.
 */
export default function FlightBlock({ bloque, viajeId, onDelete, onDesvincular, onContentSaved }) {
  const dr = bloque?.datosReferencia
  const dato = bloque?.dato ?? {}
  const [campos, setCampos] = useState({
    aerolinea: dato.aerolinea || dr?.aerolinea || '',
    origen:    dato.origen    || dr?.origen    || '',
    destino:   dato.destino   || dr?.destino   || '',
    fechaSal:  dato.fechaSal  || dato.fecha    || (dr?.horaSalida  ? dr.horaSalida.split('T')[0]                        : ''),
    horaSal:   dato.horaSal   || dato.hora     || (dr?.horaSalida  ? (dr.horaSalida.split('T')[1]?.slice(0, 5)  ?? '') : ''),
    fechaLleg: dato.fechaLleg ||                  (dr?.horaLlegada ? dr.horaLlegada.split('T')[0]                       : ''),
    horaLleg:  dato.horaLleg  ||                  (dr?.horaLlegada ? (dr.horaLlegada.split('T')[1]?.slice(0, 5) ?? '') : ''),
    duracion:  dato.duracion  || dr?.duracion  || '',
    clase:     dato.clase     || dr?.clase     || 'ECONOMY',
    precio:    dato.precio    || (dr?.precio   != null ? String(dr.precio) : ''),
    moneda:    dato.moneda    || dr?.moneda    || 'EUR',
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
      aerolinea: d.aerolinea || '',
      origen:    d.origen    || '',
      destino:   d.destino   || '',
      fechaSal:  d.fechaSal  || '',
      horaSal:   d.horaSal   || '',
      fechaLleg: d.fechaLleg || '',
      horaLleg:  d.horaLleg  || '',
      duracion:  d.duracion  || '',
      clase:     d.clase     || 'ECONOMY',
      precio:    d.precio    || '',
      moneda:    d.moneda    || 'EUR',
    })
  }, [bloque])

  async function handleChange(e) {
    const next = { ...campos, [e.target.name]: e.target.value }
    setCampos(next)
    if (e.target.name === 'precio') {
      const v = e.target.value
      setPrecioError(v !== '' && isNaN(parseFloat(v.replace(',', '.'))))
    }
    clearTimeout(debounce.current)
    debounce.current = setTimeout(async () => {
      try {
        await api.put(`/viajes/${viajeId}/itinerario/bloque/${bloque.id}`, {
          tipo: 'vuelo', contenido: null, dato: next,
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
    const [fechaSal, horaSal] = dr.horaSalida ? dr.horaSalida.split('T') : ['', '']
    const [fechaLleg, horaLleg] = dr.horaLlegada ? dr.horaLlegada.split('T') : ['', '']
    return (
      <div className="itinerary-block" onFocus={() => { blockFocused.current = true }} onBlur={() => { blockFocused.current = false }}>
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
                {dr.precio != null ? Number(dr.precio).toFixed(1).replace('.', ',') : '—'} {dr.moneda}
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
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
              <span className="tag tag-green" style={{ fontSize: '15px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px', ...(precioError ? { background: '#fee2e2', color: '#dc2626' } : {}) }}>
                <input name="precio" type="text" value={campos.precio} onChange={handleChange} placeholder="—" style={{ ...T, width: '60px', textAlign: 'right', fontWeight: 700, fontSize: '15px', color: 'inherit' }} />
                <input name="moneda" value={campos.moneda} onChange={handleChange} placeholder="EUR" style={{ ...T, width: '40px', fontSize: '15px', fontWeight: 700, color: 'inherit' }} />
              </span>
              {precioError && <span style={{ fontSize: '10px', color: '#dc2626' }}>Formato inválido</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
