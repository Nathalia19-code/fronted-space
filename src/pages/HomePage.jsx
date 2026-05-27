import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/axiosConfig'
import useFavoritosSocket from '../hooks/useFavoritosSocket'
import ConfirmEliminarFavoritoModal from '../components/ConfirmEliminarFavoritoModal'

const SERVICIOS_HOTEL = [
  'Pensión completa',
  'Todo incluido',
  'Media Pensión',
  'A la carta',
  'Servicio de habitaciones',
  'Atención al cliente',
  'Piscina',
  'Animación nocturna',
  'Club infantil',
  'Bienestar y deporte',
  'Tours locales',
  'WiFi gratis',
  'Aparcamiento',
]

const TIPOS_ACTIVIDAD = [
  'Museo',
  'Arte',
  'Historia',
  'Naturaleza',
  'Gastronomía',
  'Deporte',
  'Entretenimiento',
  'Tour',
  'Aventura',
  'Cultura',
]

/**
 * Página principal de búsqueda y exploración de vuelos, alojamientos y actividades.
 *
 * <p>Organiza el contenido en dos modos:
 * <ul>
 *   <li><em>Destacados</em> (inicial): carga GET {@code /busqueda/destacados} al montar y
 *       muestra los resultados precargados por el backend (con {@code @Cacheable}).
 *   <li><em>Resultados</em> (tras buscar): muestra los resultados filtrados con paginación
 *       lazy de 20 en 20 mediante {@code IntersectionObserver} en un elemento centinela.
 * </ul>
 *
 * <p>Hay tres pestañas de búsqueda (Vuelos / Alojamientos / Actividades), cada una con sus
 * propios filtros. Cuando ya hay resultados y el usuario cambia cualquier filtro, un
 * {@code useEffect} relanza la búsqueda automáticamente. El campo {@code origen} de vuelos
 * se envía vacío si el usuario no escribe nada (el backend lo normaliza a {@code null} y
 * devuelve vuelos de cualquier origen).
 *
 * <p>Mapa de favoritos ({@code savedFavMap}): clave compuesta
 * {@code "tipo|campo1|campo2|..."} -> {@code {id, endpoint}}. Se construye cargando los tres
 * tipos de favoritos en paralelo. No usa el ID del resultado de búsqueda porque los
 * resultados de MockAPI no tienen el mismo ID que los favoritos guardados. Se recarga en
 * tiempo real con {@code useFavoritosSocket}.
 *
 * <p>Toggle de favorito ({@code toggleFavorito}):
 * <ul>
 *   <li>Si no es favorito -> POST al endpoint del tipo correspondiente.
 *   <li>Si ya es favorito -> GET {@code /favoritos/{id}/en-uso}; si la lista está vacía,
 *       delete directo; si hay itinerarios afectados, muestra
 *       {@code ConfirmEliminarFavoritoModal} con {@code pendingDeleteFav}.
 * </ul>
 *
 * <p>Modal "Añadir a itinerario": carga GET {@code /viajes} y separa los itinerarios en
 * Individuales y Grupales. Al seleccionar uno envía POST
 * {@code /viajes/{id}/itinerario/bloque} con el item.
 *
 * <p>Carpetas: cada tarjeta tiene un icono que abre un menú para asignar/quitar el
 * resultado de búsqueda en carpetas. El toggle añade vía POST
 * {@code /carpetas/{id}/items} o quita vía delete
 * {@code /carpetas/{id}/items/{itemId}?eliminarBloques=} (con consulta previa de
 * {@code /en-uso}).
 *
 * <p>Los dropdowns de servicios de hotel y tipos de actividad se posicionan de forma
 * absoluta fijos usando {@code getBoundingClientRect()} para evitar que los contenedores
 * scrollables recorten el menú.
 */
