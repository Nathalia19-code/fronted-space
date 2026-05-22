import { useState, useEffect } from 'react'
import api from '../api/axiosConfig'

const TYPE_ICON = {
  vuelo:  { icon: 'ph-airplane-tilt', label: 'Vuelo' },
  hotel:  { icon: 'ph-buildings',     label: 'Hotel' },
  lugar:  { icon: 'ph-map-pin',       label: 'Lugar' },
}

function getNombre(fav) {
  if (fav.tipo === 'vuelo') {
    const { origen, destino } = fav.datos || {}
    if (origen && destino) return `${origen} → ${destino}`
  }
  return fav.datos?.nombre || fav.tipo
}

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState([])
  const [deleteError, setDeleteError] = useState('')

  useEffect(() => {
    api.get('/favoritos')
      .then(res => setFavorites(res.data))
      .catch(() => {})
  }, [])

  async function removeFavorite(id) {
    try {
      await api.delete(`/favoritos/${id}`)
      setFavorites(prev => prev.filter(f => f.id !== id))
      setDeleteError('')
    } catch {
      setDeleteError('No se pudo eliminar el favorito. Inténtalo de nuevo.')
    }
  }

  return (
    <div>
      <header className="section-header">
        <h2>Mis Favoritos</h2>
        <p>Vuelos, hoteles y lugares que has guardado para futuras aventuras.</p>
      </header>

      {deleteError && (
        <p className="login-error" style={{ marginBottom: '16px' }}>{deleteError}</p>
      )}

      <div className="places-grid">
        {favorites.map(fav => {
          const meta = TYPE_ICON[fav.tipo] || { icon: 'ph-star', label: fav.tipo }
          return (
            <div key={fav.id} className="place-card">
              <div className="place-image placeholder-img-tall">
                <span className="badge">
                  <i className={`ph ${meta.icon}`}></i> {meta.label}
                </span>
                <button
                  className="btn-favorite favorited"
                  title="Quitar de favoritos"
                  onClick={() => removeFavorite(fav.id)}
                >
                  <i className="ph ph-heart ph-fill" style={{ color: '#ef4444' }}></i>
                </button>
              </div>
              <div className="place-info">
                <h3>{getNombre(fav)}</h3>
                {fav.tipo === 'vuelo' && fav.datos?.aerolinea && (
                  <p>{fav.datos.aerolinea} · {fav.datos.fecha || ''}</p>
                )}
                {fav.tipo === 'hotel' && fav.datos?.precio && (
                  <p>{fav.datos.precio}€/noche · {fav.datos.checkin || ''}</p>
                )}
                {fav.tipo === 'lugar' && fav.datos?.ciudad && (
                  <p>{fav.datos.ciudad}</p>
                )}
              </div>
            </div>
          )
        })}

        {favorites.length === 0 && (
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            No tienes favoritos todavía. Busca vuelos, hoteles o lugares y guárdalos con el corazón.
          </p>
        )}
      </div>
    </div>
  )
}
