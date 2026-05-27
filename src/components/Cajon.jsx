import { useState, useEffect, useCallback } from 'react'
import api from '../api/axiosConfig'
import useFavoritosSocket from '../hooks/useFavoritosSocket'
import ConfirmEliminarFavoritoModal from './ConfirmEliminarFavoritoModal'

const SECCIONES = [
  { key: 'vuelos', label: 'Vuelos', icono: 'ph-airplane-tilt', tipo: 'vuelo', endpoint: '/favoritos/vuelos' },
  { key: 'alojamientos', label: 'Alojamientos', icono: 'ph-buildings', tipo: 'hotel', endpoint: '/favoritos/alojamientos' },
  { key: 'actividades', label: 'Actividades', icono: 'ph-ticket', tipo: 'actividad', endpoint: '/favoritos/actividades' },
]

function nombreItem(item, tipo) {
  if (tipo === 'vuelo') return item.aerolinea ? `${item.origen} → ${item.destino}` : '—'
  if (tipo === 'hotel') return item.hotel || '—'
  return item.nombre || '—'
}

function subItem(item, tipo) {
  if (tipo === 'vuelo') return item.aerolinea || ''
  if (tipo === 'hotel') return item.ciudad ? `${item.ciudad}, ${item.pais || ''}` : ''
  return item.ciudad ? `${item.ciudad}, ${item.pais || ''}` : ''
}

function horasVuelo(item) {
  const hs = item.horaSalida ? item.horaSalida.split('T')[1]?.slice(0, 5) : null
  const hl = item.horaLlegada ? item.horaLlegada.split('T')[1]?.slice(0, 5) : null
  if (hs && hl) return `${hs} → ${hl}`
  return hs || null
}

const TIPO_ICONO = { vuelo: 'ph-airplane-tilt', hotel: 'ph-buildings', actividad: 'ph-ticket' }

function nombreCarpetaItem(datos, tipo) {
  if (!datos) return '—'
  if (tipo === 'vuelo') return datos.aerolinea ? `${datos.origen} → ${datos.destino}` : '—'
  if (tipo === 'hotel') return datos.hotel || '—'
  return datos.nombre || '—'
}

function subCarpetaItem(datos, tipo) {
  if (!datos) return ''
  if (tipo === 'vuelo') return datos.aerolinea || ''
  return datos.ciudad ? `${datos.ciudad}${datos.pais ? `, ${datos.pais}` : ''}` : ''
}

