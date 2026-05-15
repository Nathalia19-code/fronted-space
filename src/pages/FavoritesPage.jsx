import { useState, useEffect } from 'react'
import api from '../api/axiosConfig'

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState([])

  useEffect(() => {
    api.get('/favoritos')
      .then(res => setFavorites(res.data))
  }, [])

  async function removeFavorite(id) {
    try {
      await api.delete(`/favoritos/${id}`)
      setFavorites(prev => prev.filter(f => f.id !== id))
    } catch (err) {
      alert('Error al eliminar el favorito')
    }
  }

  return (
    <div>
      <header className="section-header">
        <h2>Mis Favoritos</h2>
        <p>Vuelos, hoteles y lugares que has guardado para futuras aventuras.</p>
      </header>

      <div className="places-grid">
        {favorites.map(fav => (
          <div key={fav.id} className="place-card">
            <div className="place-image placeholder-img-tall">
              <button
                className="btn-favorite favorited"
                title="Quitar de favoritos"
                onClick={() => removeFavorite(fav.id)}
              >
                <i className="ph ph-heart ph-fill" style={{ color: '#ef4444' }}></i>
              </button>
            </div>
            <div className="place-info">
              <h3>{fav.datos?.nombre || fav.tipo}</h3>
              <p>{fav.tipo}</p>
            </div>
          </div>
        ))}

        {favorites.length === 0 && (
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            No tienes favoritos todavía.
          </p>
        )}
      </div>
    </div>
  )
}
