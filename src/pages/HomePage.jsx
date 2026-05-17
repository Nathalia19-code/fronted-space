import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/axiosConfig'

const PLACES = [
  { id: 'p1', name: 'Punto de interés 1', desc: 'Distrito vibrante' },
  { id: 'p2', name: 'Punto de interés 2', desc: 'Historia viva' },
  { id: 'p3', name: 'Punto de interés 3', desc: 'Naturaleza y paz' },
]

export default function HomePage() {
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  const [showResults, setShowResults] = useState(false)
  const [activeTab, setActiveTab] = useState('filters-flights')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [flightPrice, setFlightPrice] = useState(1000)
  const [hotelPrice, setHotelPrice] = useState(200)
  const [activityPrice, setActivityPrice] = useState(100)
  const [showModal, setShowModal] = useState(false)
  const [favorites, setFavorites] = useState(new Set())
  const [showFormViaje, setShowFormViaje] = useState(false)
  const [formViaje, setFormViaje] = useState({
    titulo: '', destino: '', fechaSalida: '', fechaLlegada: '', grupal: false
  })
  const containerRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleSearch() {
    if (searchQuery.trim() !== '') {
      setShowResults(true)
    } else {
      alert('Por favor, escribe una ciudad o país primero.')
    }
  }

  function handleNavHome() {
    setShowResults(false)
    setSearchQuery('')
  }

  function toggleFavorite(id) {
    setFavorites(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function openEditor(isGroup) {
    setDropdownOpen(false)
    setFormViaje({ titulo: '', destino: '', fechaSalida: '', fechaLlegada: '', grupal: isGroup })
    setShowFormViaje(true)
  }

  async function handleCrearViaje() {
    try {
      const res = await api.post('/viajes', formViaje)
      setShowFormViaje(false)
      navigate(`/viaje/${res.data.id}`)
    } catch (err) {
      alert(err.response?.data?.message || 'Error al crear el viaje')
    }
  }

  return (
    <div>
      <header className="hero-section">
        <h1>¿A dónde viajamos?</h1>
        <p>Busca destinos, vuelos, hoteles o inspiración.</p>

        <div className="search-container">
          <i className="ph ph-magnifying-glass search-icon"></i>
          <input
            type="text"
            placeholder="Busca una ciudad, país o lugar..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
          />
          <button className="btn-buscar" onClick={handleSearch}>Buscar</button>
        </div>

        <div className="search-filters-wrapper">
          <div className="search-tabs">
            {[
              { id: 'filters-flights', icon: 'ph-airplane-tilt', label: 'Vuelos' },
              { id: 'filters-hotels', icon: 'ph-buildings', label: 'Alojamientos' },
              { id: 'filters-activities', icon: 'ph-ticket', label: 'Actividades' },
            ].map(tab => (
              <button
                key={tab.id}
                className={`tab-btn${activeTab === tab.id ? ' active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <i className={`ph ${tab.icon}`}></i> {tab.label}
              </button>
            ))}
          </div>

          <div className="dynamic-filters">
            <div className={`filter-panel${activeTab === 'filters-flights' ? ' active' : ''}`}>
              <div className="filter-item">
                <label>Fecha Ida</label>
                <input type="date" />
              </div>
              <div className="filter-item">
                <label>Fecha Vuelta</label>
                <input type="date" />
              </div>
              <div className="filter-item">
                <label>Clase</label>
                <select>
                  <option value="turista">Turista</option>
                  <option value="business">Business</option>
                  <option value="vip">Primera Clase (VIP)</option>
                </select>
              </div>
              <div className="filter-item">
                <label>Precio Máximo: {flightPrice}€</label>
                <input
                  type="range"
                  min="50"
                  max="3000"
                  value={flightPrice}
                  step="50"
                  onChange={e => setFlightPrice(Number(e.target.value))}
                />
              </div>
            </div>

            <div className={`filter-panel${activeTab === 'filters-hotels' ? ' active' : ''}`}>
              <div className="filter-item">
                <label>Fecha Entrada</label>
                <input type="date" />
              </div>
              <div className="filter-item">
                <label>Fecha Salida</label>
                <input type="date" />
              </div>
              <div className="filter-item">
                <label>Personas</label>
                <input type="number" min="1" max="10" defaultValue="2" />
              </div>
              <div className="filter-item">
                <label>Categoría</label>
                <select>
                  <option value="">Cualquiera</option>
                  <option value="3">3 Estrellas o más</option>
                  <option value="4">4 Estrellas o más</option>
                  <option value="5">5 Estrellas</option>
                </select>
              </div>
              <div className="filter-item">
                <label>Precio Máx: {hotelPrice}€/noche</label>
                <input
                  type="range"
                  min="20"
                  max="1000"
                  value={hotelPrice}
                  step="10"
                  onChange={e => setHotelPrice(Number(e.target.value))}
                />
              </div>
            </div>

            <div className={`filter-panel${activeTab === 'filters-activities' ? ' active' : ''}`}>
              <div className="filter-item">
                <label>Fecha</label>
                <input type="date" />
              </div>
              <div className="filter-item">
                <label>Tipo de Actividad</label>
                <select>
                  <option value="todas">Todas</option>
                  <option value="tour">Tour guiado</option>
                  <option value="museo">Museos e Historia</option>
                  <option value="aventura">Aventura y Naturaleza</option>
                </select>
              </div>
              <div className="filter-item checkbox-item">
                <label style={{ cursor: 'pointer', marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input type="checkbox" /> Apto para menores (Familiar)
                </label>
              </div>
              <div className="filter-item">
                <label>Precio Máximo: {activityPrice}€</label>
                <input
                  type="range"
                  min="0"
                  max="500"
                  value={activityPrice}
                  step="5"
                  onChange={e => setActivityPrice(Number(e.target.value))}
                />
              </div>
            </div>
          </div>
        </div>
      </header>

      {showResults ? (
        <div style={{ marginTop: '20px', textAlign: 'left', maxWidth: '800px', marginLeft: 'auto', marginRight: 'auto' }}>
          <h2 style={{ marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
            Resultados para "{searchQuery}"
          </h2>
          <div className="cards-grid">
            <div className="card">
              <div className="card-image placeholder-img">
                <button
                  className={`btn-favorite${favorites.has('result-1') ? ' favorited' : ''}`}
                  onClick={() => toggleFavorite('result-1')}
                >
                  <i className={`ph ph-heart${favorites.has('result-1') ? ' ph-fill' : ''}`}></i>
                </button>
              </div>
              <div className="card-content">
                <h3>Resultado Encontrado</h3>
                <p>Este elemento aparecerá dinámicamente según lo que busques.</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '15px' }}>
                  <span className="tag tag-blue">Precio Dinámico</span>
                  <button className="btn-add-mini"><i className="ph ph-plus"></i></button>
                </div>
              </div>
            </div>
          </div>
          <button
            onClick={handleNavHome}
            style={{ marginTop: '20px', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <i className="ph ph-arrow-left"></i> Volver al inicio
          </button>
        </div>
      ) : (
        <div>
          <section className="offers-section">
            <h2>Ofertas destacadas</h2>
            <div className="cards-grid">
              <div className="card offer-card" onClick={() => setShowModal(true)}>
                <div className="card-image placeholder-img">
                  <span className="badge"><i className="ph ph-airplane-tilt"></i> Vuelos</span>
                </div>
                <div className="card-content">
                  <h3>Vuelos a Japón</h3>
                  <p>Ofertas especiales de temporada. Reserva con antelación y asegura tu lugar.</p>
                  <span className="tag tag-green">Desde $800</span>
                </div>
              </div>
              <div className="card offer-card" onClick={() => setShowModal(true)}>
                <div className="card-image placeholder-img">
                  <span className="badge"><i className="ph ph-buildings"></i> Hoteles</span>
                </div>
                <div className="card-content">
                  <h3>Estadías en Tokio</h3>
                  <p>Alojamientos céntricos con las mejores vistas y comodidades modernas.</p>
                  <span className="tag tag-blue">20% descuento</span>
                </div>
              </div>
            </div>
          </section>

          <section className="places-section">
            <h2>Sitios más destacados de Ciudad de ejemplo</h2>
            <div className="places-grid">
              {PLACES.map(place => (
                <div key={place.id} className="place-card">
                  <div className="place-image placeholder-img-tall">
                    <button
                      className={`btn-favorite${favorites.has(place.id) ? ' favorited' : ''}`}
                      onClick={() => toggleFavorite(place.id)}
                    >
                      <i className={`ph ph-heart${favorites.has(place.id) ? ' ph-fill' : ''}`}></i>
                    </button>
                  </div>
                  <div className="place-info">
                    <h3>{place.name}</h3>
                    <p>{place.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="start-trip-section">
            <div className="start-trip-content">
              <div className="start-trip-text">
                <h2>Empieza tu viaje</h2>
                <p>Crea un nuevo itinerario desde cero, invita a tus amigos para colaborar en tiempo real o utiliza nuestras plantillas recomendadas por expertos.</p>
              </div>

              <div ref={containerRef} className="create-itinerary-container">
                <button
                  className={`btn-create-itinerary${dropdownOpen ? ' active' : ''}`}
                  onClick={() => setDropdownOpen(prev => !prev)}
                >
                  <i className="ph ph-plus"></i>
                  <span>Crear Itinerario</span>
                  <i className="ph ph-caret-down trailing-icon"></i>
                </button>

                <div className={`dropdown-menu${dropdownOpen ? ' show' : ''}`}>
                  <button className="dropdown-item" onClick={() => openEditor(false)}>
                    <i className="ph ph-user"></i>
                    Itinerario Individual
                  </button>
                  <button className="dropdown-item" onClick={() => openEditor(true)}>
                    <i className="ph ph-users-three"></i>
                    Itinerario Grupal
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal-box">
            <button className="modal-close" onClick={() => setShowModal(false)}>
              <i className="ph ph-x"></i>
            </button>
            <h3 className="modal-title">Detalles de la Oferta</h3>
            <p className="modal-description">
              Vuelo directo Madrid - Tokio con descuento exclusivo de temporada. Incluye maleta facturada de 23kg.
            </p>
            <button className="modal-cta">
              <i className="ph ph-plus"></i> Añadir a un itinerario
            </button>
          </div>
        </div>
      )}

      {showFormViaje && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowFormViaje(false)}>
          <div className="modal-box">
            <button className="modal-close" onClick={() => setShowFormViaje(false)}>
              <i className="ph ph-x"></i>
            </button>
            <h3 className="modal-title">Nuevo Itinerario</h3>

            <div className="input-group">
              <label>Título</label>
              <input
                type="text"
                placeholder="Escapada a Roma"
                value={formViaje.titulo}
                onChange={e => setFormViaje({ ...formViaje, titulo: e.target.value })}
              />
            </div>

            <div className="input-group">
              <label>Destino</label>
              <input
                type="text"
                placeholder="Roma, Italia"
                value={formViaje.destino}
                onChange={e => setFormViaje({ ...formViaje, destino: e.target.value })}
              />
            </div>

            <div className="input-group">
              <label>Fecha de salida</label>
              <input
                type="date"
                value={formViaje.fechaSalida}
                onChange={e => setFormViaje({ ...formViaje, fechaSalida: e.target.value })}
              />
            </div>

            <div className="input-group">
              <label>Fecha de llegada</label>
              <input
                type="date"
                value={formViaje.fechaLlegada}
                onChange={e => setFormViaje({ ...formViaje, fechaLlegada: e.target.value })}
              />
            </div>

            <button className="modal-cta" onClick={handleCrearViaje}>
              <i className="ph ph-plus"></i> Crear viaje
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
