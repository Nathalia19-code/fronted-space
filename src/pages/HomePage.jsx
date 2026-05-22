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

  // ── Búsqueda ──────────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery]     = useState('')
  const [showResults, setShowResults]     = useState(false)
  const [loading, setLoading]             = useState(false)
  const [resultados, setResultados]       = useState([])
  const [searchError, setSearchError]     = useState('')
  const [searchWarning, setSearchWarning] = useState('')
  const [savedFavorites, setSavedFavorites] = useState(new Set())

  // ── UI general ────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab]     = useState('filters-flights')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [showModal, setShowModal]     = useState(false)
  const [favorites, setFavorites]     = useState(new Set())

  // ── Filtros vuelos ────────────────────────────────────────────────────────
  const [origenVuelo, setOrigenVuelo] = useState('')
  const [fechaIda, setFechaIda]       = useState('')
  const [adultosVuelo, setAdultosVuelo] = useState(1)
  const [claseVuelo, setClaseVuelo]   = useState('ECONOMY')
  const [flightPrice, setFlightPrice] = useState(1000)

  // ── Filtros hoteles ───────────────────────────────────────────────────────
  const [checkIn, setCheckIn]           = useState('')
  const [checkOut, setCheckOut]         = useState('')
  const [adultosHotel, setAdultosHotel] = useState(1)
  const [hotelPrice, setHotelPrice]     = useState(200)

  // ── Filtros actividades ───────────────────────────────────────────────────
  const [radioKm, setRadioKm]           = useState(5)
  const [activityPrice, setActivityPrice] = useState(100)

  // ── Crear viaje ───────────────────────────────────────────────────────────
  const [showFormViaje, setShowFormViaje] = useState(false)
  const [formViaje, setFormViaje] = useState({
    titulo: '', destino: '', fechaSalida: '', fechaLlegada: '', grupal: false,
  })
  const [viajeError, setViajeError] = useState('')

  // ── Selector de viaje (añadir resultado al itinerario) ────────────────────
  const [showTripSelector, setShowTripSelector] = useState(false)
  const [viajes, setViajes]                     = useState([])
  const [loadingViajes, setLoadingViajes]       = useState(false)
  const [itemToAdd, setItemToAdd]               = useState(null)
  const [addedMsg, setAddedMsg]                 = useState('')

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

  // ── Helpers ───────────────────────────────────────────────────────────────

  function getFavKey(item) {
    return item.id ?? item.xid ?? item.nombre ?? JSON.stringify(item)
  }

  // ── Búsqueda real contra el backend ──────────────────────────────────────

  async function handleSearch() {
    if (!searchQuery.trim()) {
      setSearchWarning('Por favor, escribe una ciudad o país primero.')
      return
    }
    setSearchWarning('')
    setLoading(true)
    setResultados([])
    setSearchError('')
    setShowResults(true)

    try {
      let res
      if (activeTab === 'filters-flights') {
        const origen = origenVuelo.trim() || 'Madrid'
        const fecha  = fechaIda || new Date().toISOString().slice(0, 10)
        res = await api.get('/busqueda/vuelos', {
          params: { origen, destino: searchQuery, fecha, adultos: adultosVuelo },
        })
      } else if (activeTab === 'filters-hotels') {
        const today = new Date()
        const ci = checkIn  || today.toISOString().slice(0, 10)
        const co = checkOut || new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
        res = await api.get('/busqueda/hoteles', {
          params: { destino: searchQuery, checkIn: ci, checkOut: co, adultos: adultosHotel },
        })
      } else {
        res = await api.get('/busqueda/actividades', {
          params: { ciudad: searchQuery, radio: radioKm },
        })
      }
      setResultados(res.data)
    } catch (err) {
      setSearchError(err.response?.data?.message || 'Error al buscar. Inténtalo de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  function handleNavHome() {
    setShowResults(false)
    setSearchQuery('')
    setResultados([])
    setSearchError('')
    setSearchWarning('')
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
      setViajeError(err.response?.data?.message || 'Error al crear el viaje.')
    }
  }

  // ── Guardar favorito ──────────────────────────────────────────────────────

  async function guardarFavorito(item) {
    let tipo, datos
    if (activeTab === 'filters-flights') {
      tipo  = 'vuelo'
      datos = {
        origen:    item.origen,
        destino:   item.destino,
        aerolinea: item.aerolinea,
        precio:    String(item.precio),
        moneda:    item.moneda,
      }
    } else if (activeTab === 'filters-hotels') {
      tipo  = 'hotel'
      datos = {
        nombre:    item.nombre,
        precio:    String(item.precio),
        moneda:    item.moneda,
        puntuacion: String(item.puntuacion),
        imagenUrl: item.imagenUrl || '',
      }
    } else {
      tipo  = 'lugar'
      datos = {
        nombre: item.nombre,
        tipo:   item.tipo,
        lat:    String(item.lat),
        lon:    String(item.lon),
      }
    }
    try {
      await api.post('/favoritos', { tipo, datos })
      setSavedFavorites(prev => new Set([...prev, getFavKey(item)]))
    } catch {}
  }

  // ── Añadir resultado al itinerario ────────────────────────────────────────

  function abrirSelectorViaje(item) {
    setItemToAdd(item)
    setShowTripSelector(true)
    setAddedMsg('')
    if (viajes.length === 0) {
      setLoadingViajes(true)
      api.get('/viajes')
        .then(res => setViajes(res.data))
        .catch(() => {})
        .finally(() => setLoadingViajes(false))
    }
  }

  async function añadirAItinerario(viajeId) {
    let tipo, dato
    if (activeTab === 'filters-flights') {
      tipo = 'vuelo'
      dato = {
        aerolinea:  itemToAdd.aerolinea,
        origen:     itemToAdd.origen,
        destino:    itemToAdd.destino,
        horaSalida: itemToAdd.horaSalida,
        horaLlegada: itemToAdd.horaLlegada,
        duracion:   itemToAdd.duracion,
        precio:     String(itemToAdd.precio),
        moneda:     itemToAdd.moneda,
      }
    } else if (activeTab === 'filters-hotels') {
      tipo = 'hotel'
      dato = {
        nombre:    itemToAdd.nombre,
        precio:    String(itemToAdd.precio),
        puntuacion: String(itemToAdd.puntuacion),
        imagenUrl: itemToAdd.imagenUrl || '',
      }
    } else {
      tipo = 'lugar'
      dato = {
        nombre: itemToAdd.nombre,
        tipo:   itemToAdd.tipo,
        lat:    String(itemToAdd.lat),
        lon:    String(itemToAdd.lon),
      }
    }
    try {
      await api.post(`/viajes/${viajeId}/itinerario/bloque`, { tipo, contenido: '', dato })
      setAddedMsg('¡Bloque añadido correctamente!')
      setTimeout(() => {
        setShowTripSelector(false)
        setAddedMsg('')
        setItemToAdd(null)
      }, 1500)
    } catch {
      setAddedMsg('error')
    }
  }

  // ── Render de resultados de búsqueda ──────────────────────────────────────

  function renderResultados() {
    if (loading) {
      return (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-secondary)' }}>
          <i className="ph ph-circle-notch" style={{ fontSize: '36px', animation: 'spin 1s linear infinite' }}></i>
          <p style={{ marginTop: '12px' }}>Buscando...</p>
        </div>
      )
    }
    if (searchError) {
      return <div className="login-error" style={{ marginBottom: '20px' }}>{searchError}</div>
    }

    const filtrados = activeTab === 'filters-flights'
      ? resultados.filter(r => r.precio <= flightPrice)
      : activeTab === 'filters-hotels'
      ? resultados.filter(r => r.precio <= hotelPrice)
      : resultados

    if (filtrados.length === 0) {
      return (
        <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '60px' }}>
          No se encontraron resultados para "{searchQuery}".
        </p>
      )
    }

    if (activeTab === 'filters-flights') {
      return (
        <div className="cards-grid">
          {filtrados.map((vuelo, i) => {
            const key   = getFavKey(vuelo)
            const saved = savedFavorites.has(key)
            return (
              <div className="card" key={i}>
                <div className="card-image placeholder-img">
                  <span className="badge"><i className="ph ph-airplane-tilt"></i> {vuelo.aerolinea}</span>
                  <button
                    className={`btn-favorite${saved ? ' favorited' : ''}`}
                    onClick={() => guardarFavorito(vuelo)}
                  >
                    <i className={`ph ph-heart${saved ? ' ph-fill' : ''}`}></i>
                  </button>
                </div>
                <div className="card-content">
                  <h3>{vuelo.origen} → {vuelo.destino}</h3>
                  <p>{vuelo.horaSalida} → {vuelo.horaLlegada} · {vuelo.duracion}</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '15px' }}>
                    <span className="tag tag-green">{vuelo.precio.toFixed(2)} {vuelo.moneda}</span>
                    <button
                      className="btn-buscar"
                      style={{ padding: '5px 12px', fontSize: '12px' }}
                      onClick={() => abrirSelectorViaje(vuelo)}
                    >
                      <i className="ph ph-plus"></i> Añadir
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )
    }

    if (activeTab === 'filters-hotels') {
      return (
        <div className="cards-grid">
          {filtrados.map((hotel, i) => {
            const key   = getFavKey(hotel)
            const saved = savedFavorites.has(key)
            return (
              <div className="card" key={i}>
                <div className="card-image placeholder-img" style={{ position: 'relative', overflow: 'hidden' }}>
                  {hotel.imagenUrl && (
                    <img
                      src={hotel.imagenUrl}
                      alt={hotel.nombre}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', top: 0, left: 0 }}
                    />
                  )}
                  <span className="badge">{'★'.repeat(Math.min(hotel.estrellas, 5)) || '★'}</span>
                  <button
                    className={`btn-favorite${saved ? ' favorited' : ''}`}
                    onClick={() => guardarFavorito(hotel)}
                  >
                    <i className={`ph ph-heart${saved ? ' ph-fill' : ''}`}></i>
                  </button>
                </div>
                <div className="card-content">
                  <h3>{hotel.nombre}</h3>
                  <p>Puntuación: {hotel.puntuacion > 0 ? hotel.puntuacion.toFixed(1) : 'N/A'} / 10</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '15px' }}>
                    <span className="tag tag-blue">{hotel.precio.toFixed(2)} {hotel.moneda}/noche</span>
                    <button
                      className="btn-buscar"
                      style={{ padding: '5px 12px', fontSize: '12px' }}
                      onClick={() => abrirSelectorViaje(hotel)}
                    >
                      <i className="ph ph-plus"></i> Añadir
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )
    }

    return (
      <div className="cards-grid">
        {filtrados.map((act, i) => {
          const key   = getFavKey(act)
          const saved = savedFavorites.has(key)
          return (
            <div className="card" key={i}>
              <div className="card-image placeholder-img">
                <span className="badge"><i className="ph ph-map-pin"></i> {act.tipo}</span>
                <button
                  className={`btn-favorite${saved ? ' favorited' : ''}`}
                  onClick={() => guardarFavorito(act)}
                >
                  <i className={`ph ph-heart${saved ? ' ph-fill' : ''}`}></i>
                </button>
              </div>
              <div className="card-content">
                <h3>{act.nombre}</h3>
                <p style={{ textTransform: 'capitalize' }}>{act.tipo}</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '15px' }}>
                  <span className="tag tag-blue">Actividad</span>
                  <button
                    className="btn-buscar"
                    style={{ padding: '5px 12px', fontSize: '12px' }}
                    onClick={() => abrirSelectorViaje(act)}
                  >
                    <i className="ph ph-plus"></i> Añadir
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // ── JSX principal ─────────────────────────────────────────────────────────

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
        {searchWarning && (
          <p className="login-error" style={{ marginTop: '8px', textAlign: 'center' }}>{searchWarning}</p>
        )}

        <div className="search-filters-wrapper">
          <div className="search-tabs">
            {[
              { id: 'filters-flights',    icon: 'ph-airplane-tilt', label: 'Vuelos' },
              { id: 'filters-hotels',     icon: 'ph-buildings',     label: 'Alojamientos' },
              { id: 'filters-activities', icon: 'ph-ticket',        label: 'Actividades' },
            ].map(tab => (
              <button
                key={tab.id}
                className={`tab-btn${activeTab === tab.id ? ' active' : ''}`}
                onClick={() => { setActiveTab(tab.id); setResultados([]); setSearchError('') }}
              >
                <i className={`ph ${tab.icon}`}></i> {tab.label}
              </button>
            ))}
          </div>

          <div className="dynamic-filters">
            {/* Panel vuelos */}
            <div className={`filter-panel${activeTab === 'filters-flights' ? ' active' : ''}`}>
              <div className="filter-item">
                <label>Origen</label>
                <input
                  type="text"
                  placeholder="Madrid"
                  value={origenVuelo}
                  onChange={e => setOrigenVuelo(e.target.value)}
                />
              </div>
              <div className="filter-item">
                <label>Fecha Ida</label>
                <input type="date" value={fechaIda} onChange={e => setFechaIda(e.target.value)} />
              </div>
              <div className="filter-item">
                <label>Adultos</label>
                <input
                  type="number"
                  min="1"
                  max="9"
                  value={adultosVuelo}
                  onChange={e => setAdultosVuelo(Number(e.target.value))}
                />
              </div>
              <div className="filter-item">
                <label>Clase</label>
                <select value={claseVuelo} onChange={e => setClaseVuelo(e.target.value)}>
                  <option value="ECONOMY">Turista</option>
                  <option value="BUSINESS">Business</option>
                  <option value="FIRST">Primera Clase</option>
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

            {/* Panel hoteles */}
            <div className={`filter-panel${activeTab === 'filters-hotels' ? ' active' : ''}`}>
              <div className="filter-item">
                <label>Fecha Entrada</label>
                <input type="date" value={checkIn} onChange={e => setCheckIn(e.target.value)} />
              </div>
              <div className="filter-item">
                <label>Fecha Salida</label>
                <input type="date" value={checkOut} onChange={e => setCheckOut(e.target.value)} />
              </div>
              <div className="filter-item">
                <label>Adultos</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={adultosHotel}
                  onChange={e => setAdultosHotel(Number(e.target.value))}
                />
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

            {/* Panel actividades */}
            <div className={`filter-panel${activeTab === 'filters-activities' ? ' active' : ''}`}>
              <div className="filter-item">
                <label>Radio de búsqueda: {radioKm} km</label>
                <input
                  type="range"
                  min="1"
                  max="50"
                  value={radioKm}
                  step="1"
                  onChange={e => setRadioKm(Number(e.target.value))}
                />
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
        <div style={{ marginTop: '20px', textAlign: 'left', maxWidth: '900px', marginLeft: 'auto', marginRight: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
            <h2>Resultados para "{searchQuery}"</h2>
            <button
              onClick={handleNavHome}
              style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <i className="ph ph-arrow-left"></i> Volver al inicio
            </button>
          </div>
          {renderResultados()}
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

      {/* ── Modal oferta destacada ────────────────────────────────────────── */}
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

      {/* ── Modal selector de viaje ───────────────────────────────────────── */}
      {showTripSelector && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowTripSelector(false)}>
          <div className="modal-box">
            <button className="modal-close" onClick={() => setShowTripSelector(false)}>
              <i className="ph ph-x"></i>
            </button>
            <h3 className="modal-title">
              <i className="ph ph-map-trifold" style={{ marginRight: '8px' }}></i>
              Añadir a un itinerario
            </h3>

            {addedMsg === 'error' && (
              <p className="login-error" style={{ marginBottom: '12px' }}>Error al añadir el bloque. Inténtalo de nuevo.</p>
            )}
            {addedMsg && addedMsg !== 'error' && (
              <p className="login-success" style={{ marginBottom: '12px' }}>{addedMsg}</p>
            )}

            {loadingViajes ? (
              <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '20px' }}>
                <i className="ph ph-circle-notch" style={{ animation: 'spin 1s linear infinite', marginRight: '8px' }}></i>
                Cargando viajes...
              </p>
            ) : viajes.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '8px' }}>
                No tienes itinerarios creados todavía. Crea uno desde el botón "Crear Itinerario".
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
                {viajes.map(viaje => (
                  <button
                    key={viaje.id}
                    onClick={() => añadirAItinerario(viaje.id)}
                    style={{
                      padding: '12px 16px',
                      borderRadius: '10px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--hover-bg)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontSize: '14px',
                      fontWeight: '500',
                      width: '100%',
                    }}
                  >
                    <i className="ph ph-map-trifold" style={{ marginRight: '8px' }}></i>
                    {viaje.titulo || 'Sin título'}
                    {viaje.destino && (
                      <span style={{ color: 'var(--text-secondary)', fontWeight: '400', marginLeft: '8px' }}>
                        · {viaje.destino}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Modal crear viaje ─────────────────────────────────────────────── */}
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

            {viajeError && (
              <p className="login-error" style={{ marginBottom: '12px' }}>{viajeError}</p>
            )}
            <button className="modal-cta" onClick={handleCrearViaje}>
              <i className="ph ph-plus"></i> Crear viaje
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