export default function Cajon({ onAdd, onFavChange, onEstructuraCambiada }) {
  const [datos, setDatos] = useState({ vuelos: [], alojamientos: [], actividades: [] })
  const [expandido, setExpandido] = useState({ vuelos: true, alojamientos: true, actividades: true })
  const [carpetas, setCarpetas] = useState([])
  const [carpetasExpandidas, setCarpetasExpandidas] = useState({})
  const [pendingDelete, setPendingDelete] = useState(null)
  const [pendingCarpetaDelete, setPendingCarpetaDelete] = useState(null)

  const cargar = useCallback(() => {
    Promise.all([
      ...SECCIONES.map(s => api.get(s.endpoint).then(r => [s.key, r.data])),
      api.get('/carpetas').then(r => ['_carpetas', r.data]),
    ])
      .then(results => {
        const nuevo = {}
        results.forEach(([key, data]) => {
          if (key === '_carpetas') setCarpetas(data)
          else nuevo[key] = data
        })
        setDatos(nuevo)
      })
      .catch(() => {})
  }, [])

  useEffect(() => { cargar() }, [cargar])

  useFavoritosSocket(cargar)

  function handleDragStart(e, item, tipo) {
    e.dataTransfer.setData('application/json', JSON.stringify({
      tipo,
      referenciaId: item.id,
      dato: {},
    }))
    e.dataTransfer.effectAllowed = 'copy'
  }

  function handleDragStartCarpeta(e, item) {
    e.dataTransfer.setData('application/json', JSON.stringify({
      tipo: item.tipo,
      referenciaId: item.id,
      dato: {},
      fuente: 'carpeta',
    }))
    e.dataTransfer.effectAllowed = 'copy'
  }

  function quitarDelEstado(item, seccion) {
    setDatos(prev => ({ ...prev, [seccion.key]: prev[seccion.key].filter(i => i.id !== item.id) }))
  }

  async function eliminarFavorito(e, item, seccion) {
    e.stopPropagation()
    try {
      const viajesAfectados = await api.get(`/favoritos/${item.id}/en-uso`).then(r => r.data)
      if (viajesAfectados.length === 0) {
        await api.delete(`${seccion.endpoint}/${item.id}?eliminarBloques=true`)
        quitarDelEstado(item, seccion)
        onFavChange?.()
        onEstructuraCambiada?.()
      } else {
        setPendingDelete({ item, seccion, viajesAfectados })
      }
    } catch {
      alert('Error al eliminar favorito')
    }
  }

  async function ejecutarEliminar(eliminarBloques) {
    const { item, seccion } = pendingDelete
    setPendingDelete(null)
    try {
      await api.delete(`${seccion.endpoint}/${item.id}?eliminarBloques=${eliminarBloques}`)
      quitarDelEstado(item, seccion)
      onFavChange?.()
      onEstructuraCambiada?.()
    } catch {
      alert('Error al eliminar favorito')
    }
  }

  async function eliminarCarpetaItem(e, item, carpetaId) {
    e.stopPropagation()
    if (item.fuente !== 'carpeta') {
      try {
        await api.delete(`/carpetas/${carpetaId}/items/${item.id}`)
        cargar()
      } catch { alert('Error al quitar de la carpeta') }
      return
    }
    try {
      const viajesAfectados = await api.get(`/carpetas/${carpetaId}/items/${item.id}/en-uso`).then(r => r.data)
      if (viajesAfectados.length === 0) {
        await api.delete(`/carpetas/${carpetaId}/items/${item.id}?eliminarBloques=true`)
        cargar()
        onFavChange?.()
        onEstructuraCambiada?.()
      } else {
        setPendingCarpetaDelete({ item, carpetaId, viajesAfectados })
      }
    } catch { alert('Error al quitar de la carpeta') }
  }

  async function ejecutarEliminarCarpeta(eliminarBloques) {
    const { item, carpetaId } = pendingCarpetaDelete
    setPendingCarpetaDelete(null)
    try {
      await api.delete(`/carpetas/${carpetaId}/items/${item.id}?eliminarBloques=${eliminarBloques}`)
      cargar()
      onFavChange?.()
      onEstructuraCambiada?.()
    } catch { alert('Error al quitar de la carpeta') }
  }

  const total = SECCIONES.reduce((acc, s) => acc + (datos[s.key]?.length ?? 0), 0)

  return (
    <aside style={{ width: '100%', border: '1px solid var(--border-color)', borderRadius: '12px', background: 'white', padding: '14px 16px', boxSizing: 'border-box' }}>
      <ConfirmEliminarFavoritoModal
        show={!!pendingDelete}
        viajesAfectados={pendingDelete?.viajesAfectados}
        onSi={() => ejecutarEliminar(true)}
        onNo={() => ejecutarEliminar(false)}
        onCancelar={() => setPendingDelete(null)}
      />
      <ConfirmEliminarFavoritoModal
        show={!!pendingCarpetaDelete}
        viajesAfectados={pendingCarpetaDelete?.viajesAfectados}
        onSi={() => ejecutarEliminarCarpeta(true)}
        onNo={() => ejecutarEliminarCarpeta(false)}
        onCancelar={() => setPendingCarpetaDelete(null)}
      />
      <h3 style={{ fontSize: '15px', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <i className="ph ph-archive"></i> Mi Cajón
      </h3>
      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '14px' }}>
        Arrastra o haz click para añadir al itinerario.
      </p>

      {total === 0 && carpetas.length === 0 && (
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
          No tienes favoritos guardados todavía.
        </p>
      )}

      {SECCIONES.map(seccion => {
        const items = datos[seccion.key] ?? []
        if (items.length === 0) return null
        return (
          <div key={seccion.key} style={{ marginBottom: '14px' }}>
            <button
              onClick={() => setExpandido(p => ({ ...p, [seccion.key]: !p[seccion.key] }))}
              style={{ background: 'none', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left', padding: '4px 0', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <i className={`ph ${seccion.icono}`} style={{ fontSize: '14px', color: 'var(--text-secondary)' }}></i>
              <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', flex: 1 }}>
                {seccion.label}
              </span>
              <i className={`ph ph-caret-${expandido[seccion.key] ? 'up' : 'down'}`} style={{ fontSize: '12px', color: 'var(--text-secondary)' }}></i>
            </button>

            {expandido[seccion.key] && (
              <div style={{ marginTop: '4px' }}>
                {items.map(item => (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={e => handleDragStart(e, item, seccion.tipo)}
                    onClick={() => onAdd?.({ tipo: seccion.tipo, referenciaId: item.id, dato: {} })}
                    style={{
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '6px 8px',
                      borderRadius: '6px',
                      marginBottom: '4px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--surface-2)',
                    }}
                  >
                    <i className={`ph ${seccion.icono}`} style={{ fontSize: '15px', color: 'var(--accent)', flexShrink: 0 }}></i>
                    <div style={{ overflow: 'hidden', flex: 1 }}>
                      <div style={{ fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {nombreItem(item, seccion.tipo)}
                      </div>
                      {subItem(item, seccion.tipo) && (
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {subItem(item, seccion.tipo)}
                        </div>
                      )}
                      {seccion.tipo === 'vuelo' && horasVuelo(item) && (
                        <div style={{ fontSize: '10px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {horasVuelo(item)}
                        </div>
                      )}
                      {seccion.tipo === 'hotel' && item.precioNoche != null && (
                        <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                          {Number(item.precioNoche).toFixed(2).replace('.', ',')} EUR/noche
                        </div>
                      )}
                    </div>
                    <button
                      onClick={e => eliminarFavorito(e, item, seccion)}
                      title="Eliminar favorito"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: 'var(--text-secondary)', flexShrink: 0, lineHeight: 1, display: 'flex', alignItems: 'center' }}
                    >
                      <i className="ph ph-trash" style={{ fontSize: '13px' }}></i>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
      {carpetas.length > 0 && (
        <div style={{ marginTop: total > 0 ? '14px' : 0, borderTop: total > 0 ? '1px solid var(--border-color)' : 'none', paddingTop: total > 0 ? '14px' : 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
            <i className="ph ph-folders" style={{ fontSize: '14px', color: 'var(--text-secondary)' }}></i>
            <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Mis carpetas</span>
          </div>
          {carpetas.map(carpeta => (
            <div key={carpeta.id} style={{ marginBottom: '8px' }}>
              <button
                onClick={() => setCarpetasExpandidas(p => ({ ...p, [carpeta.id]: !p[carpeta.id] }))}
                style={{ background: 'none', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left', padding: '4px 0', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <i className="ph ph-folder-simple" style={{ fontSize: '14px', color: '#f5b400' }}></i>
                <span style={{ fontSize: '12px', fontWeight: '600', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{carpeta.nombre}</span>
                <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{carpeta.items.length}</span>
                <i className={`ph ph-caret-${carpetasExpandidas[carpeta.id] ? 'up' : 'down'}`} style={{ fontSize: '12px', color: 'var(--text-secondary)' }}></i>
              </button>
              {carpetasExpandidas[carpeta.id] && (
                <div style={{ marginTop: '4px' }}>
                  {carpeta.items.length === 0 ? (
                    <p style={{ fontSize: '11px', color: 'var(--text-secondary)', fontStyle: 'italic', paddingLeft: '20px', margin: '4px 0' }}>Vacía</p>
                  ) : (
                    carpeta.items.map(item => (
                      <div
                        key={item.id}
                        draggable
                        onDragStart={e => handleDragStartCarpeta(e, item)}
                        onClick={() => onAdd?.({
                          tipo: item.tipo,
                          referenciaId: item.id,
                          dato: {},
                          fuente: 'carpeta',
                        })}
                        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', borderRadius: '6px', marginBottom: '4px', border: '1px solid var(--border-color)', background: 'var(--surface-2)' }}
                      >
                        <i className={`ph ${TIPO_ICONO[item.tipo]}`} style={{ fontSize: '15px', color: 'var(--accent)', flexShrink: 0 }}></i>
                        <div style={{ overflow: 'hidden', flex: 1 }}>
                          <div style={{ fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {nombreCarpetaItem(item.datos, item.tipo)}
                          </div>
                          {subCarpetaItem(item.datos, item.tipo) && (
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {subCarpetaItem(item.datos, item.tipo)}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={e => eliminarCarpetaItem(e, item, carpeta.id)}
                          title="Quitar de carpeta"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: 'var(--text-secondary)', flexShrink: 0, lineHeight: 1, display: 'flex', alignItems: 'center' }}
                        >
                          <i className="ph ph-trash" style={{ fontSize: '13px' }}></i>
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </aside>
  )
}