export default function HomePage() {
  const navigate = useNavigate()

  const [searchQuery, setSearchQuery] = useState('')
  const [showResults, setShowResults] = useState(false)
  const [loading, setLoading] = useState(false)
  const [resultados, setResultados] = useState([])
  const [searchError, setSearchError] = useState('')
  const [searchWarning, setSearchWarning] = useState('')
  const [savedFavMap, setSavedFavMap] = useState(new Map())

  const [activeTab, setActiveTab] = useState('filters-flights')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [destacados, setDestacados] = useState({ vuelos: [], alojamientos: [], actividades: [] })
  const [itemToAddTab, setItemToAddTab] = useState('')

  const [origenVuelo, setOrigenVuelo] = useState('')
  const [fechaIda, setFechaIda] = useState('')
  const [claseVuelo, setClaseVuelo] = useState('ECONOMY')
  const [flightPrice, setFlightPrice] = useState(1000)

  const [checkIn, setCheckIn] = useState('')
  const [checkOut, setCheckOut] = useState('')
  const [personasPorHab, setPersonasPorHab] = useState(1)
  const [habitacionesHotel, setHabitacionesHotel] = useState(1)
  const [serviciosHotel, setServiciosHotel] = useState([])
  const [serviciosOpen, setServiciosOpen] = useState(false)
  const [categoriaHotel, setCategoriaHotel] = useState('')
  const [hotelPrice, setHotelPrice] = useState(1500)
  const serviciosRef = useRef(null)

  const [fechaActividad, setFechaActividad] = useState('')
  const [tiposActividad, setTiposActividad] = useState([])
  const [tiposActividadOpen, setTiposActividadOpen] = useState(false)
  const [soloMenores, setSoloMenores] = useState(false)
  const [activityPrice, setActivityPrice] = useState(500)
  const tiposActividadRef = useRef(null)
  const serviciosButtonRef = useRef(null)
  const tiposButtonRef = useRef(null)
  const [serviciosPosicion, setServiciosPosicion] = useState({ top: 0, left: 0, width: 0 })
  const [tiposPosicion, setTiposPosicion] = useState({ top: 0, left: 0, width: 0 })

  const [showFormViaje, setShowFormViaje] = useState(false)
  const [formViaje, setFormViaje] = useState({
    titulo: '', fechaSalida: '', fechaLlegada: '', grupal: false
  })
  const [viajeError, setViajeError] = useState('')

  const [showTripSelector, setShowTripSelector] = useState(false)
  const [viajes, setViajes] = useState([])
  const [loadingViajes, setLoadingViajes] = useState(false)
  const [itemToAdd, setItemToAdd] = useState(null)
  const [addedMsg, setAddedMsg] = useState('')
  const [pendingDeleteFav, setPendingDeleteFav] = useState(null)
  const [carpetas, setCarpetas] = useState([])
  const [carpetaMenuKey, setCarpetaMenuKey] = useState(null)
  const [pendingCarpetaDeleteSearch, setPendingCarpetaDeleteSearch] = useState(null)

  const [displayCount, setDisplayCount] = useState(20)
  const observerRef = useRef(null)
  /**
   * Ref callback que conecta el {@code IntersectionObserver} al elemento centinela de
   * paginación lazy.
   *
   * <p>Cuando el centinela entra en el viewport (margen de 200 px), incrementa
   * {@code displayCount} en 20 para mostrar el siguiente lote de resultados. Se desconecta
   * el observer anterior antes de conectar el nuevo para evitar observaciones duplicadas.
   */
  const sentinelRef = useCallback(node => {
    if (observerRef.current) observerRef.current.disconnect()
    if (!node) return
    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) setDisplayCount(prev => prev + 20)
    }, { rootMargin: '200px' })
    observerRef.current.observe(node)
  }, [])

  const containerRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setDropdownOpen(false)
      }
      if (serviciosRef.current && !serviciosRef.current.contains(e.target)) {
        setServiciosOpen(false)
      }
      if (tiposActividadRef.current && !tiposActividadRef.current.contains(e.target)) {
        setTiposActividadOpen(false)
      }
      if (!e.target.closest('[data-carpeta-menu-search]')) {
        setCarpetaMenuKey(null)
      }
    }
    function handleScroll(e) {
      if (!serviciosRef.current?.contains(e.target)) {
        setServiciosOpen(false)
      }
      if (!tiposActividadRef.current?.contains(e.target)) {
        setTiposActividadOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    window.addEventListener('scroll', handleScroll, true)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      window.removeEventListener('scroll', handleScroll, true)
    }
  }, [])

  /**
   * Añade o quita un servicio de hotel del filtro multi-selección.
   *
   * @param {string} servicio - Nombre del servicio a alternar.
   */
  function toggleServicio(servicio) {
    setServiciosHotel(prev =>
      prev.includes(servicio) ? prev.filter(s => s !== servicio) : [...prev, servicio]
    )
  }

  /**
   * Añade o quita un tipo de actividad del filtro multi-selección.
   *
   * @param {string} tipo - Nombre del tipo de actividad a alternar.
   */
  function toggleTipoActividad(tipo) {
    setTiposActividad(prev =>
      prev.includes(tipo) ? prev.filter(t => t !== tipo) : [...prev, tipo]
    )
  }

  /**
   * Construye la clave compuesta que identifica un resultado de búsqueda en {@code savedFavMap}.
   *
   * <p>Los resultados de MockAPI no tienen el mismo ID que los favoritos guardados en base de
   * datos, por lo que se usa una clave compuesta con campos estables del objeto. El formato
   * es {@code "tipo|campo1|campo2|..."} según el tipo de pestaña activa.
   *
   * @param {Object} item - Resultado de búsqueda (vuelo, hotel o actividad).
   * @param {string} tab - Identificador de la pestaña activa ({@code "filters-flights"},
   *   {@code "filters-hotels"} o {@code "filters-activities"}).
   * @returns {string} Clave compuesta para el mapa de favoritos.
   */
  function getItemKey(item, tab) {
    if (tab === 'filters-flights') return `vuelo|${item.aerolinea || ''}|${item.origen || ''}|${item.destino || ''}|${item.horaSalida || ''}`
    if (tab === 'filters-hotels') return `hotel|${item.hotel || item.nombre || ''}|${item.ciudad || ''}`
    return `actividad|${item.nombre || ''}|${item.ciudad || ''}`
  }

  /**
   * Carga en paralelo los tres tipos de favoritos y las carpetas del usuario para construir
   * {@code savedFavMap}, el mapa clave-compuesta -> {@code {id, endpoint}} que determina qué
   * resultados de búsqueda están ya guardados (corazón relleno).
   *
   * <p>Envuelto en {@code useCallback} para ser estable como dependencia del
   * {@code useFavoritosSocket}, que lo llama cada vez que el backend notifica un cambio en
   * favoritos.
   */
  const cargarFavoritosExistentes = useCallback(() => {
    Promise.all([
      api.get('/favoritos/vuelos'),
      api.get('/favoritos/alojamientos'),
      api.get('/favoritos/actividades'),
      api.get('/carpetas'),
    ]).then(([rv, ra, rac, rc]) => {
      const map = new Map()
      rv.data.forEach(f => map.set(`vuelo|${f.aerolinea || ''}|${f.origen || ''}|${f.destino || ''}|${f.horaSalida || ''}`, { id: f.id, endpoint: 'vuelos' }))
      ra.data.forEach(f => map.set(`hotel|${f.hotel || ''}|${f.ciudad || ''}`, { id: f.id, endpoint: 'alojamientos' }))
      rac.data.forEach(f => map.set(`actividad|${f.nombre || ''}|${f.ciudad || ''}`, { id: f.id, endpoint: 'actividades' }))
      setSavedFavMap(map)
      setCarpetas(rc.data)
    }).catch(() => {})
  }, [])

  useEffect(() => { cargarFavoritosExistentes() }, [cargarFavoritosExistentes])

  useEffect(() => {
    api.get('/busqueda/destacados')
      .then(res => setDestacados(res.data))
      .catch(() => {})
  }, [])

  useFavoritosSocket(cargarFavoritosExistentes)

  useEffect(() => {
    if (searchQuery.trim() && showResults) {
      handleSearch()
    }
  }, [activeTab])

  useEffect(() => {
    if (!showResults || !searchQuery.trim()) return
    handleSearch()
  }, [fechaIda, claseVuelo, checkIn, checkOut, personasPorHab, habitacionesHotel, serviciosHotel, categoriaHotel, fechaActividad, tiposActividad, soloMenores])

  /**
   * Ejecuta la búsqueda contra el endpoint correspondiente a la pestaña activa.
   *
   * <p>Para vuelos llama a {@code GET /busqueda/vuelos} con origen (puede estar vacío),
   * destino, fecha y clase. Para hoteles llama a {@code GET /busqueda/hoteles} con destino,
   * fechas opcionales, personas por habitación, número de habitaciones y servicios. Para
   * actividades llama a {@code GET /busqueda/actividades} con ciudad, fecha, soloMenores y
   * tipos. Si {@code searchQuery} está vacío, muestra un aviso y no lanza la petición.
   */
  async function handleSearch() {
    if (!searchQuery.trim()) {
      setSearchWarning('Por favor, escribe una ciudad o destino primero.')
      return
    }
    setSearchWarning('')
    setLoading(true)
    setSearchError('')
    setResultados([])
    setDisplayCount(20)
    setShowResults(true)
    try {
      let res
      if (activeTab === 'filters-flights') {
        res = await api.get('/busqueda/vuelos', {
          params: {
            origen: origenVuelo.trim(),
            destino: searchQuery.trim(),
            fecha: fechaIda || new Date().toISOString().split('T')[0],
            clase: claseVuelo,
          },
        })
      } else if (activeTab === 'filters-hotels') {
        const params = { destino: searchQuery.trim() }
        if (checkIn) params.checkIn = checkIn
        if (checkOut) params.checkOut = checkOut
        params.maxPersonas = personasPorHab
        if (habitacionesHotel > 0) params.numHabitaciones = habitacionesHotel
        if (serviciosHotel.length > 0) params.servicios = serviciosHotel.join(',')
        res = await api.get('/busqueda/hoteles', { params })
      } else {
        const params = { ciudad: searchQuery.trim() }
        if (fechaActividad) params.fecha = fechaActividad
        if (soloMenores) params.soloMenores = true
        if (tiposActividad.length > 0) params.tipos = tiposActividad.join(',')
        res = await api.get('/busqueda/actividades', { params })
      }
      setResultados(res.data || [])
    } catch (err) {
      setSearchError(err.response?.data?.message || 'Error al buscar. Comprueba tu conexión e inténtalo de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  /**
   * Vuelve a la vista de destacados limpiando todos los estados de búsqueda y resultados.
   */
  function handleNavHome() {
    setShowResults(false)
    setSearchQuery('')
    setResultados([])
    setSearchError('')
    setSearchWarning('')
  }

  /**
   * Ejecuta el delete del favorito pendiente tras la confirmación en el modal.
   *
   * <p>Lee los datos de {@code pendingDeleteFav}, cierra el modal limpiando el estado y
   * envía {@code DELETE /favoritos/{endpoint}/{id}?eliminarBloques=...}. Si tiene éxito,
   * elimina la clave del mapa local {@code savedFavMap} para que el corazón vuelva a
   * mostrarse vacío.
   *
   * @param {boolean} eliminarBloques - Opción elegida por el usuario en el modal.
   */
  async function ejecutarEliminarFavorito(eliminarBloques) {
    const { key, endpoint, id } = pendingDeleteFav
    setPendingDeleteFav(null)
    try {
      await api.delete(`/favoritos/${endpoint}/${id}?eliminarBloques=${eliminarBloques}`)
      setSavedFavMap(prev => { const next = new Map(prev); next.delete(key); return next })
    } catch {
      alert('Error al eliminar el favorito')
    }
  }

  /**
   * Alterna el estado de favorito de un resultado de búsqueda (guardar o eliminar).
   *
   * <p>Si el resultado ya está guardado como favorito:
   * <ul>
   *   <li>Consulta {@code GET /favoritos/{id}/en-uso}.
   *   <li>Si no hay itinerarios afectados, elimina directamente y actualiza el mapa.
   *   <li>Si hay itinerarios afectados, guarda el estado en {@code pendingDeleteFav} para
   *       mostrar {@link ConfirmEliminarFavoritoModal}.
   * </ul>
   * <p>Si el resultado no es favorito, construye el body según la pestaña activa y lo
   * guarda vía POST al endpoint correspondiente, añadiendo la nueva entrada al mapa.
   *
   * @param {Object} item - Resultado de búsqueda a guardar o eliminar como favorito.
   * @param {string} [tab=activeTab] - Pestaña activa, para determinar el tipo y el endpoint.
   */
  async function toggleFavorito(item, tab = activeTab) {
    const key = getItemKey(item, tab)
    const existing = savedFavMap.get(key)

    if (existing) {
      const viajesAfectados = await api.get(`/favoritos/${existing.id}/en-uso`).then(r => r.data).catch(() => [])
      if (viajesAfectados.length === 0) {
        try {
          await api.delete(`/favoritos/${existing.endpoint}/${existing.id}?eliminarBloques=true`)
          setSavedFavMap(prev => { const next = new Map(prev); next.delete(key); return next })
        } catch { alert('Error al eliminar el favorito') }
        return
      }
      setPendingDeleteFav({ key, endpoint: existing.endpoint, id: existing.id, viajesAfectados })
      return
    }

    let endpoint, body
    if (tab === 'filters-flights') {
      endpoint = '/favoritos/vuelos'
      body = {
        aerolinea: item.aerolinea,
        origen: item.origen,
        destino: item.destino,
        horaSalida: item.horaSalida || null,
        horaLlegada: item.horaLlegada || null,
        duracion: item.duracion || null,
        clase: item.clase || claseVuelo,
        precio: item.precio,
        moneda: item.moneda || 'EUR',
      }
    } else if (tab === 'filters-hotels') {
      endpoint = '/favoritos/alojamientos'
      body = {
        hotel: item.hotel || item.nombre || '',
        ciudad: item.ciudad || '',
        pais: item.pais || '',
        direccion: item.direccion || null,
        categoria: item.categoria || null,
        fechaEntrada: item.fechaEntrada || checkIn || null,
        fechaSalida: item.fechaSalida || checkOut || null,
        maxPersonas: item.maxPersonas || null,
        numHabitaciones: item.numHabitaciones || null,
        serviciosIncluidos: item.serviciosIncluidos || [],
        precioNoche: item.precioNoche,
      }
    } else {
      endpoint = '/favoritos/actividades'
      body = {
        nombre: item.nombre,
        descripcion: item.descripcion || null,
        ciudad: item.ciudad || searchQuery,
        pais: item.pais || '',
        direccion: item.direccion || null,
        precio: item.precio,
        menoresIncluidos: item.menoresIncluidos || false,
        tipoActividad: item.tipoActividad || [],
        fecha: item.fecha || fechaActividad || null,
        duracion: item.duracion || null,
        puntuacion: item.puntuacion || null,
      }
    }
    try {
      const res = await api.post(endpoint, body)
      setSavedFavMap(prev => new Map(prev).set(key, { id: res.data.id, endpoint: endpoint.replace('/favoritos/', '') }))
    } catch {
      alert('Error al guardar el favorito')
    }
  }

  /**
   * Abre el modal de selección de itinerario para añadir el item como bloque.
   *
   * <p>Guarda el item y la pestaña activa en el estado para que {@link añadirAItinerario}
   * sepa qué tipo de bloque crear. Si la lista de viajes aún no se ha cargado, lanza
   * {@code GET /viajes} en ese momento.
   *
   * @param {Object} item - Resultado de búsqueda a añadir al itinerario.
   * @param {string} [tab=activeTab] - Pestaña activa para determinar el tipo de bloque.
   */
  function abrirSelectorViaje(item, tab = activeTab) {
    setItemToAdd(item)
    setItemToAddTab(tab)
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

  /**
   * Añade el item pendiente ({@code itemToAdd}) a un itinerario como bloque vinculado.
   *
   * <p>Si el item ya está guardado como favorito reutiliza su ID; si no, lo guarda primero
   * via POST al endpoint del tipo y actualiza {@code savedFavMap}. Después crea el bloque en
   * el itinerario via {@code POST /viajes/{viajeId}/itinerario/bloque} con
   * {@code referenciaId} apuntando al favorito. Muestra un mensaje de éxito durante 1,5 s
   * antes de cerrar el modal automáticamente.
   *
   * @param {string} viajeId - Identificador del itinerario de destino.
   */
  async function añadirAItinerario(viajeId) {
    const tab = itemToAddTab || activeTab
    let tipo, endpoint, body
    if (tab === 'filters-flights') {
      tipo = 'vuelo'
      endpoint = '/favoritos/vuelos'
      body = {
        aerolinea: itemToAdd.aerolinea,
        origen: itemToAdd.origen,
        destino: itemToAdd.destino,
        horaSalida: itemToAdd.horaSalida || null,
        horaLlegada: itemToAdd.horaLlegada || null,
        duracion: itemToAdd.duracion || null,
        clase: itemToAdd.clase || claseVuelo,
        precio: itemToAdd.precio,
        moneda: itemToAdd.moneda || 'EUR',
      }
    } else if (tab === 'filters-hotels') {
      tipo = 'hotel'
      endpoint = '/favoritos/alojamientos'
      body = {
        hotel: itemToAdd.hotel || itemToAdd.nombre || '',
        ciudad: itemToAdd.ciudad || '',
        pais: itemToAdd.pais || '',
        direccion: itemToAdd.direccion || null,
        categoria: itemToAdd.categoria || null,
        fechaEntrada: itemToAdd.fechaEntrada || checkIn || null,
        fechaSalida: itemToAdd.fechaSalida || checkOut || null,
        maxPersonas: itemToAdd.maxPersonas || null,
        numHabitaciones: itemToAdd.numHabitaciones || null,
        serviciosIncluidos: itemToAdd.serviciosIncluidos || [],
        precioNoche: itemToAdd.precioNoche,
      }
    } else {
      tipo = 'actividad'
      endpoint = '/favoritos/actividades'
      body = {
        nombre: itemToAdd.nombre,
        descripcion: itemToAdd.descripcion || null,
        ciudad: itemToAdd.ciudad || searchQuery,
        pais: itemToAdd.pais || '',
        direccion: itemToAdd.direccion || null,
        precio: itemToAdd.precio,
        menoresIncluidos: itemToAdd.menoresIncluidos || false,
        tipoActividad: itemToAdd.tipoActividad || [],
        fecha: itemToAdd.fecha || fechaActividad || null,
        duracion: itemToAdd.duracion || null,
        puntuacion: itemToAdd.puntuacion || null,
      }
    }
    try {
      const key = getItemKey(itemToAdd, tab)
      const existing = savedFavMap.get(key)
      let favoritoId
      if (existing) {
        favoritoId = existing.id
      } else {
        const favRes = await api.post(endpoint, body)
        favoritoId = favRes.data.id
        setSavedFavMap(prev => new Map(prev).set(key, { id: favoritoId, endpoint: endpoint.replace('/favoritos/', '') }))
      }
      await api.post(`/viajes/${viajeId}/itinerario/bloque`, {
        tipo, contenido: null, dato: {}, referenciaId: favoritoId,
      })
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

  /**
   * Abre el modal de creación de itinerario con el tipo (individual/grupal) preseleccionado.
   *
   * @param {boolean} isGroup - Si {@code true} crea un itinerario grupal; si {@code false},
   *   individual.
   */
  function openEditor(isGroup) {
    setDropdownOpen(false)
    setFormViaje({ titulo: '', fechaSalida: '', fechaLlegada: '', grupal: isGroup })
    setViajeError('')
    setShowFormViaje(true)
  }

  /**
   * Crea el nuevo itinerario con los datos del formulario y navega al editor.
   *
   * <p>Envía {@code POST /viajes} con los campos de {@code formViaje}. Si tiene éxito,
   * cierra el modal y navega a {@code /viaje/{id}} para abrir el editor. Muestra el error
   * del backend si la petición falla.
   */
  async function handleCrearViaje() {
    setViajeError('')
    try {
      const res = await api.post('/viajes', formViaje)
      setShowFormViaje(false)
      navigate(`/viaje/${res.data.id}`)
    } catch (err) {
      setViajeError(err.response?.data?.message || 'Error al crear el viaje.')
    }
  }

  /**
   * Construye la clave compuesta para un registro de carpeta a partir de su mapa
   * {@code datos} y su tipo.
   *
   * <p>Equivalente a {@link getItemKey} pero aplicado a los datos ya almacenados en la
   * carpeta (campo {@code datos} del registro) en lugar de a un resultado de búsqueda
   * directo. Necesario porque los registros de carpeta no guardan la referencia al objeto
   * de búsqueda original.
   *
   * @param {Object} datos - Mapa de datos del registro de carpeta.
   * @param {string} tipo - Tipo del registro ({@code "vuelo"}, {@code "hotel"} o {@code "actividad"}).
   * @returns {string} Clave compuesta comparable con las del mapa de favoritos.
   */
  function getCarpetaItemKey(datos, tipo) {
    if (tipo === 'vuelo') return `vuelo|${datos.aerolinea || ''}|${datos.origen || ''}|${datos.destino || ''}|${datos.horaSalida || ''}`
    if (tipo === 'hotel') return `hotel|${(datos.hotel || datos.nombre) || ''}|${datos.ciudad || ''}`
    return `actividad|${datos.nombre || ''}|${datos.ciudad || ''}`
  }

  /**
   * Alterna la pertenencia de un resultado de búsqueda a una carpeta.
   *
   * <p>Usa {@link getCarpetaItemKey} para buscar si ya existe un registro con los mismos
   * datos en la carpeta. Si existe:
   * <ul>
   *   <li>Consulta {@code GET /carpetas/{id}/items/{itemId}/en-uso}.
   *   <li>Si no hay itinerarios afectados, elimina directamente y recarga carpetas.
   *   <li>Si hay itinerarios afectados, guarda el estado en {@code pendingCarpetaDeleteSearch}
   *       para mostrar el modal de confirmación.
   * </ul>
   * <p>Si no existe, envía {@code POST /carpetas/{carpetaId}/items} con los datos del
   * resultado como {@code datos} (sin {@code favoritoId} porque el resultado aún no está
   * necesariamente guardado como favorito).
   *
   * @param {Object} item - Resultado de búsqueda a añadir o quitar de la carpeta.
   * @param {string} tab - Pestaña activa para determinar el tipo.
   * @param {string} carpetaId - Identificador de la carpeta destino.
   */
  async function toggleCarpetaParaResultado(item, tab, carpetaId) {
    const tipo = tab === 'filters-flights' ? 'vuelo' : tab === 'filters-hotels' ? 'hotel' : 'actividad'
    const itemKey = getItemKey(item, tab)
    const carpeta = carpetas.find(c => c.id === carpetaId)
    const carpetaItem = carpeta?.items.find(ci => ci.datos && getCarpetaItemKey(ci.datos, ci.tipo) === itemKey)
    if (carpetaItem) {
      const itemId = carpetaItem.id ?? carpetaItem.favoritoId
      try {
        const viajesAfectados = await api.get(`/carpetas/${carpetaId}/items/${itemId}/en-uso`).then(r => r.data)
        if (viajesAfectados.length === 0) {
          await api.delete(`/carpetas/${carpetaId}/items/${itemId}`)
          const res = await api.get('/carpetas')
          setCarpetas(res.data)
        } else {
          setPendingCarpetaDeleteSearch({ carpetaId, carpetaItemId: itemId, viajesAfectados })
        }
      } catch {}
    } else {
      try {
        await api.post(`/carpetas/${carpetaId}/items`, { tipo, datos: item })
        const res = await api.get('/carpetas')
        setCarpetas(res.data)
      } catch {}
    }
  }

  /**
   * Ejecuta la eliminación del registro de carpeta pendiente en el contexto de búsqueda.
   *
   * <p>A diferencia de {@code FavoritesPage.ejecutarEliminarCarpeta}, aquí no se actualiza
   * el estado local de forma parcial sino que se recarga la lista completa de carpetas
   * para reflejar los cambios correctamente.
   *
   * @param {boolean} eliminarBloques - Si {@code true} borra los bloques que referencian
   *   el registro; si {@code false} los desvincula.
   */
  async function ejecutarEliminarCarpetaSearch(eliminarBloques) {
    const { carpetaId, carpetaItemId } = pendingCarpetaDeleteSearch
    setPendingCarpetaDeleteSearch(null)
    try {
      await api.delete(`/carpetas/${carpetaId}/items/${carpetaItemId}?eliminarBloques=${eliminarBloques}`)
      const res = await api.get('/carpetas')
      setCarpetas(res.data)
    } catch {}
  }

  /**
   * Renderiza la capa de botones flotantes (carpeta + corazón) superpuesta sobre cada
   * tarjeta de resultado de búsqueda.
   *
   * <p>El botón de carpeta se colorea en amarillo si el item ya pertenece a alguna carpeta.
   * El desplegable de carpetas usa {@code data-carpeta-menu-search} para que el listener
   * global de {@code mousedown} sepa cuándo cerrarlo. El botón de corazón usa
   * {@code toggleFavorito} y se rellena si el item está en {@code savedFavMap}.
   *
   * @param {Object} item - Resultado de búsqueda cuyas acciones se van a renderizar.
   * @param {string} tab - Pestaña activa para calcular la clave compuesta.
   * @returns {JSX.Element} Capa de botones flotantes posicionada con {@code position: absolute}.
   */
  function renderCardButtons(item, tab) {
    const itemKey = getItemKey(item, tab)
    const saved = savedFavMap.has(itemKey)
    const isInAnyCarpeta = carpetas.some(c =>
      c.items.some(ci => ci.datos && getCarpetaItemKey(ci.datos, ci.tipo) === itemKey)
    )
    return (
      <div style={{ position: 'absolute', top: 0, right: '12px', zIndex: 1, display: 'flex', flexDirection: 'row', gap: '4px', alignItems: 'center', transform: 'translateY(-50%)' }}>
        <div data-carpeta-menu-search style={{ position: 'relative' }}>
          <button
            onClick={() => setCarpetaMenuKey(prev => prev === itemKey ? null : itemKey)}
            title="Asignar a carpeta"
            style={{ background: carpetaMenuKey === itemKey ? '#f3f4f6' : 'white', border: '1px solid var(--border-color)', borderRadius: '6px', cursor: 'pointer', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isInAnyCarpeta ? '#f5b400' : 'var(--text-secondary)' }}
          >
            <i className="ph ph-folder-simple-plus" style={{ fontSize: '14px' }}></i>
          </button>
          {carpetaMenuKey === itemKey && (
            <div style={{ position: 'absolute', top: '32px', right: 0, minWidth: '180px', background: 'white', border: '1px solid var(--border-color)', borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 100, overflow: 'hidden' }}>
              {carpetas.length === 0 ? (
                <p style={{ padding: '10px 14px', fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>Sin carpetas creadas</p>
              ) : (
                carpetas.map(c => {
                  const enEstaCarpeta = c.items.some(ci => ci.datos && getCarpetaItemKey(ci.datos, ci.tipo) === itemKey)
                  return (
                    <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px', cursor: 'pointer', fontSize: '13px', borderBottom: '1px solid var(--border-color)', background: enEstaCarpeta ? '#fefce8' : 'transparent' }}>
                      <input
                        type="checkbox"
                        checked={enEstaCarpeta}
                        onChange={() => toggleCarpetaParaResultado(item, tab, c.id)}
                        style={{ cursor: 'pointer', accentColor: '#f5b400' }}
                      />
                      <i className="ph ph-folder-simple" style={{ color: '#f5b400', fontSize: '13px' }}></i>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nombre}</span>
                    </label>
                  )
                })
              )}
            </div>
          )}
        </div>
        <button className={`btn-favorite${saved ? ' favorited' : ''}`} onClick={() => toggleFavorito(item, tab)} style={{ position: 'static', opacity: 1 }}>
          <i className={`ph ph-heart${saved ? ' ph-fill' : ''}`}></i>
        </button>
      </div>
    )
  }

  /**
   * Renderiza una tarjeta de vuelo para la sección de destacados (scroll horizontal).
   *
   * <p>Descompone las cadenas ISO con {@code split('T')} y trunca la hora a {@code "HH:mm"}.
   * Incluye la capa de botones de {@link renderCardButtons} y el botón "Añadir a itinerario".
   *
   * @param {Object} vuelo - Datos del vuelo a mostrar.
   * @param {string} tab - Pestaña activa.
   * @param {number} idx - Índice del elemento para construir la {@code key}.
   * @returns {JSX.Element} Tarjeta de vuelo con acciones.
   */
  function renderVueloCard(vuelo, tab, idx) {
    const [fechaSal, horaSal] = vuelo.horaSalida ? vuelo.horaSalida.split('T') : ['', '']
    const [fechaLleg, horaLleg] = vuelo.horaLlegada ? vuelo.horaLlegada.split('T') : ['', '']
    const horaSalida = horaSal ? horaSal.slice(0, 5) : ''
    const horaLlegada = horaLleg ? horaLleg.slice(0, 5) : ''
    return (
      <div className="card" key={`${tab}-v-${idx}`} style={{ position: 'relative', width: '280px', flexShrink: 0, overflow: 'visible' }}>
        {renderCardButtons(vuelo, tab)}
        <div className="card-content">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <i className="ph ph-airplane-tilt" style={{ color: 'var(--accent)', fontSize: '18px' }}></i>
            <span style={{ fontWeight: 600, fontSize: '15px' }}>{vuelo.aerolinea}</span>
          </div>
          <h3 style={{ margin: '6px 0 12px' }}>{vuelo.origen} → {vuelo.destino}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
            <div>
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '0 0 2px' }}>SALIDA</p>
              <p style={{ margin: 0, fontWeight: 600 }}>{horaSalida}</p>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>{fechaSal}</p>
            </div>
            <div>
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '0 0 2px' }}>LLEGADA</p>
              <p style={{ margin: 0, fontWeight: 600 }}>{horaLlegada}</p>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>{fechaLleg}</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px', color: 'var(--text-secondary)', fontSize: '13px' }}>
            <i className="ph ph-clock"></i>
            <span>Duración: {vuelo.duracion}</span>
          </div>
          <div style={{ flex: 1 }}></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span className="tag" style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)', fontSize: '12px' }}>
              {{ ECONOMY: 'Turista', BUSINESS: 'Negocios', FIRST: 'Primera Clase' }[vuelo.clase] || 'Turista'}
            </span>
            <span className="tag tag-green" style={{ fontSize: '15px', fontWeight: 700 }}>
              {vuelo.precio != null ? vuelo.precio.toFixed(2).replace('.', ',') : '—'} EUR
            </span>
          </div>
          <button className="btn-buscar" style={{ width: '100%', padding: '6px 12px', fontSize: '13px' }} onClick={() => abrirSelectorViaje(vuelo, tab)}>
            <i className="ph ph-plus"></i> Añadir a itinerario
          </button>
        </div>
      </div>
    )
  }

  /**
   * Renderiza una tarjeta de hotel para la sección de destacados (scroll horizontal).
   *
   * <p>Convierte {@code hotel.categoria} a entero para mostrar el número de estrellas.
   * Incluye la capa de botones de {@link renderCardButtons} y el botón "Añadir a itinerario".
   *
   * @param {Object} hotel - Datos del hotel a mostrar.
   * @param {string} tab - Pestaña activa.
   * @param {number} idx - Índice del elemento para construir la {@code key}.
   * @returns {JSX.Element} Tarjeta de hotel con acciones.
   */
  function renderHotelCard(hotel, tab, idx) {
    const estrellas = parseInt(hotel.categoria) || 0
    return (
      <div className="card" key={`${tab}-h-${idx}`} style={{ position: 'relative', width: '280px', flexShrink: 0, overflow: 'visible' }}>
        {renderCardButtons(hotel, tab)}
        <div className="card-content">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <i className="ph ph-buildings" style={{ color: 'var(--accent)', fontSize: '18px' }}></i>
            <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-secondary)' }}>{hotel.ciudad}, {hotel.pais}</span>
          </div>
          <h3 style={{ margin: '6px 0 6px' }}>{hotel.hotel}</h3>
          <p style={{ margin: '0 0 10px', fontSize: '12px', color: 'var(--text-secondary)' }}>
            <i className="ph ph-map-pin"></i> {hotel.direccion}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '10px' }}>
            {estrellas > 0 && <span style={{ color: '#f5b400', fontSize: '15px' }}>{'★'.repeat(estrellas)}{'☆'.repeat(Math.max(0, 5 - estrellas))}</span>}
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginLeft: '6px' }}>{hotel.categoria}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
            <div>
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '0 0 2px' }}>ENTRADA</p>
              <p style={{ margin: 0, fontWeight: 600, fontSize: '13px' }}>{hotel.fechaEntrada}</p>
            </div>
            <div>
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '0 0 2px' }}>SALIDA</p>
              <p style={{ margin: 0, fontWeight: 600, fontSize: '13px' }}>{hotel.fechaSalida}</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '10px', fontSize: '12px', color: 'var(--text-secondary)' }}>
            <span><i className="ph ph-users"></i> Máx. {hotel.maxPersonas} personas/hab.</span>
            <span><i className="ph ph-door"></i> {hotel.numHabitaciones} hab.</span>
          </div>
          {hotel.serviciosIncluidos && hotel.serviciosIncluidos.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '12px' }}>
              {hotel.serviciosIncluidos.map((s, i) => (
                <span key={i} style={{ fontSize: '10px', background: 'var(--surface-2)', color: 'var(--text-secondary)', padding: '3px 8px', borderRadius: '10px' }}>{s}</span>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '10px', marginBottom: '10px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>por noche</span>
            <span className="tag tag-green" style={{ fontSize: '15px', fontWeight: 700 }}>
              {hotel.precioNoche != null ? hotel.precioNoche.toFixed(2).replace('.', ',') : '—'} EUR
            </span>
          </div>
          <button className="btn-buscar" style={{ width: '100%', padding: '6px 12px', fontSize: '13px' }} onClick={() => abrirSelectorViaje(hotel, tab)}>
            <i className="ph ph-plus"></i> Añadir a itinerario
          </button>
        </div>
      </div>
    )
  }

  /**
   * Renderiza una tarjeta de actividad para la sección de destacados (scroll horizontal).
   *
   * <p>Incluye la capa de botones de {@link renderCardButtons} y el botón "Añadir a itinerario".
   *
   * @param {Object} act - Datos de la actividad a mostrar.
   * @param {string} tab - Pestaña activa.
   * @param {number} idx - Índice del elemento para construir la {@code key}.
   * @returns {JSX.Element} Tarjeta de actividad con acciones.
   */
  function renderActividadCard(act, tab, idx) {
    return (
      <div className="card" key={`${tab}-a-${idx}`} style={{ position: 'relative', width: '280px', flexShrink: 0, overflow: 'visible' }}>
        {renderCardButtons(act, tab)}
        <div className="card-content">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <i className="ph ph-ticket" style={{ color: 'var(--accent)', fontSize: '18px' }}></i>
            <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-secondary)' }}>{act.ciudad}, {act.pais}</span>
          </div>
          <h3 style={{ margin: '6px 0 6px' }}>{act.nombre}</h3>
          <p style={{ margin: '0 0 10px', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{act.descripcion}</p>
          {act.tipoActividad && act.tipoActividad.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '10px' }}>
              {act.tipoActividad.map((t, i) => (
                <span key={i} style={{ fontSize: '10px', background: 'var(--surface-2)', color: 'var(--text-secondary)', padding: '3px 8px', borderRadius: '10px' }}>{t}</span>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '10px', fontSize: '12px', color: 'var(--text-secondary)' }}>
            {act.fecha && <span><i className="ph ph-calendar"></i> {act.fecha}</span>}
            {act.duracion && <span><i className="ph ph-clock"></i> {act.duracion}</span>}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '10px', marginBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {act.puntuacion > 0 && <span style={{ fontSize: '12px', color: '#f5b400', fontWeight: 600 }}>★ {act.puntuacion.toFixed(1)}</span>}
              {act.menoresIncluidos && <span style={{ fontSize: '10px', background: '#e8f5e9', color: '#2e7d32', padding: '2px 8px', borderRadius: '10px' }}>Familiar</span>}
            </div>
            <span className="tag tag-green" style={{ fontSize: '15px', fontWeight: 700 }}>
              {act.precio === 0 ? 'Gratis' : `${act.precio.toFixed(2).replace('.', ',')} EUR`}
            </span>
          </div>
          <button className="btn-buscar" style={{ width: '100%', padding: '6px 12px', fontSize: '13px' }} onClick={() => abrirSelectorViaje(act, tab)}>
            <i className="ph ph-plus"></i> Añadir a itinerario
          </button>
        </div>
      </div>
    )
  }

  /**
   * Renderiza la cuadrícula de resultados de búsqueda con paginación lazy.
   *
   * <p>Aplica los filtros de precio (y categoría en hoteles) en el cliente sobre los
   * {@code resultados} ya recibidos del backend. Muestra solo los primeros {@code displayCount}
   * elementos del array filtrado. Al final de la lista inserta el elemento centinela
   * {@code sentinelRef} que activa el {@code IntersectionObserver} para cargar el siguiente
   * lote de 20 cuando el usuario llega al final de la página.
   *
   * @returns {JSX.Element} Cuadrícula de tarjetas o mensaje de estado (cargando/sin resultados).
   */
  function renderResultados() {
    const filtrados = activeTab === 'filters-flights'
      ? resultados.filter(r => r.precio <= flightPrice)
      : activeTab === 'filters-hotels'
      ? resultados.filter(r => {
          if (r.precioNoche > hotelPrice) return false
          if (categoriaHotel && r.categoria) {
            const estrellasHotel = parseInt(r.categoria) || 0
            if (estrellasHotel < parseInt(categoriaHotel)) return false
          }
          return true
        })
      : resultados.filter(r => r.precio <= activityPrice)

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
    if (filtrados.length === 0) {
      return (
        <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '60px' }}>
          No se encontraron resultados para "{searchQuery}".
        </p>
      )
    }
    const displayed = filtrados.slice(0, displayCount)
    const hayMas = filtrados.length > displayed.length

    if (activeTab === 'filters-flights') {
      return (
        <div className="cards-grid">
          {displayed.map((vuelo, i) => {
            const [fechaSal, horaSal] = vuelo.horaSalida ? vuelo.horaSalida.split('T') : ['', '']
            const [fechaLleg, horaLleg] = vuelo.horaLlegada ? vuelo.horaLlegada.split('T') : ['', '']
            const horaSalida = horaSal ? horaSal.slice(0, 5) : ''
            const horaLlegada = horaLleg ? horaLleg.slice(0, 5) : ''
            return (
              <div className="card" key={i} style={{ position: 'relative', overflow: 'visible' }}>
                {renderCardButtons(vuelo, 'filters-flights')}
                <div className="card-content">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <i className="ph ph-airplane-tilt" style={{ color: 'var(--accent)', fontSize: '18px' }}></i>
                    <span style={{ fontWeight: 600, fontSize: '15px' }}>{vuelo.aerolinea}</span>
                  </div>
                  <h3 style={{ margin: '6px 0 12px' }}>{vuelo.origen} → {vuelo.destino}</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                    <div>
                      <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '0 0 2px' }}>SALIDA</p>
                      <p style={{ margin: 0, fontWeight: 600 }}>{horaSalida}</p>
                      <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>{fechaSal}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '0 0 2px' }}>LLEGADA</p>
                      <p style={{ margin: 0, fontWeight: 600 }}>{horaLlegada}</p>
                      <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>{fechaLleg}</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                    <i className="ph ph-clock"></i>
                    <span>Duración: {vuelo.duracion}</span>
                  </div>
                  <div style={{ flex: 1 }}></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span className="tag" style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)', fontSize: '12px' }}>
                      {{ ECONOMY: 'Turista', BUSINESS: 'Negocios', FIRST: 'Primera Clase' }[vuelo.clase] || 'Turista'}
                    </span>
                    <span className="tag tag-green" style={{ fontSize: '15px', fontWeight: 700 }}>
                      {vuelo.precio != null ? vuelo.precio.toFixed(2).replace('.', ',') : '—'} EUR
                    </span>
                  </div>
                  <button className="btn-buscar" style={{ width: '100%', padding: '6px 12px', fontSize: '13px' }} onClick={() => abrirSelectorViaje(vuelo)}>
                    <i className="ph ph-plus"></i> Añadir a itinerario
                  </button>
                </div>
              </div>
            )
          })}
          {hayMas && <div ref={sentinelRef} style={{ gridColumn: '1/-1', height: '40px' }} />}
        </div>
      )
    }
    if (activeTab === 'filters-hotels') {
      return (
        <div className="cards-grid">
          {displayed.map((hotel, i) => {
            const estrellas = parseInt(hotel.categoria) || 0
            return (
              <div className="card" key={i} style={{ position: 'relative', overflow: 'visible' }}>
                {renderCardButtons(hotel, 'filters-hotels')}
                <div className="card-content">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <i className="ph ph-buildings" style={{ color: 'var(--accent)', fontSize: '18px' }}></i>
                    <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-secondary)' }}>{hotel.ciudad}, {hotel.pais}</span>
                  </div>
                  <h3 style={{ margin: '6px 0 6px' }}>{hotel.hotel}</h3>
                  <p style={{ margin: '0 0 10px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    <i className="ph ph-map-pin"></i> {hotel.direccion}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '10px' }}>
                    {estrellas > 0 && <span style={{ color: '#f5b400', fontSize: '15px' }}>{'★'.repeat(estrellas)}{'☆'.repeat(Math.max(0, 5 - estrellas))}</span>}
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginLeft: '6px' }}>{hotel.categoria}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                    <div>
                      <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '0 0 2px' }}>ENTRADA</p>
                      <p style={{ margin: 0, fontWeight: 600, fontSize: '13px' }}>{hotel.fechaEntrada}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '0 0 2px' }}>SALIDA</p>
                      <p style={{ margin: 0, fontWeight: 600, fontSize: '13px' }}>{hotel.fechaSalida}</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '12px', marginBottom: '10px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    <span><i className="ph ph-users"></i> Máx. {hotel.maxPersonas} personas/hab.</span>
                    <span><i className="ph ph-door"></i> {hotel.numHabitaciones} hab.</span>
                  </div>
                  {hotel.serviciosIncluidos && hotel.serviciosIncluidos.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '12px' }}>
                      {hotel.serviciosIncluidos.map((s, idx) => (
                        <span key={idx} style={{ fontSize: '10px', background: 'var(--surface-2)', color: 'var(--text-secondary)', padding: '3px 8px', borderRadius: '10px' }}>{s}</span>
                      ))}
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '10px', marginBottom: '10px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>por noche</span>
                    <span className="tag tag-green" style={{ fontSize: '15px', fontWeight: 700 }}>
                      {hotel.precioNoche != null ? hotel.precioNoche.toFixed(2).replace('.', ',') : '—'} EUR
                    </span>
                  </div>
                  <button className="btn-buscar" style={{ width: '100%', padding: '6px 12px', fontSize: '13px' }} onClick={() => abrirSelectorViaje(hotel)}>
                    <i className="ph ph-plus"></i> Añadir a itinerario
                  </button>
                </div>
              </div>
            )
          })}
          {hayMas && <div ref={sentinelRef} style={{ gridColumn: '1/-1', height: '40px' }} />}
        </div>
      )
    }
    return (
      <div className="cards-grid">
        {displayed.map((act, i) => {
          return (
            <div className="card" key={i} style={{ position: 'relative', overflow: 'visible' }}>
              {renderCardButtons(act, 'filters-activities')}
              <div className="card-content">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <i className="ph ph-ticket" style={{ color: 'var(--accent)', fontSize: '18px' }}></i>
                  <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-secondary)' }}>{act.ciudad}, {act.pais}</span>
                </div>
                <h3 style={{ margin: '6px 0 6px' }}>{act.nombre}</h3>
                <p style={{ margin: '0 0 10px', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{act.descripcion}</p>
                {act.tipoActividad && act.tipoActividad.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '10px' }}>
                    {act.tipoActividad.map((t, idx) => (
                      <span key={idx} style={{ fontSize: '10px', background: 'var(--surface-2)', color: 'var(--text-secondary)', padding: '3px 8px', borderRadius: '10px' }}>{t}</span>
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '12px', marginBottom: '10px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  {act.fecha && <span><i className="ph ph-calendar"></i> {act.fecha}</span>}
                  {act.duracion && <span><i className="ph ph-clock"></i> {act.duracion}</span>}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '10px', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {act.puntuacion > 0 && <span style={{ fontSize: '12px', color: '#f5b400', fontWeight: 600 }}>★ {act.puntuacion.toFixed(1)}</span>}
                    {act.menoresIncluidos && <span style={{ fontSize: '10px', background: '#e8f5e9', color: '#2e7d32', padding: '2px 8px', borderRadius: '10px' }}>Familiar</span>}
                  </div>
                  <span className="tag tag-green" style={{ fontSize: '15px', fontWeight: 700 }}>
                    {act.precio === 0 ? 'Gratis' : `${act.precio.toFixed(2).replace('.', ',')} EUR`}
                  </span>
                </div>
                <button className="btn-buscar" style={{ width: '100%', padding: '6px 12px', fontSize: '13px' }} onClick={() => abrirSelectorViaje(act)}>
                  <i className="ph ph-plus"></i> Añadir a itinerario
                </button>
              </div>
            </div>
          )
        })}
        {hayMas && <div ref={sentinelRef} style={{ gridColumn: '1/-1', height: '40px' }} />}
      </div>
    )
  }

  return (
    <div>
      <ConfirmEliminarFavoritoModal
        show={!!pendingDeleteFav}
        viajesAfectados={pendingDeleteFav?.viajesAfectados}
        onSi={() => ejecutarEliminarFavorito(true)}
        onNo={() => ejecutarEliminarFavorito(false)}
        onCancelar={() => setPendingDeleteFav(null)}
      />
      <ConfirmEliminarFavoritoModal
        show={!!pendingCarpetaDeleteSearch}
        viajesAfectados={pendingCarpetaDeleteSearch?.viajesAfectados}
        onSi={() => ejecutarEliminarCarpetaSearch(true)}
        onNo={() => ejecutarEliminarCarpetaSearch(false)}
        onCancelar={() => setPendingCarpetaDeleteSearch(null)}
      />
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
              { id: 'filters-flights', icon: 'ph-airplane-tilt', label: 'Vuelos' },
              { id: 'filters-hotels', icon: 'ph-buildings', label: 'Alojamientos' },
              { id: 'filters-activities', icon: 'ph-ticket', label: 'Actividades' },
            ].map(tab => (
              <button
                key={tab.id}
                className={`tab-btn${activeTab === tab.id ? ' active' : ''}`}
                onClick={() => { setActiveTab(tab.id); setResultados([]); setSearchError(''); setDisplayCount(20) }}
              >
                <i className={`ph ${tab.icon}`}></i> {tab.label}
              </button>
            ))}
          </div>

          <div className="dynamic-filters">
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
                <label>Clase</label>
                <select value={claseVuelo} onChange={e => setClaseVuelo(e.target.value)}>
                  <option value="ECONOMY">Turista</option>
                  <option value="BUSINESS">Negocios</option>
                  <option value="FIRST">Primera Clase</option>
                </select>
              </div>
              <div className="filter-item">
                <label>Precio Máximo: {flightPrice} EUR</label>
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
                <input type="date" value={checkIn} onChange={e => setCheckIn(e.target.value)} />
              </div>
              <div className="filter-item">
                <label>Fecha Salida</label>
                <input type="date" value={checkOut} onChange={e => setCheckOut(e.target.value)} />
              </div>
              <div className="filter-item">
                <label>Personas por habitación: {personasPorHab === 1 ? 'desde 1': `desde ${personasPorHab}`}</label>
                <input
                  type="range"
                  min="1"
                  max="20"
                  value={personasPorHab}
                  step="1"
                  onChange={e => setPersonasPorHab(Number(e.target.value))}
                />
              </div>
              <div className="filter-item">
                <label>Habitaciones</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={habitacionesHotel}
                  onChange={e => setHabitacionesHotel(parseInt(e.target.value, 10) || 1)}
                />
              </div>
              <div className="filter-item">
                <label>Categoría</label>
                <select value={categoriaHotel} onChange={e => setCategoriaHotel(e.target.value)}>
                  <option value="">Cualquiera</option>
                  <option value="3">3 Estrellas o más</option>
                  <option value="4">4 Estrellas o más</option>
                  <option value="5">5 Estrellas</option>
                </select>
              </div>
              <div className="filter-item" ref={serviciosRef}>
                <label>Servicios {serviciosHotel.length > 0 && `(${serviciosHotel.length})`}</label>
                <button
                  ref={serviciosButtonRef}
                  type="button"
                  onClick={() => {
                    if (!serviciosOpen && serviciosButtonRef.current) {
                      const r = serviciosButtonRef.current.getBoundingClientRect()
                      setServiciosPosicion({ top: r.bottom + 4, left: r.left, width: r.width })
                    }
                    setServiciosOpen(o => !o)
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-main)',
                    color: 'var(--text)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <span style={{ fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {serviciosHotel.length === 0 ? 'Cualquiera' : serviciosHotel.join(', ')}
                  </span>
                  <i className={`ph ph-caret-${serviciosOpen ? 'up' : 'down'}`}></i>
                </button>
                {serviciosOpen && (
                  <div style={{
                    position: 'fixed',
                    top: serviciosPosicion.top,
                    left: serviciosPosicion.left,
                    width: serviciosPosicion.width,
                    zIndex: 9999,
                    background: 'var(--bg-main)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    maxHeight: '300px',
                    overflowY: 'auto',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
                  }}>
                    {SERVICIOS_HOTEL.map(s => (
                      <label
                        key={s}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '8px 12px',
                          cursor: 'pointer',
                          fontSize: '13px',
                          borderBottom: '1px solid var(--border-color)'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={serviciosHotel.includes(s)}
                          onChange={() => toggleServicio(s)}
                          style={{ cursor: 'pointer' }}
                        />
                        {s}
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <div className="filter-item">
                <label>Precio Máx: {hotelPrice} EUR/noche</label>
                <input
                  type="range"
                  min="20"
                  max="1500"
                  value={hotelPrice}
                  step="10"
                  onChange={e => setHotelPrice(Number(e.target.value))}
                />
              </div>
            </div>

            <div className={`filter-panel${activeTab === 'filters-activities' ? ' active' : ''}`}>
              <div className="filter-item">
                <label>Fecha (desde)</label>
                <input type="date" value={fechaActividad} onChange={e => setFechaActividad(e.target.value)} />
              </div>
              <div className="filter-item" ref={tiposActividadRef}>
                <label>Tipo de actividad {tiposActividad.length > 0 && `(${tiposActividad.length})`}</label>
                <button
                  ref={tiposButtonRef}
                  type="button"
                  onClick={() => {
                    if (!tiposActividadOpen && tiposButtonRef.current) {
                      const r = tiposButtonRef.current.getBoundingClientRect()
                      setTiposPosicion({ top: r.bottom + 4, left: r.left, width: r.width })
                    }
                    setTiposActividadOpen(o => !o)
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-main)',
                    color: 'var(--text)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <span style={{ fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {tiposActividad.length === 0 ? 'Todas' : tiposActividad.join(', ')}
                  </span>
                  <i className={`ph ph-caret-${tiposActividadOpen ? 'up' : 'down'}`}></i>
                </button>
                {tiposActividadOpen && (
                  <div style={{
                    position: 'fixed',
                    top: tiposPosicion.top,
                    left: tiposPosicion.left,
                    width: tiposPosicion.width,
                    zIndex: 9999,
                    background: 'var(--bg-main)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    maxHeight: '300px',
                    overflowY: 'auto',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
                  }}>
                    {TIPOS_ACTIVIDAD.map(t => (
                      <label
                        key={t}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '8px 12px',
                          cursor: 'pointer',
                          fontSize: '13px',
                          borderBottom: '1px solid var(--border-color)'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={tiposActividad.includes(t)}
                          onChange={() => toggleTipoActividad(t)}
                          style={{ cursor: 'pointer' }}
                        />
                        {t}
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <div className="filter-item checkbox-item">
                <label style={{ cursor: 'pointer', marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    checked={soloMenores}
                    onChange={e => setSoloMenores(e.target.checked)}
                    style={{ cursor: 'pointer' }}
                  />
                  Apto para menores (Familiar)
                </label>
              </div>
              <div className="filter-item">
                <label>Precio Máximo: {activityPrice === 500 ? 'Sin límite' : `${activityPrice} EUR`}</label>
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
            <h2>
              {activeTab === 'filters-flights' && resultados.length > 0
                ? `Vuelos ${resultados[0].origen} → ${resultados[0].destino}`
                : `Resultados para "${searchQuery}"`}
            </h2>
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
          {destacados.vuelos.length > 0 && (
            <section className="offers-section">
              <h2>Vuelos destacados</h2>
              <div style={{ display: 'flex', gap: '16px', overflowX: 'auto', paddingBottom: '12px', paddingTop: '20px' }}>
                {destacados.vuelos.map((v, i) => renderVueloCard(v, 'filters-flights', i))}
              </div>
            </section>
          )}

          {destacados.alojamientos.length > 0 && (
            <section className="offers-section">
              <h2>Alojamientos destacados</h2>
              <div style={{ display: 'flex', gap: '16px', overflowX: 'auto', paddingBottom: '12px', paddingTop: '20px' }}>
                {destacados.alojamientos.map((h, i) => renderHotelCard(h, 'filters-hotels', i))}
              </div>
            </section>
          )}

          {destacados.actividades.length > 0 && (
            <section className="offers-section">
              <h2>Actividades destacadas</h2>
              <div style={{ display: 'flex', gap: '16px', overflowX: 'auto', paddingBottom: '12px', paddingTop: '20px' }}>
                {destacados.actividades.map((a, i) => renderActividadCard(a, 'filters-activities', i))}
              </div>
            </section>
          )}

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
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '12px' }}>
                {[
                  { label: 'Individuales', icon: 'ph-user', items: viajes.filter(v => !v.grupal) },
                  { label: 'Grupales', icon: 'ph-users-three', items: viajes.filter(v => v.grupal) },
                ].map(grupo => grupo.items.length === 0 ? null : (
                  <div key={grupo.label}>
                    <p style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <i className={`ph ${grupo.icon}`}></i> {grupo.label}
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {grupo.items.map(viaje => (
                        <button
                          key={viaje.id}
                          onClick={() => añadirAItinerario(viaje.id)}
                          style={{
                            padding: '10px 14px',
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
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
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
