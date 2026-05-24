import { useState, useEffect, useCallback } from 'react'
import api from '../api/axiosConfig'
import useFavoritosSocket from '../hooks/useFavoritosSocket'

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

export default function Cajon({ onAdd }) {
  const [datos, setDatos] = useState({ vuelos: [], alojamientos: [], actividades: [] })
  const [expandido, setExpandido] = useState({ vuelos: true, alojamientos: true, actividades: true })

  const cargar = useCallback(() => {
    Promise.all(SECCIONES.map(s => api.get(s.endpoint).then(r => [s.key, r.data])))
      .then(results => {
        const nuevo = {}
        results.forEach(([key, data]) => { nuevo[key] = data })
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

  async function eliminarFavorito(e, item, seccion) {
    e.stopPropagation()
    try {
      await api.delete(`${seccion.endpoint}/${item.id}`)
    } catch {
      alert('Error al eliminar favorito')
    }
  }

  const total = SECCIONES.reduce((acc, s) => acc + (datos[s.key]?.length ?? 0), 0)

  return (
    <aside style={{ width: '240px', borderLeft: '1px solid var(--border-color)', paddingLeft: '20px', flexShrink: 0 }}>
      <h3 style={{ fontSize: '15px', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <i className="ph ph-archive"></i> Mi Cajón
      </h3>
      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '14px' }}>
        Arrastra o haz click para añadir al itinerario.
      </p>

      {total === 0 && (
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
    </aside>
  )
}
