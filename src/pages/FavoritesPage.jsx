import { useState, useEffect, useCallback } from 'react'
import api from '../api/axiosConfig'
import useFavoritosSocket from '../hooks/useFavoritosSocket'

export default function FavoritesPage() {
  const [vuelos, setVuelos] = useState([])
  const [alojamientos, setAlojamientos] = useState([])
  const [actividades, setActividades] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const cargar = useCallback(() => {
    Promise.all([
      api.get('/favoritos/vuelos'),
      api.get('/favoritos/alojamientos'),
      api.get('/favoritos/actividades'),
    ])
      .then(([rv, ra, rac]) => {
        setVuelos(rv.data)
        setAlojamientos(ra.data)
        setActividades(rac.data)
        setError('')
      })
      .catch(() => setError('No se pudieron cargar los favoritos.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { cargar() }, [cargar])

  useFavoritosSocket(cargar)

  async function eliminarVuelo(id) {
    await api.delete(`/favoritos/vuelos/${id}`)
    setVuelos(prev => prev.filter(v => v.id !== id))
  }

  async function eliminarAlojamiento(id) {
    await api.delete(`/favoritos/alojamientos/${id}`)
    setAlojamientos(prev => prev.filter(a => a.id !== id))
  }

  async function eliminarActividad(id) {
    await api.delete(`/favoritos/actividades/${id}`)
    setActividades(prev => prev.filter(a => a.id !== id))
  }

  if (loading) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>
        <i className="ph ph-circle-notch" style={{ fontSize: '36px', animation: 'spin 1s linear infinite' }}></i>
        <p style={{ marginTop: '12px' }}>Cargando favoritos...</p>
      </div>
    )
  }

  return (
    <div>
      <header className="section-header">
        <h2>Favoritos</h2>
        <p>Tus vuelos, alojamientos y actividades guardados.</p>
      </header>

      {error && <p className="login-error" style={{ marginBottom: '20px' }}>{error}</p>}

      <SeccionFavoritos
        titulo="Vuelos"
        icono="ph-airplane-tilt"
        items={vuelos}
        onEliminar={eliminarVuelo}
        renderCard={v => <CardVuelo vuelo={v} />}
      />

      <SeccionFavoritos
        titulo="Alojamientos"
        icono="ph-buildings"
        items={alojamientos}
        onEliminar={eliminarAlojamiento}
        renderCard={a => <CardAlojamiento alojamiento={a} />}
      />

      <SeccionFavoritos
        titulo="Actividades"
        icono="ph-ticket"
        items={actividades}
        onEliminar={eliminarActividad}
        renderCard={a => <CardActividad actividad={a} />}
      />
    </div>
  )
}

function SeccionFavoritos({ titulo, icono, items, onEliminar, renderCard }) {
  return (
    <div style={{ marginBottom: '40px' }}>
      <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '18px', fontWeight: '700', marginBottom: '20px' }}>
        <i className={`ph ${icono}`}></i> {titulo}
        {items.length > 0 && <span style={{ fontSize: '13px', fontWeight: '400', color: 'var(--text-secondary)' }}>({items.length})</span>}
      </h3>
      {items.length === 0 ? (
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', fontStyle: 'italic' }}>
          No tienes {titulo.toLowerCase()} guardados todavía.
        </p>
      ) : (
        <div className="cards-grid">
          {items.map(item => (
            <div key={item.id} className="card" style={{ position: 'relative' }}>
              <button
                className="btn-favorite favorited"
                onClick={() => onEliminar(item.id)}
                title="Quitar de favoritos"
                style={{ position: 'absolute', top: '12px', right: '12px', zIndex: 1 }}
              >
                <i className="ph ph-heart ph-fill" style={{ color: '#ef4444' }}></i>
              </button>
              {renderCard(item)}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function CardVuelo({ vuelo }) {
  const [fechaSal, horaSal] = vuelo.horaSalida ? vuelo.horaSalida.split('T') : ['', '']
  const [fechaLleg, horaLleg] = vuelo.horaLlegada ? vuelo.horaLlegada.split('T') : ['', '']
  return (
    <div className="card-content" style={{ paddingTop: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
        <i className="ph ph-airplane-tilt" style={{ color: '#3b82f6', fontSize: '18px' }}></i>
        <span style={{ fontWeight: 600, fontSize: '15px' }}>{vuelo.aerolinea}</span>
      </div>
      <h3 style={{ margin: '6px 0 12px' }}>{vuelo.origen} → {vuelo.destino}</h3>
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
      {vuelo.duracion && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px', color: 'var(--text-secondary)', fontSize: '13px' }}>
          <i className="ph ph-clock"></i>
          <span>Duración: {vuelo.duracion}</span>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="tag" style={{ background: '#f3f4f6', color: 'var(--text-secondary)', fontSize: '12px' }}>
          {{ ECONOMY: 'Turista', BUSINESS: 'Negocios', FIRST: 'Primera Clase' }[vuelo.clase] || vuelo.clase}
        </span>
        <span className="tag tag-green" style={{ fontSize: '15px', fontWeight: 700 }}>
          {vuelo.precio != null ? Number(vuelo.precio).toFixed(2) : '—'} {vuelo.moneda}
        </span>
      </div>
    </div>
  )
}

function CardAlojamiento({ alojamiento: a }) {
  const estrellas = parseInt(a.categoria) || 0
  return (
    <div className="card-content" style={{ paddingTop: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
        <i className="ph ph-buildings" style={{ color: '#3b82f6', fontSize: '18px' }}></i>
        <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-secondary)' }}>{a.ciudad}, {a.pais}</span>
      </div>
      <h3 style={{ margin: '6px 0 6px' }}>{a.hotel}</h3>
      {a.direccion && (
        <p style={{ margin: '0 0 10px', fontSize: '12px', color: 'var(--text-secondary)' }}>
          <i className="ph ph-map-pin"></i> {a.direccion}
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
          <p style={{ margin: 0, fontWeight: 600, fontSize: '13px' }}>{a.fechaEntrada || '—'}</p>
        </div>
        <div>
          <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '0 0 2px' }}>SALIDA</p>
          <p style={{ margin: 0, fontWeight: 600, fontSize: '13px' }}>{a.fechaSalida || '—'}</p>
        </div>
      </div>
      {a.serviciosIncluidos && a.serviciosIncluidos.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '10px' }}>
          {a.serviciosIncluidos.map((s, i) => (
            <span key={i} style={{ fontSize: '10px', background: '#f3f4f6', color: 'var(--text-secondary)', padding: '3px 8px', borderRadius: '10px' }}>{s}</span>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>por noche</span>
        <span className="tag tag-green" style={{ fontSize: '15px', fontWeight: 700 }}>
          {a.precioNoche != null ? Number(a.precioNoche).toFixed(2) : '—'} €
        </span>
      </div>
    </div>
  )
}

function CardActividad({ actividad: a }) {
  return (
    <div className="card-content" style={{ paddingTop: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
        <i className="ph ph-ticket" style={{ color: '#3b82f6', fontSize: '18px' }}></i>
        <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-secondary)' }}>{a.ciudad}, {a.pais}</span>
      </div>
      <h3 style={{ margin: '6px 0 6px' }}>{a.nombre}</h3>
      {a.descripcion && (
        <p style={{ margin: '0 0 10px', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{a.descripcion}</p>
      )}
      {a.tipoActividad && a.tipoActividad.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '10px' }}>
          {a.tipoActividad.map((t, i) => (
            <span key={i} style={{ fontSize: '10px', background: '#f3f4f6', color: 'var(--text-secondary)', padding: '3px 8px', borderRadius: '10px' }}>{t}</span>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '10px', fontSize: '12px', color: 'var(--text-secondary)' }}>
        {a.fecha && <span><i className="ph ph-calendar"></i> {a.fecha}</span>}
        {a.duracion && <span><i className="ph ph-clock"></i> {a.duracion}</span>}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {a.puntuacion > 0 && <span style={{ fontSize: '12px', color: '#f5b400', fontWeight: 600 }}>★ {Number(a.puntuacion).toFixed(1)}</span>}
          {a.menoresIncluidos && <span style={{ fontSize: '10px', background: '#e8f5e9', color: '#2e7d32', padding: '2px 8px', borderRadius: '10px' }}>Familiar</span>}
        </div>
        <span className="tag tag-green" style={{ fontSize: '15px', fontWeight: 700 }}>
          {a.precio === 0 ? 'Gratis' : `${Number(a.precio).toFixed(2)} €`}
        </span>
      </div>
    </div>
  )
}
