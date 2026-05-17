import { useState, useEffect } from 'react'
import api from '../api/axiosConfig'

const ICONO = { vuelo: 'ph-airplane-tilt', hotel: 'ph-buildings', lugar: 'ph-map-pin-line' }
const LABEL  = { vuelo: 'Vuelo', hotel: 'Hotel', lugar: 'Lugar' }

function nombreFavorito(fav) {
  const d = fav.datos ?? {}
  return d.nombre ?? d.aerolinea ?? (d.origen && d.destino ? `${d.origen} → ${d.destino}` : null) ?? '—'
}

export default function Cajon() {
  const [favoritos, setFavoritos] = useState([])

  useEffect(() => {
    api.get('/favoritos')
      .then(res => setFavoritos(res.data))
      .catch(() => {})
  }, [])

  function handleDragStart(e, fav) {
    e.dataTransfer.setData('application/json', JSON.stringify(fav))
    e.dataTransfer.effectAllowed = 'copy'
  }

  return (
    <aside style={{ width: '260px', borderLeft: '1px solid var(--border-color)', paddingLeft: '20px', flexShrink: 0 }}>
      <h3 style={{ fontSize: '16px', marginBottom: '5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <i className="ph ph-archive"></i> Mi Cajón
      </h3>
      <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
        Arrastra tus favoritos al itinerario.
      </p>

      {favoritos.length === 0 && (
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
          No tienes favoritos guardados todavía.
        </p>
      )}

      {favoritos.map(fav => (
        <div
          key={fav.id}
          className="drawer-item"
          draggable
          onDragStart={e => handleDragStart(e, fav)}
          style={{ cursor: 'grab', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}
        >
          <i className={`ph ${ICONO[fav.tipo] ?? 'ph-star'}`} style={{ fontSize: '18px', color: 'var(--text-secondary)', flexShrink: 0 }}></i>
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {LABEL[fav.tipo] ?? fav.tipo}
            </div>
            <div style={{ fontSize: '13px', fontWeight: '500', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {nombreFavorito(fav)}
            </div>
          </div>
        </div>
      ))}
    </aside>
  )
}
