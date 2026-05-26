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
function colorParaId(id) {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (id.charCodeAt(i) + hash * 31) | 0
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

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

function getBlockCurrentDay(bloque, days) {
  if (bloque.diaFijado != null) return Math.min(bloque.diaFijado, days.length)
  const blockDate = getBlockDate(bloque)
  const dayIdx = blockDate ? days.indexOf(blockDate) : -1
  return dayIdx >= 0 ? dayIdx + 1 : days.length
}

function formatDate(dateStr) {
  const [year, month, day] = dateStr.split('-')
  return `${day}/${month}/${year}`
}

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
  const [colaboradoresInfo, setColaboradoresInfo] = useState([])
  const [emailCompartir, setEmailCompartir] = useState('')
  const [compartirLoading, setCompartirLoading] = useState(false)
  const [compartirError, setCompartirError] = useState('')
  const [compartirExito, setCompartirExito] = useState('')

  const ydoc = useMemo(() => new Y.Doc(), [id])

  const handleWsUpdate = useCallback(
    (base64) => {
      Y.applyUpdate(ydoc, base64ToUint8(base64), 'remote')
    },
    [ydoc]
  )

  const recargarViaje = useCallback(() => {
    api.get(`/viajes/${id}`)
      .then(res => setViaje(res.data))
      .catch(err => {
        const status = err.response?.status
        if (status === 404) setAviso('eliminado')
        else if (status === 400 || status === 403) setAviso('acceso-revocado')
      })
  }, [id])

  function handleContentSaved() {
    recargarViaje()
    sendCambioEstructura()
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

  async function addBlockFromCajon(fav) {
    try {
      const res = await api.post(`/viajes/${id}/itinerario/bloque`, {
        tipo: fav.tipo,
        contenido: null,
        dato: fav.dato ?? {},
        referenciaId: fav.referenciaId ?? null,
      })
      setViaje(res.data)
      sendCambioEstructura()
    } catch (err) {
      alert(err.response?.data?.message || 'Error al añadir el bloque')
    }
  }

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

  async function deleteBlock(bloqueId) {
    try {
      const res = await api.delete(`/viajes/${id}/itinerario/bloque/${bloqueId}`)
      setViaje(res.data)
      sendCambioEstructura()
    } catch (err) {
      alert(err.response?.data?.message || 'Error al eliminar el bloque')
    }
  }

  async function desvinculerBloque(bloqueId) {
    try {
      const res = await api.patch(`/viajes/${id}/itinerario/bloque/${bloqueId}/desvincular`)
      setViaje(res.data)
      sendCambioEstructura()
    } catch (err) {
      alert(err.response?.data?.message || 'Error al desvincular el bloque')
    }
  }

  async function handleSalirDeViaje() {
    if (!confirm('¿Seguro que quieres salir de este itinerario? Perderás el acceso.')) return
    try {
      await api.delete(`/viajes/${id}/salir`)
      navigate('/itinerarios')
    } catch (err) {
      alert(err.response?.data?.message || 'Error al salir del itinerario')
    }
  }

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

  async function handleEliminarColaborador(colaboradorId) {
    try {
      const res = await api.delete(`/viajes/${id}/colaboradores/${colaboradorId}`)
      setViaje(res.data)
      setColaboradoresInfo(prev => prev.filter(c => c.id !== colaboradorId))
    } catch (err) {
      setCompartirError(err.response?.data?.message || 'Error al eliminar el colaborador')
    }
  }

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
              <div className="collaborators-bar">
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
                </div>

                <div className="no-print" style={{ display: 'flex', gap: '8px' }}>
                  {viaje.propietarioId === usuarioId ? (
                    <button
                      onClick={abrirCompartir}
                      style={{ background: 'transparent', border: '1px solid var(--border-color)', padding: '8px 12px', borderRadius: '6px', fontWeight: '500', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <i className="ph ph-share-network"></i> Compartir
                    </button>
                  ) : (
                    <button
                      onClick={handleSalirDeViaje}
                      style={{ background: 'transparent', border: '1px solid #fca5a5', padding: '8px 12px', borderRadius: '6px', fontWeight: '500', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', color: '#ef4444' }}
                    >
                      <i className="ph ph-sign-out"></i> Salir del itinerario
                    </button>
                  )}
                </div>
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
            <PresupuestoPanel bloques={bloques} viajeId={id} />
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
