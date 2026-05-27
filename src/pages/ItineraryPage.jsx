import { useState, useEffect, useCallback, useMemo, Fragment, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import * as Y from 'yjs'
import api from '../api/axiosConfig'
import TextBlock from '../components/blocks/TextBlock'
import FlightBlock from '../components/blocks/FlightBlock'
import HotelBlock from '../components/blocks/HotelBlock'
import RouteBlock from '../components/blocks/RouteBlock'
import ActivityBlock from '../components/blocks/ActivityBlock'
import Cajon from '../components/Cajon'
import PresupuestoPanel from '../components/PresupuestoPanel'
import useItinerarioSocket, { uint8ToBase64, base64ToUint8 } from '../hooks/useItinerarioSocket'

const AVATAR_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899']
/**
 * Devuelve un color de avatar determinístico para un identificador de usuario.
 *
 * <p>Calcula un hash polinomial sobre los caracteres del {@code id} y lo mapea a uno de los
 * siete colores de {@code AVATAR_COLORS} usando módulo. El mismo ID siempre produce el mismo
 * color, lo que permite que el avatar de un usuario sea coherente en todos los clientes sin
 * guardar nada en base de datos.
 *
 * @param {string} id - Identificador del usuario.
 * @returns {string} Color CSS (hexadecimal) para el avatar.
 */
function colorParaId(id) {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (id.charCodeAt(i) + hash * 31) | 0
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

/**
 * Genera el array de fechas ISO ({@code "YYYY-MM-DD"}) entre {@code fechaSalida} y
 * {@code fechaLlegada} inclusives, en UTC.
 *
 * <p>Si alguna de las fechas es nula o vacía, o si {@code fechaLlegada} es anterior a
 * {@code fechaSalida}, devuelve un array vacío. Usa UTC para evitar desfases de zona
 * horaria al construir objetos {@code Date} con la cadena ISO directa.
 *
 * @param {string|null} fechaSalida - Fecha de inicio en formato {@code "YYYY-MM-DD"}.
 * @param {string|null} fechaLlegada - Fecha de fin en formato {@code "YYYY-MM-DD"}.
 * @returns {string[]} Array de fechas ISO de cada día del itinerario, o vacío si las fechas no son válidas.
 */
function computeDays(fechaSalida, fechaLlegada) {
  if (!fechaSalida || !fechaLlegada) return []
  const start = new Date(fechaSalida + 'T00:00:00Z')
  const end = new Date(fechaLlegada + 'T00:00:00Z')
  if (end < start) return []
  const days = []
  const cur = new Date(start)
  while (cur <= end) {
    days.push(cur.toISOString().split('T')[0])
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return days
}

/**
 * Extrae la fecha principal de un bloque para asignarlo a un día del itinerario.
 *
 * <p>Prioriza los datos manuales ({@code dato}) sobre {@code datosReferencia}. Para vuelos
 * usa {@code dato.fechaSal} o la fecha de {@code dr.horaSalida} (splitada por {@code 'T'});
 * para hoteles usa el check-in; para actividades usa {@code fecha}. Devuelve {@code null}
 * si no se puede determinar una fecha (bloques de texto o ruta, o sin datos).
 *
 * @param {Object} bloque - Bloque del itinerario.
 * @returns {string|null} Fecha ISO {@code "YYYY-MM-DD"} o {@code null}.
 */
function getBlockDate(bloque) {
  const dr = bloque.datosReferencia
  const dato = bloque.dato || {}
  switch (bloque.tipo) {
    case 'vuelo': return dato.fechaSal || dr?.horaSalida?.split?.('T')?.[0] || null
    case 'hotel': return dato.checkin || dr?.fechaEntrada || null
    case 'actividad': return dato.fecha || dr?.fecha || null
    default: return null
  }
}

/**
 * Distribuye los bloques del itinerario en grupos por día.
 *
 * <p>Para cada bloque:
 * <ul>
 *   <li>Si tiene {@code diaFijado}, se coloca en ese día (índice {@code diaFijado - 1},
 *       recortado al último día si supera el rango).
 *   <li>Si no tiene {@code diaFijado}, se usa {@link getBlockDate}. Si la fecha coincide
 *       con algún día del itinerario, se coloca en ese día; en caso contrario, cae al
 *       último día como fallback.
 * </ul>
 *
 * @param {Object[]} bloques - Lista completa de bloques del itinerario.
 * @param {string[]} days - Array de fechas ISO generado por {@link computeDays}.
 * @returns {{ date: string, blocks: Object[] }[]} Array de grupos, uno por día.
 */
function groupBlocksByDay(bloques, days) {
  if (!days.length) return []
  const lastIdx = days.length - 1
  const groups = days.map(d => ({ date: d, blocks: [] }))
  for (const bloque of bloques) {
    if (bloque.diaFijado != null) {
      const idx = Math.min(bloque.diaFijado - 1, lastIdx)
      groups[Math.max(0, idx)].blocks.push(bloque)
    } else {
      const blockDate = getBlockDate(bloque)
      const dayIdx = blockDate ? days.indexOf(blockDate) : -1
      if (dayIdx >= 0) {
        groups[dayIdx].blocks.push(bloque)
      } else {
        groups[lastIdx].blocks.push(bloque)
      }
    }
  }
  return groups
}

/**
 * Devuelve el número de día (1-indexed) al que pertenece un bloque dentro del itinerario.
 *
 * <p>Sigue la misma lógica que {@link groupBlocksByDay}: prioriza {@code diaFijado} y
 * cae a la fecha del bloque o al último día si no hay coincidencia. Usado para mostrar
 * el indicador "Día N" en el handle de arrastre.
 *
 * @param {Object} bloque - Bloque del itinerario.
 * @param {string[]} days - Array de fechas ISO del itinerario.
 * @returns {number} Número de día (1-indexed), o el último día como fallback.
 */
function getBlockCurrentDay(bloque, days) {
  if (bloque.diaFijado != null) return Math.min(bloque.diaFijado, days.length)
  const blockDate = getBlockDate(bloque)
  const dayIdx = blockDate ? days.indexOf(blockDate) : -1
  return dayIdx >= 0 ? dayIdx + 1 : days.length
}

/**
 * Convierte una fecha ISO {@code "YYYY-MM-DD"} al formato legible {@code "DD/MM/YYYY"}.
 *
 * @param {string} dateStr - Fecha en formato ISO.
 * @returns {string} Fecha formateada para presentación en el PDF y la cabecera.
 */
function formatDate(dateStr) {
  const [year, month, day] = dateStr.split('-')
  return `${day}/${month}/${year}`
}

/**
 * Zona de inserción de 28 px de alto que aparece entre bloques del itinerario.
 *
 * <p>Cuando está activa ({@code activeDropKey === dropKey}) muestra una barra azul de 3 px
 * de alto que indica el punto de destino del arrastre. Cuando no está activa la barra es
 * invisible pero el área de detección sigue ocupando los 28 px completos para facilitar el
 * drop sin necesidad de precisión excesiva.
 *
 * @param {string} dropKey - Clave única que identifica esta zona (p. ej. {@code "before-{bloqueId}"}).
 * @param {string|null} activeDropKey - Clave de la zona actualmente activa (con drag sobre ella).
 * @param {Function} onDragOver - Callback que recibe {@code dropKey} al pasar el cursor sobre la zona.
 * @param {Function} onDrop - Callback que recibe el evento de drop y {@code dropKey}.
 */
function DropZone({ dropKey, activeDropKey, onDragOver, onDrop }) {
  const isActive = activeDropKey === dropKey
  return (
    <div
      onDragOver={e => { e.preventDefault(); onDragOver(dropKey) }}
      onDrop={e => onDrop(e, dropKey)}
      style={{ height: '28px', display: 'flex', alignItems: 'center' }}
    >
      <div style={{
        width: '100%',
        height: isActive ? '3px' : '0',
        background: '#3b82f6',
        borderRadius: '2px',
        transition: 'height 0.1s',
        pointerEvents: 'none',
      }} />
    </div>
  )
}

/**
 * Editor principal del itinerario. Gestiona la edición colaborativa en tiempo real,
 * el drag & drop de bloques, la exportación a PDF y los paneles de colaboradores y
 * presupuesto.
 *
 * <p>Al montar carga el itinerario con GET {@code /viajes/{id}} e inicializa el editor.
 * Un {@code Y.Doc} (Yjs) se crea con {@code useMemo} enlazado al {@code id} del
 * itinerario; si el usuario navega a otro itinerario, React crea un nuevo documento.
 *
 * <p>Modos de visualización:
 * <ul>
 *   <li><em>Vista plana</em>: todos los bloques en una lista continua. Se usa cuando no
 *       hay fechas definidas o {@code soloConBloques} es {@code true}.
 *   <li><em>Vista por días</em>: {@code computeDays} genera un array de fechas entre
 *       {@code fechaSalida} y {@code fechaLlegada}. {@code groupBlocksByDay} distribuye
 *       los bloques por día usando {@code diaFijado} (si no es nulo) o la fecha del
 *       bloque ({@code dato.fechaSal}, {@code dr.fecha}, etc.) con fallback al último día.
 * </ul>
 *
 * <p>Colaboración en tiempo real (via {@code useItinerarioSocket}):
 * <ul>
 *   <li>Updates Yjs remotos se aplican con {@code Y.applyUpdate(ydoc, ..., 'remote')}.
 *   <li>Cambios locales del {@code ydoc} se publican como base64 vía
 *       {@code sendUpdate(uint8ToBase64(update))}, ignorando las actualizaciones con
 *       origen {@code 'remote'} para no hacer eco.
 *   <li>Cambios estructurales (bloques añadidos/borrados/reordenados) se notifican vía
 *       {@code sendCambioEstructura()} para que los colaboradores recarguen el itinerario.
 * </ul>
 *
 * <p>Drag & drop:
 * <ul>
 *   <li>Arrastrar desde el cajón: los {@code DropZone} reciben el bloque y llaman
 *       {@code addBlockFromCajon} para crear el bloque y luego reordenar.
 *   <li>Reordenar entre bloques: el drag del handle {@code drag-handle} activa
 *       {@code canDrag} y publica PATCH {@code /viajes/{id}/itinerario/reordenar}
 *       con la nueva lista de IDs.
 *   <li>Auto-scroll: un RAF en {@code handleDragMove} comprueba {@code dragClientY}
 *       y desplaza la ventana si el cursor está cerca del borde.
 * </ul>
 *
 * <p>Exportación a PDF: usa {@code html2canvas} sobre el contenedor del editor y
 * {@code jsPDF} para crear el PDF. La portada se renderiza con Canvas 2D usando
 * {@code drawImage} con parámetros de recorte centrado (sy = (imageHeight - croppedHeight) / 2)
 * para replicar {@code object-fit: cover}.
 *
 * <p>El estado {@code aviso} actúa como máquina de estados simple:
 * {@code null} (normal), {@code "eliminado"} (el itinerario fue borrado por otro usuario),
 * {@code "acceso-revocado"} (el usuario fue expulsado o salió voluntariamente).
 *
 * <p>La preferencia {@code soloConBloques} (ocultar días vacíos) se persiste en
 * {@code localStorage} con clave compuesta {@code ocultarDias_{viajeId}_{usuarioId}}.
 * El {@code useState} usa un inicializador lazy para leer {@code localStorage} solo en
 * el primer render.
 */
export default function ItineraryPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [viaje, setViaje] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [aviso, setAviso] = useState(null)
  const [dropTargetKey, setDropTargetKey] = useState(null)
  const [soloConBloques, setSoloConBloques] = useState(() =>
    localStorage.getItem(`ocultarDias_${id}_${localStorage.getItem('usuarioId')}`) === 'true'
  )
  const [draggingBlockId, setDraggingBlockId] = useState(null)
  const canDrag = useRef(false)
  const coverInputRef = useRef(null)
  const [uploadingCover, setUploadingCover] = useState(false)
  const [tituloEdit, setTituloEdit] = useState('')
  const [fechaSalidaEdit, setFechaSalidaEdit] = useState('')
  const [fechaLlegadaEdit, setFechaLlegadaEdit] = useState('')
  const [fechasError, setFechasError] = useState('')
  const metaFocused = useRef(false)
  const debounceMeta = useRef(null)
  const scrollRafRef = useRef(null)
  const dragClientY = useRef(null)
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const [showCompartir, setShowCompartir] = useState(false)
  const [showParticipantes, setShowParticipantes] = useState(false)
  const [colaboradoresInfo, setColaboradoresInfo] = useState([])
  const [emailCompartir, setEmailCompartir] = useState('')
  const [compartirLoading, setCompartirLoading] = useState(false)
  const [compartirError, setCompartirError] = useState('')
  const [compartirExito, setCompartirExito] = useState('')

  const ydoc = useMemo(() => new Y.Doc(), [id])

  /**
   * Aplica un update Yjs recibido por WebSocket al documento local.
   *
   * <p>Decodifica la cadena base64 y llama a {@code Y.applyUpdate} con origen
   * {@code 'remote'}, lo que hace que el listener {@code ydoc.on('update')} ignore este
   * cambio y no lo reenvíe de vuelta al servidor. Envuelto en {@code useCallback} para
   * estabilizar la referencia como dependencia de {@code useItinerarioSocket}.
   */
  const handleWsUpdate = useCallback(
    (base64) => {
      Y.applyUpdate(ydoc, base64ToUint8(base64), 'remote')
    },
    [ydoc]
  )

  /**
   * Recarga el itinerario completo desde el servidor.
   *
   * <p>Llamado cuando un colaborador notifica un cambio estructural (nuevo bloque,
   * reordenación, desvinculación) o cuando el componente necesita refrescar los datos.
   * Si la petición falla con 404 activa el aviso {@code "eliminado"}, y con 400/403
   * activa {@code "acceso-revocado"}.
   */
  const recargarViaje = useCallback(() => {
    api.get(`/viajes/${id}`)
      .then(res => setViaje(res.data))
      .catch(err => {
        const status = err.response?.status
        if (status === 404) setAviso('eliminado')
        else if (status === 400 || status === 403) setAviso('acceso-revocado')
      })
  }, [id])

  /**
   * Callback invocado por los bloques al guardar su contenido editado.
   *
   * <p>Recarga el itinerario para obtener los datos actualizados del servidor y notifica
   * el cambio estructural a los colaboradores para que también recarguen.
   */
  function handleContentSaved() {
    recargarViaje()
    sendCambioEstructura()
  }

  /**
   * Persiste la lista actualizada de gastos extra y notifica el cambio a los colaboradores.
   *
   * <p>Envía {@code PATCH /viajes/{id}/gastos-extra} con la nueva lista. Si tiene éxito,
   * actualiza el estado local y llama {@code sendCambioEstructura()} para que el panel de
   * presupuesto de los colaboradores también se actualice.
   *
   * @param {Array<{id: number, label: string, monto: number}>} nuevosExtras - Nueva lista de gastos extra.
   */
  async function handleGastosExtraChange(nuevosExtras) {
    try {
      const res = await api.patch(`/viajes/${id}/gastos-extra`, nuevosExtras)
      setViaje(res.data)
      sendCambioEstructura()
    } catch {
    }
  }

  const { connected, usuariosActivos, sendUpdate, sendCambioEstructura } = useItinerarioSocket(
    id,
    handleWsUpdate,
    recargarViaje,
    () => setAviso('eliminado'),
    () => setAviso('acceso-revocado')
  )

  useEffect(() => {
    const handler = (update, origin) => {
      if (origin !== 'remote') {
        sendUpdate(uint8ToBase64(update))
      }
    }
    ydoc.on('update', handler)
    return () => ydoc.off('update', handler)
  }, [ydoc, sendUpdate])

  useEffect(() => {
    api.get(`/viajes/${id}`)
      .then(res => {
        setViaje(res.data)
        setLoading(false)
      })
      .catch(err => {
        const msg = err.response?.data?.message ?? ''
        if (msg.startsWith('Viaje no encontrado') || err.response?.status === 404) {
          setAviso('eliminado')
        } else if (msg === 'No tienes acceso a este viaje' || err.response?.status === 403) {
          setAviso('acceso-revocado')
        } else {
          setError(msg || 'No se pudo cargar el viaje')
        }
        setLoading(false)
      })
  }, [id])

  useEffect(() => {
    if (!viaje || metaFocused.current) return
    setTituloEdit(viaje.titulo ?? '')
    setFechaSalidaEdit(viaje.fechaSalida ?? '')
    setFechaLlegadaEdit(viaje.fechaLlegada ?? '')
  }, [viaje])

  useEffect(() => {
    const uid = localStorage.getItem('usuarioId')
    localStorage.setItem(`ocultarDias_${id}_${uid}`, String(soloConBloques))
  }, [soloConBloques, id])

  useEffect(() => {
    const scroller = document.querySelector('.main-content')
    function scrollStep() {
      const y = dragClientY.current
      if (y !== null && scroller) {
        const threshold = 80
        if (y < threshold) {
          scroller.scrollBy(0, -Math.round(12 * (1 - y / threshold)))
        } else if (y > window.innerHeight - threshold) {
          scroller.scrollBy(0, Math.round(12 * (1 - (window.innerHeight - y) / threshold)))
        }
        scrollRafRef.current = requestAnimationFrame(scrollStep)
      } else {
        scrollRafRef.current = null
      }
    }
    function onDragOver(e) {
      e.preventDefault()
      dragClientY.current = e.clientY
      if (!scrollRafRef.current) {
        scrollRafRef.current = requestAnimationFrame(scrollStep)
      }
    }
    function stopScroll() {
      dragClientY.current = null
      if (scrollRafRef.current) {
        cancelAnimationFrame(scrollRafRef.current)
        scrollRafRef.current = null
      }
    }
    document.addEventListener('dragover', onDragOver)
    document.addEventListener('dragend', stopScroll)
    document.addEventListener('drop', stopScroll)
    return () => {
      document.removeEventListener('dragover', onDragOver)
      document.removeEventListener('dragend', stopScroll)
      document.removeEventListener('drop', stopScroll)
      stopScroll()
    }
  }, [])

  /**
   * Añade un bloque al itinerario a partir de un favorito arrastrado desde el cajón.
   *
   * <p>Envía {@code POST /viajes/{id}/itinerario/bloque} con los campos {@code tipo},
   * {@code dato}, {@code referenciaId} y {@code fuente} del objeto arrastrado. El campo
   * {@code fuente} es {@code 'carpeta'} si el item proviene de una carpeta, o {@code null}
   * si es un favorito directo. Tras recibir la respuesta notifica el cambio estructural.
   *
   * @param {{ tipo: string, dato: Object, referenciaId: string|null, fuente: string|null }} fav
   *   Datos del favorito o registro de carpeta arrastrado.
   */
  async function addBlockFromCajon(fav) {
    try {
      const res = await api.post(`/viajes/${id}/itinerario/bloque`, {
        tipo: fav.tipo,
        contenido: null,
        dato: fav.dato ?? {},
        referenciaId: fav.referenciaId ?? null,
        fuente: fav.fuente ?? null,
      })
      setViaje(res.data)
      sendCambioEstructura()
    } catch (err) {
      alert(err.response?.data?.message || 'Error al añadir el bloque')
    }
  }

  /**
   * Añade un bloque vacío de un tipo determinado al final del itinerario.
   *
   * <p>Usado desde el menú de inserción que aparece al pasar el cursor entre bloques.
   * Envía {@code POST /viajes/{id}/itinerario/bloque} con {@code dato} vacío y sin
   * {@code referenciaId}; el bloque resultante es siempre manual.
   *
   * @param {string} tipo - Tipo de bloque a crear ({@code "texto"}, {@code "vuelo"},
   *   {@code "hotel"}, {@code "actividad"} o {@code "lugar"}).
   */
  async function addBlock(tipo) {
    try {
      const res = await api.post(`/viajes/${id}/itinerario/bloque`, {
        tipo,
        contenido: null,
        dato: {}
      })
      setViaje(res.data)
      sendCambioEstructura()
    } catch (err) {
      alert(err.response?.data?.message || 'Error al añadir el bloque')
    }
  }

  /**
   * Elimina un bloque del itinerario y re-ordena los restantes.
   *
   * <p>Envía {@code DELETE /viajes/{id}/itinerario/bloque/{bloqueId}}. El backend
   * recalcula el campo {@code orden} de los bloques restantes. Notifica el cambio
   * estructural a los colaboradores.
   *
   * @param {string} bloqueId - Identificador UUID del bloque a eliminar.
   */
  async function deleteBlock(bloqueId) {
    try {
      const res = await api.delete(`/viajes/${id}/itinerario/bloque/${bloqueId}`)
      setViaje(res.data)
      sendCambioEstructura()
    } catch (err) {
      alert(err.response?.data?.message || 'Error al eliminar el bloque')
    }
  }

  /**
   * Desvincula un bloque del favorito al que referencia, convirtiéndolo en manual.
   *
   * <p>Envía {@code PATCH /viajes/{id}/itinerario/bloque/{bloqueId}/desvincular}. El
   * backend copia todos los campos del favorito a {@code dato} y pone {@code referenciaId=null}.
   * El bloque NO se remonta en el cliente (key sigue siendo {@code bloque.id}), por lo que
   * {@code campos} en el componente hijo conserva los valores.
   *
   * @param {string} bloqueId - Identificador UUID del bloque a desvincular.
   */
  async function desvinculerBloque(bloqueId) {
    try {
      const res = await api.patch(`/viajes/${id}/itinerario/bloque/${bloqueId}/desvincular`)
      setViaje(res.data)
      sendCambioEstructura()
    } catch (err) {
      alert(err.response?.data?.message || 'Error al desvincular el bloque')
    }
  }

  /**
   * Permite al colaborador salir voluntariamente del itinerario grupal.
   *
   * <p>Solicita confirmación nativa antes de enviar {@code DELETE /viajes/{id}/salir}.
   * Tras salir, navega a {@code /itinerarios}. El backend notifica al resto de
   * colaboradores vía WebSocket con el tipo {@code "acceso-revocado"}.
   */
  async function handleSalirDeViaje() {
    if (!confirm('¿Seguro que quieres salir de este itinerario? Perderás el acceso.')) return
    try {
      await api.delete(`/viajes/${id}/salir`)
      navigate('/itinerarios')
    } catch (err) {
      alert(err.response?.data?.message || 'Error al salir del itinerario')
    }
  }

  /**
   * Gestiona los cambios en los metadatos del itinerario (título y fechas) con debounce.
   *
   * <p>Actualiza el estado local inmediatamente para que el input no muestre lag. Valida
   * que si se rellena una fecha se rellene también la otra, y que la fecha de salida no
   * sea posterior a la de llegada. Si la validación pasa, debouncea 800 ms y envía
   * {@code PUT /viajes/{id}} con todos los metadatos del itinerario. Tras guardar notifica
   * el cambio estructural a los colaboradores.
   *
   * <p>El ref {@code metaFocused} evita que el {@code useEffect} que sincroniza
   * {@code tituloEdit} desde {@code viaje} sobreescriba lo que el usuario está escribiendo.
   *
   * @param {string} campo - Campo que cambió: {@code "titulo"}, {@code "fechaSalida"} o {@code "fechaLlegada"}.
   * @param {string} valor - Nuevo valor del campo.
   */
  function handleMetaChange(campo, valor) {
    const nuevoTitulo      = campo === 'titulo'       ? valor : tituloEdit
    const nuevaFechaSalida = campo === 'fechaSalida'  ? valor : fechaSalidaEdit
    const nuevaFechaLleg   = campo === 'fechaLlegada' ? valor : fechaLlegadaEdit
    if (campo === 'titulo')       setTituloEdit(valor)
    if (campo === 'fechaSalida')  setFechaSalidaEdit(valor)
    if (campo === 'fechaLlegada') setFechaLlegadaEdit(valor)

    if ((nuevaFechaSalida && !nuevaFechaLleg) || (!nuevaFechaSalida && nuevaFechaLleg)) {
      setFechasError(nuevaFechaSalida ? 'Añade también la fecha de llegada' : 'Añade también la fecha de salida')
      clearTimeout(debounceMeta.current)
      return
    }
    if (nuevaFechaSalida && nuevaFechaLleg && nuevaFechaSalida > nuevaFechaLleg) {
      setFechasError('La fecha de salida no puede ser posterior a la de llegada')
      clearTimeout(debounceMeta.current)
      return
    }
    setFechasError('')

    clearTimeout(debounceMeta.current)
    debounceMeta.current = setTimeout(async () => {
      try {
        const res = await api.put(`/viajes/${id}`, {
          titulo:        nuevoTitulo,
          fechaSalida:   nuevaFechaSalida,
          fechaLlegada:  nuevaFechaLleg,
          portadaUrl:    viaje.portadaUrl,
          grupal:        viaje.grupal,
          colaboradores: viaje.colaboradores ?? [],
        })
        setViaje(res.data)
        sendCambioEstructura()
      } catch {}
    }, 800)
  }

  /**
   * Abre el modal de gestión de colaboradores y carga la lista actual.
   *
   * <p>Resetea los estados de error/éxito y el campo de email antes de abrir el modal.
   * Carga la lista de colaboradores con info (nombre y email) vía
   * {@code GET /viajes/{id}/colaboradores}.
   */
  async function abrirCompartir() {
    setShowCompartir(true)
    setCompartirError('')
    setCompartirExito('')
    setEmailCompartir('')
    try {
      const res = await api.get(`/viajes/${id}/colaboradores`)
      setColaboradoresInfo(res.data)
    } catch {
      setColaboradoresInfo([])
    }
  }

  /**
   * Añade un colaborador al itinerario por email.
   *
   * <p>Envía {@code POST /viajes/{id}/colaboradores} con el email introducido. Si tiene
   * éxito, recarga tanto el viaje completo como la lista de colaboradores con info, y
   * muestra el mensaje de éxito.
   *
   * @param {React.FormEvent} e - Evento de envío del formulario; se cancela con {@code preventDefault}.
   */
  async function handleAgregarColaborador(e) {
    e.preventDefault()
    setCompartirError('')
    setCompartirExito('')
    setCompartirLoading(true)
    try {
      const res = await api.post(`/viajes/${id}/colaboradores`, { email: emailCompartir })
      setViaje(res.data)
      const info = await api.get(`/viajes/${id}/colaboradores`)
      setColaboradoresInfo(info.data)
      setEmailCompartir('')
      setCompartirExito('Colaborador añadido correctamente')
    } catch (err) {
      setCompartirError(err.response?.data?.message || 'Error al añadir el colaborador')
    } finally {
      setCompartirLoading(false)
    }
  }

  /**
   * Expulsa a un colaborador del itinerario.
   *
   * <p>Envía {@code DELETE /viajes/{id}/colaboradores/{colaboradorId}}. El backend notifica
   * al colaborador expulsado vía WebSocket con {@code "acceso-revocado"}. Actualiza el
   * estado local de ambas listas (viaje y colaboradoresInfo).
   *
   * @param {string} colaboradorId - Identificador del colaborador a expulsar.
   */
  async function handleEliminarColaborador(colaboradorId) {
    try {
      const res = await api.delete(`/viajes/${id}/colaboradores/${colaboradorId}`)
      setViaje(res.data)
      setColaboradoresInfo(prev => prev.filter(c => c.id !== colaboradorId))
    } catch (err) {
      setCompartirError(err.response?.data?.message || 'Error al eliminar el colaborador')
    }
  }

  /**
   * Genera y descarga el itinerario como PDF usando {@code html2canvas} y {@code jsPDF}.
   *
   * <p>Antes de capturar, oculta los elementos con clase {@code no-print},
   * {@code block-controls} y {@code block-insertion-menu}, y desplaza el scroll a cero
   * para capturar el contenido completo. Ambas cosas se restauran en el bloque
   * {@code finally}.
   *
   * <p>Si hay portada, carga la imagen en un {@code HTMLImageElement} y la recorta con
   * Canvas 2D aplicando {@code object-fit: cover}: calcula el escalado mínimo para cubrir
   * el área destino y centra el recorte. Si no hay portada, pinta un rectángulo de color
   * como fondo de portada.
   *
   * <p>Importa {@code html2canvas} y {@code jsPDF} de forma dinámica (lazy) para no
   * incluirlos en el bundle principal.
   */
  async function handleDescargarPDF() {
    setDownloadingPdf(true)
    const noPrint = document.querySelectorAll('.no-print, .block-controls, .block-insertion-menu')
    noPrint.forEach(el => { el.dataset.od = el.style.display; el.style.display = 'none' })
    const scroller = document.querySelector('.main-content')
    const savedScroll = scroller ? scroller.scrollTop : 0
    if (scroller) scroller.scrollTop = 0
    try {
      const { default: html2canvas } = await import('html2canvas')
      const { jsPDF } = await import('jspdf')

      const h2c = el => html2canvas(el, { scale: 2, useCORS: true, allowTaint: true, backgroundColor: '#ffffff', logging: false })

      const pdf = new jsPDF('p', 'mm', 'a4')
      const PAGE_W = pdf.internal.pageSize.getWidth()
      const PAGE_H = pdf.internal.pageSize.getHeight()
      const MARGIN = 12
      const CW = PAGE_W - 2 * MARGIN
      let y = MARGIN

      async function place(el) {
        if (!el || el.offsetHeight === 0) return
        const c = await h2c(el)
        const h = (c.height / c.width) * CW
        if (y + h > PAGE_H - MARGIN) { pdf.addPage(); y = MARGIN }
        pdf.addImage(c.toDataURL('image/jpeg', 0.92), 'JPEG', MARGIN, y, CW, h)
        y += h + 3
      }

      if (viaje.portadaUrl) {
        const img = new Image()
        await new Promise(resolve => { img.onload = resolve; img.src = viaje.portadaUrl })
        const MAX_COVER_H = 72
        const naturalH = (img.naturalHeight / img.naturalWidth) * PAGE_W
        const COVER_H = Math.min(naturalH, MAX_COVER_H)
        const tw = img.naturalWidth
        const th = Math.round(img.naturalWidth * (COVER_H / PAGE_W))
        const scale = Math.max(tw / img.naturalWidth, th / img.naturalHeight)
        const scaledW = img.naturalWidth * scale
        const scaledH = img.naturalHeight * scale
        const offsetX = (tw - scaledW) / 2
        const offsetY = (th - scaledH) / 2
        const cropCanvas = document.createElement('canvas')
        cropCanvas.width = tw
        cropCanvas.height = th
        cropCanvas.getContext('2d').drawImage(img, offsetX, offsetY, scaledW, scaledH)
        pdf.addImage(cropCanvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, PAGE_W, COVER_H)
        y = COVER_H + 10
      } else {
        pdf.setFillColor(224, 231, 255)
        pdf.rect(0, 0, PAGE_W, 35, 'F')
        y = 43
      }

      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(26)
      pdf.setTextColor(17, 24, 39)
      const titleLines = pdf.splitTextToSize(viaje.titulo || 'Sin título', CW)
      pdf.text(titleLines, MARGIN, y)
      y += titleLines.length * 11 + 3

      if (viaje.fechaSalida || viaje.fechaLlegada) {
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(11)
        pdf.setTextColor(100, 116, 139)
        const parts = [viaje.fechaSalida, viaje.fechaLlegada].filter(Boolean).map(formatDate)
        pdf.text(parts.join(' — '), MARGIN, y)
        y += 7
      }

      pdf.setTextColor(0, 0, 0)
      y += 6

      const hasDayMode = computeDays(viaje.fechaSalida, viaje.fechaLlegada).length > 0
      const container = document.getElementById('blocks-container')
      if (container) {
        if (hasDayMode) {
          for (const dayGroup of container.children) {
            if (dayGroup.classList.contains('no-print')) continue
            await place(dayGroup.firstElementChild)
            for (const block of dayGroup.querySelectorAll('.itinerary-block')) {
              await place(block)
            }
            y += 4
          }
        } else {
          for (const block of container.querySelectorAll('.itinerary-block')) {
            await place(block)
          }
        }
      }

      pdf.save(`${viaje.titulo || 'itinerario'}.pdf`)
    } catch {
      alert('Error al generar el PDF')
    } finally {
      noPrint.forEach(el => { el.style.display = el.dataset.od || ''; delete el.dataset.od })
      if (scroller) scroller.scrollTop = savedScroll
      setDownloadingPdf(false)
    }
  }

  /**
   * Procesa la imagen de portada seleccionada por el usuario y la guarda en el itinerario.
   *
   * <p>Rechaza archivos mayores de 2 MB. Lee el archivo como data URL con
   * {@code FileReader} y lo envía en {@code portadaUrl} dentro de {@code PUT /viajes/{id}}.
   * Notifica el cambio estructural a los colaboradores para que actualicen la portada.
   *
   * @param {React.ChangeEvent<HTMLInputElement>} e - Evento de cambio del input de tipo {@code file}.
   */
  async function handleFileChange(e) {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      alert('La imagen no puede superar 2MB')
      e.target.value = ''
      return
    }
    const reader = new FileReader()
    reader.onload = async (ev) => {
      setUploadingCover(true)
      try {
        const res = await api.put(`/viajes/${id}`, {
          titulo: viaje.titulo,
          fechaSalida: viaje.fechaSalida,
          fechaLlegada: viaje.fechaLlegada,
          portadaUrl: ev.target.result,
          grupal: viaje.grupal,
          colaboradores: viaje.colaboradores ?? []
        })
        setViaje(res.data)
        sendCambioEstructura()
      } catch {
        alert('Error al guardar la portada')
      } finally {
        setUploadingCover(false)
        e.target.value = ''
      }
    }
    reader.readAsDataURL(file)
  }

  /**
   * Gestiona el drop de un bloque o favorito en una zona de inserción del itinerario.
   *
   * <p>El {@code dropKey} tiene el formato {@code "{día}-{posición}"}, donde {@code día}
   * es el número de día (1-indexed, o {@code 0} en vista plana) y {@code posición} es el
   * índice de inserción dentro de ese día.
   *
   * <p>Si el item arrastrado es un bloque existente ({@code data.source === 'block'}):
   * <ul>
   *   <li>En vista plana: calcula los nuevos índices y llama PATCH reordenar.
   *   <li>En vista por días: si cambia de día actualiza {@code diaFijado} con PUT bloque
   *       y luego llama PATCH reordenar con el nuevo orden completo.
   * </ul>
   * <p>Si el item proviene del cajón, crea el bloque via POST con {@code diaFijado} si
   * hay vista por días, y luego reordena si la posición de inserción no es la última.
   *
   * @param {React.DragEvent} e - Evento de drop del navegador.
   * @param {string} dropKey - Clave de la zona de inserción destino.
   */
  async function handleDropAtKey(e, dropKey) {
    e.preventDefault()
    setDropTargetKey(null)
    setDraggingBlockId(null)
    const rawData = e.dataTransfer.getData('application/json')
    if (!rawData) return
    try {
      const data = JSON.parse(rawData)
      const bloques = viaje.itinerario ?? []
      const days = computeDays(viaje.fechaSalida, viaje.fechaLlegada)
      const hasDays = days.length > 0
      const [dayStr, posStr] = dropKey.split('-')
      const targetDayNum = parseInt(dayStr)
      const targetPos = parseInt(posStr)

      if (data.source === 'block') {
        const bloqueId = data.bloqueId
        const bloque = bloques.find(b => b.id === bloqueId)
        if (!bloque) return

        if (!hasDays) {
          const currentIds = bloques.map(b => b.id)
          const fromIndex = currentIds.indexOf(bloqueId)
          if (fromIndex === -1) return
          const adjustedTarget = fromIndex < targetPos ? targetPos - 1 : targetPos
          if (fromIndex === adjustedTarget) return
          const newIds = [...currentIds]
          newIds.splice(fromIndex, 1)
          newIds.splice(adjustedTarget, 0, bloqueId)
          const res = await api.patch(`/viajes/${id}/itinerario/reordenar`, newIds)
          setViaje(res.data)
          sendCambioEstructura()
        } else {
          const groups = groupBlocksByDay(bloques, days)
          const currentDayNum = getBlockCurrentDay(bloque, days)
          const crossDay = targetDayNum !== currentDayNum

          const newGroups = groups.map(g => ({ blocks: [...g.blocks] }))
          const srcGroup = newGroups[currentDayNum - 1]
          const srcPos = srcGroup.blocks.findIndex(b => b.id === bloqueId)
          if (srcPos === -1) return

          srcGroup.blocks.splice(srcPos, 1)
          const tgtGroup = newGroups[targetDayNum - 1]
          const adjPos = (!crossDay && srcPos < targetPos) ? targetPos - 1 : targetPos
          if (!crossDay && adjPos === srcPos) return
          tgtGroup.blocks.splice(Math.max(0, Math.min(adjPos, tgtGroup.blocks.length)), 0, bloque)

          const newIds = newGroups.flatMap(g => g.blocks.map(b => b.id))
          if (crossDay) {
            await api.put(`/viajes/${id}/itinerario/bloque/${bloqueId}`, {
              tipo: bloque.tipo,
              contenido: bloque.contenido,
              dato: bloque.dato,
              referenciaId: bloque.referenciaId,
              diaFijado: targetDayNum,
            })
          }
          const res = await api.patch(`/viajes/${id}/itinerario/reordenar`, newIds)
          setViaje(res.data)
          sendCambioEstructura()
        }
      } else {
        const postRes = await api.post(`/viajes/${id}/itinerario/bloque`, {
          tipo: data.tipo,
          contenido: null,
          dato: data.dato ?? {},
          referenciaId: data.referenciaId ?? null,
          fuente: data.fuente ?? null,
          diaFijado: hasDays && targetDayNum > 0 ? targetDayNum : undefined,
        })
        const newViaje = postRes.data
        const allIds = newViaje.itinerario.map(b => b.id)
        const newBlockId = allIds[allIds.length - 1]

        if (hasDays) {
          const newGroups = groupBlocksByDay(newViaje.itinerario, days)
          const dayGroup = newGroups[targetDayNum - 1]
          const curPos = dayGroup.blocks.findIndex(b => b.id === newBlockId)
          const newBlock = newViaje.itinerario.find(b => b.id === newBlockId)
          dayGroup.blocks.splice(curPos, 1)
          dayGroup.blocks.splice(Math.min(targetPos, dayGroup.blocks.length), 0, newBlock)
          const newIds = newGroups.flatMap(g => g.blocks.map(b => b.id))
          if (JSON.stringify(newIds) !== JSON.stringify(allIds)) {
            const res2 = await api.patch(`/viajes/${id}/itinerario/reordenar`, newIds)
            setViaje(res2.data)
          } else {
            setViaje(newViaje)
          }
        } else {
          if (targetPos < allIds.length - 1) {
            const reordenados = allIds.slice(0, -1)
            reordenados.splice(targetPos, 0, newBlockId)
            const res2 = await api.patch(`/viajes/${id}/itinerario/reordenar`, reordenados)
            setViaje(res2.data)
          } else {
            setViaje(newViaje)
          }
        }
        sendCambioEstructura()
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Error al mover el bloque')
    }
  }

  if (aviso) {
    const esEliminado = aviso === 'eliminado'
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '16px', textAlign: 'center', padding: '40px' }}>
        <i className={`ph ${esEliminado ? 'ph-trash' : 'ph-lock-simple'}`} style={{ fontSize: '52px', color: esEliminado ? '#ef4444' : '#f59e0b' }}></i>
        <h2 style={{ fontSize: '22px', fontWeight: 700, margin: 0 }}>
          {esEliminado ? 'Itinerario eliminado' : 'Acceso revocado'}
        </h2>
        <p style={{ color: 'var(--text-secondary)', maxWidth: '360px', margin: 0 }}>
          {esEliminado
            ? 'El creador ha eliminado este itinerario. Ya no está disponible.'
            : 'El propietario te ha retirado el acceso a este itinerario.'}
        </p>
        <button
          onClick={() => navigate('/itinerarios')}
          style={{ marginTop: '8px', padding: '10px 24px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', fontSize: '14px' }}
        >
          Volver a mis itinerarios
        </button>
      </div>
    )
  }

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Cargando viaje...</div>
  if (error)   return <div style={{ padding: '40px', textAlign: 'center', color: '#dc2626' }}>{error}</div>

  const bloques = viaje.itinerario ?? []
  const usuarioId = localStorage.getItem('usuarioId')
  const days = computeDays(viaje.fechaSalida, viaje.fechaLlegada)
  const groups = days.length > 0 ? groupBlocksByDay(bloques, days).map((g, i) => ({ ...g, dayNum: i + 1 })) : null
  const displayGroups = groups && soloConBloques ? groups.filter(g => g.blocks.length > 0) : groups
  const hayDiasVacios = groups ? groups.some(g => g.blocks.length === 0) : false

  function renderBlockDiv(bloque) {
    const commonProps = {
      bloque,
      viajeId: id,
      onDelete: () => deleteBlock(bloque.id),
      onDesvincular: () => desvinculerBloque(bloque.id),
    }
    let blockEl
    switch (bloque.tipo) {
      case 'texto':     blockEl = <TextBlock     {...commonProps} onContentSaved={handleContentSaved} ydoc={ydoc} />; break
      case 'vuelo':     blockEl = <FlightBlock   {...commonProps} onContentSaved={handleContentSaved} />; break
      case 'hotel':     blockEl = <HotelBlock    {...commonProps} onContentSaved={handleContentSaved} />; break
      case 'actividad': blockEl = <ActivityBlock {...commonProps} onContentSaved={handleContentSaved} />; break
      case 'lugar':     blockEl = <RouteBlock    {...commonProps} onContentSaved={handleContentSaved} />; break
      default:          blockEl = null
    }
    return (
      <div
        draggable
        onPointerDown={e => { canDrag.current = !!e.target.closest('.drag-handle') }}
        onDragStart={e => {
          if (!canDrag.current) { e.preventDefault(); return }
          canDrag.current = false
          setDraggingBlockId(bloque.id)
          e.dataTransfer.setData('application/json', JSON.stringify({ source: 'block', bloqueId: bloque.id }))
        }}
        onDragEnd={() => { setDraggingBlockId(null); setDropTargetKey(null) }}
        style={{ opacity: draggingBlockId === bloque.id ? 0.4 : 1 }}
      >
        {blockEl}
      </div>
    )
  }

  return (
    <div className="itinerary-view">
      <div className="cover-image-container">
        {viaje.portadaUrl
          ? <img src={viaje.portadaUrl} alt="portada" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <div className="placeholder-cover"></div>
        }
        <input
          ref={coverInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
        <button className="btn-change-cover" onClick={() => coverInputRef.current.click()} disabled={uploadingCover}>
          <i className="ph ph-image"></i> {uploadingCover ? 'Guardando...' : 'Cambiar portada'}
        </button>
        <button
          className="btn-change-cover"
          style={{ right: 'auto', left: '16px' }}
          onClick={handleDescargarPDF}
          disabled={downloadingPdf}
        >
          <i className="ph ph-download-simple"></i> {downloadingPdf ? 'Generando...' : 'Descargar PDF'}
        </button>
      </div>

      <div className="editor-document">
        <div className="itinerary-layout" style={{ display: 'flex', gap: '30px', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <div
              className="trip-header-meta"
              onFocus={() => { metaFocused.current = true }}
              onBlur={() => { metaFocused.current = false }}
            >
              <input
                className="trip-title"
                value={tituloEdit}
                onChange={e => handleMetaChange('titulo', e.target.value)}
                placeholder="Título del viaje..."
                style={{ border: 'none', outline: 'none', background: 'transparent', width: '100%', fontFamily: 'inherit', padding: 0, display: 'block' }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: fechasError ? '6px' : '20px', fontSize: '16px', color: 'var(--text-secondary)' }}>
                <input
                  type="date"
                  value={fechaSalidaEdit}
                  onChange={e => handleMetaChange('fechaSalida', e.target.value)}
                  style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: '16px', color: 'var(--text-secondary)', fontFamily: 'inherit', cursor: 'pointer' }}
                />
                <span>—</span>
                <input
                  type="date"
                  value={fechaLlegadaEdit}
                  onChange={e => handleMetaChange('fechaLlegada', e.target.value)}
                  style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: '16px', color: 'var(--text-secondary)', fontFamily: 'inherit', cursor: 'pointer' }}
                />
              </div>
              {fechasError && (
                <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#dc2626' }}>{fechasError}</p>
              )}
            </div>

            {viaje.grupal && (
              <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '40px', paddingBottom: '20px', borderBottom: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {usuariosActivos.map(uid => (
                      <div
                        key={uid}
                        title={uid === usuarioId ? 'Tú' : 'Colaborador'}
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          background: colorParaId(uid),
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white',
                          fontSize: '11px',
                          fontWeight: '700',
                          border: '2px solid white',
                          cursor: 'default',
                          flexShrink: 0,
                        }}
                      >
                        {uid.slice(-2).toUpperCase()}
                      </div>
                    ))}
                    <span className="collab-status">
                      {connected
                        ? <><span className="pulse-dot"></span> Sincronizado</>
                        : <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Conectando...</span>
                      }
                    </span>
                    {viaje.propietarioId !== usuarioId && viaje.participantes && (
                      <div className="no-print" style={{ position: 'relative' }}>
                        <button
                          onClick={() => setShowParticipantes(p => !p)}
                          style={{ background: 'transparent', border: '1px solid var(--border-color)', padding: '6px 12px', borderRadius: '6px', fontWeight: '500', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
                        >
                          <i className="ph ph-users-three"></i>
                          Participantes · {viaje.participantes.length}
                          <i className={`ph ph-caret-${showParticipantes ? 'up' : 'down'}`}></i>
                        </button>
                        {showParticipantes && (
                          <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, background: 'white', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px 12px', zIndex: 10, minWidth: '220px', display: 'flex', flexDirection: 'column', gap: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
                            {viaje.participantes.map(p => (
                              <span key={p.email} style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <i className="ph ph-user" style={{ flexShrink: 0 }}></i>
                                <span style={{ fontWeight: '500', color: 'var(--text-primary)' }}>{p.nombre}</span>
                                <span>·</span>
                                <span>{p.email}</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="no-print" style={{ display: 'flex', gap: '8px' }}>
                    {viaje.propietarioId === usuarioId && (
                      <button
                        onClick={abrirCompartir}
                        style={{ background: 'transparent', border: '1px solid var(--border-color)', padding: '8px 12px', borderRadius: '6px', fontWeight: '500', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        <i className="ph ph-share-network"></i> Compartir
                      </button>
                    )}
                  </div>
                </div>
                {viaje.propietarioId === usuarioId && viaje.participantes && (
                  <div className="no-print" style={{ marginTop: '12px' }}>
                    <button
                      onClick={() => setShowParticipantes(p => !p)}
                      style={{ background: 'transparent', border: '1px solid var(--border-color)', padding: '6px 12px', borderRadius: '6px', fontWeight: '500', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
                    >
                      <i className="ph ph-users-three"></i>
                      Participantes · {viaje.participantes.length}
                      <i className={`ph ph-caret-${showParticipantes ? 'up' : 'down'}`}></i>
                    </button>
                    {showParticipantes && (
                      <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {viaje.participantes.map(p => (
                          <span key={p.email} style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <i className="ph ph-user" style={{ flexShrink: 0 }}></i>
                            <span style={{ fontWeight: '500', color: 'var(--text-primary)' }}>{p.nombre}</span>
                            <span>·</span>
                            <span>{p.email}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            <div
              id="blocks-container"
              style={{ minHeight: '80px' }}
              onDragLeave={e => {
                if (!e.currentTarget.contains(e.relatedTarget)) setDropTargetKey(null)
              }}
            >
              {displayGroups ? (
                <>
                  {hayDiasVacios && (
                    <div className="no-print" style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
                      <button
                        onClick={() => setSoloConBloques(v => !v)}
                        style={{ background: 'none', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '4px 10px', fontSize: '12px', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        <i className={`ph ${soloConBloques ? 'ph-arrows-out' : 'ph-arrows-in'}`}></i>
                        {soloConBloques ? 'Mostrar todos los días' : 'Ocultar días vacíos'}
                      </button>
                    </div>
                  )}
                  {displayGroups.map((group) => {
                    const { dayNum, date, blocks: dayBlocks } = group
                    return (
                      <div key={date} style={{ marginBottom: '24px' }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '10px 0 8px',
                          borderBottom: '1px solid var(--border-color)',
                          marginBottom: '4px',
                        }}>
                          <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                            Día {dayNum}
                          </span>
                          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                            {formatDate(date)}
                          </span>
                        </div>
                        <DropZone dropKey={`${dayNum}-0`} activeDropKey={dropTargetKey} onDragOver={setDropTargetKey} onDrop={handleDropAtKey} />
                        {dayBlocks.map((bloque, i) => (
                          <Fragment key={bloque.id}>
                            {renderBlockDiv(bloque)}
                            <DropZone dropKey={`${dayNum}-${i + 1}`} activeDropKey={dropTargetKey} onDragOver={setDropTargetKey} onDrop={handleDropAtKey} />
                          </Fragment>
                        ))}
                      </div>
                    )
                  })}
                </>
              ) : (
                bloques.length === 0 ? (
                  <>
                    <DropZone dropKey="0-0" activeDropKey={dropTargetKey} onDragOver={setDropTargetKey} onDrop={handleDropAtKey} />
                    <p style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>El itinerario está vacío. Añade un bloque o arrastra un favorito aquí.</p>
                  </>
                ) : (
                  <>
                    {bloques.map((bloque, i) => (
                      <Fragment key={bloque.id}>
                        <DropZone dropKey={`0-${i}`} activeDropKey={dropTargetKey} onDragOver={setDropTargetKey} onDrop={handleDropAtKey} />
                        {renderBlockDiv(bloque)}
                      </Fragment>
                    ))}
                    <DropZone dropKey={`0-${bloques.length}`} activeDropKey={dropTargetKey} onDragOver={setDropTargetKey} onDrop={handleDropAtKey} />
                  </>
                )
              )}
            </div>

            <div className="block-insertion-menu">
              <span className="insertion-label">Añadir bloque:</span>
              <button className="btn-insert-block" onClick={() => addBlock('texto')}>
                <i className="ph ph-text-t"></i> Texto
              </button>
              <button className="btn-insert-block" onClick={() => addBlock('vuelo')}>
                <i className="ph ph-airplane-tilt"></i> Vuelo
              </button>
              <button className="btn-insert-block" onClick={() => addBlock('hotel')}>
                <i className="ph ph-buildings"></i> Hotel
              </button>
              <button className="btn-insert-block" onClick={() => addBlock('actividad')}>
                <i className="ph ph-ticket"></i> Actividad
              </button>
              <button className="btn-insert-block" onClick={() => addBlock('lugar')}>
                <i className="ph ph-map-pin-line"></i> Lugar/Ruta
              </button>
            </div>
          </div>

          <div className="no-print itinerary-right-col">
            <PresupuestoPanel bloques={bloques} extras={viaje?.gastosExtra || []} onExtrasChange={handleGastosExtraChange} />
            <Cajon onAdd={addBlockFromCajon} onFavChange={recargarViaje} onEstructuraCambiada={sendCambioEstructura} />
          </div>
        </div>
      </div>

      {showCompartir && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowCompartir(false)}>
          <div className="modal-box">
            <button className="modal-close" onClick={() => setShowCompartir(false)}>
              <i className="ph ph-x"></i>
            </button>
            <h3 className="modal-title"><i className="ph ph-share-network" style={{ marginRight: '8px' }}></i>Compartir itinerario</h3>

            {colaboradoresInfo.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <p style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '8px' }}>Colaboradores</p>
                {colaboradoresInfo.map(c => (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '6px' }}>
                    <div>
                      <p style={{ margin: 0, fontWeight: '500', fontSize: '14px' }}>{c.nombre}</p>
                      <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>{c.email}</p>
                    </div>
                    {viaje.propietarioId === usuarioId && (
                      <button
                        onClick={() => handleEliminarColaborador(c.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: '4px' }}
                      >
                        <i className="ph ph-trash"></i>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {viaje.propietarioId === usuarioId && (
              <form onSubmit={handleAgregarColaborador}>
                <div className="input-group">
                  <label>Añadir por email</label>
                  <input
                    type="email"
                    placeholder="email@ejemplo.com"
                    value={emailCompartir}
                    onChange={e => setEmailCompartir(e.target.value)}
                    required
                  />
                </div>
                {compartirError && <p className="login-error" style={{ marginBottom: '10px' }}>{compartirError}</p>}
                {compartirExito && <p className="login-success" style={{ marginBottom: '10px' }}>{compartirExito}</p>}
                <button type="submit" className="modal-cta" disabled={compartirLoading}>
                  {compartirLoading ? 'Añadiendo...' : <><i className="ph ph-plus"></i> Añadir colaborador</>}
                </button>
              </form>
            )}

            {viaje.propietarioId !== usuarioId && (
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px' }}>Solo el propietario puede añadir o eliminar colaboradores.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
