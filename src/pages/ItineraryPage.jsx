import { useState, useEffect, useCallback, useMemo, Fragment, useRef } from 'react'
import { useParams } from 'react-router-dom'
import * as Y from 'yjs'
import api from '../api/axiosConfig'
import TextBlock from '../components/blocks/TextBlock'
import FlightBlock from '../components/blocks/FlightBlock'
import HotelBlock from '../components/blocks/HotelBlock'
import RouteBlock from '../components/blocks/RouteBlock'
import ActivityBlock from '../components/blocks/ActivityBlock'
import Cajon from '../components/Cajon'
import useItinerarioSocket, { uint8ToBase64, base64ToUint8 } from '../hooks/useItinerarioSocket'

const AVATAR_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899']
function colorParaId(id) {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (id.charCodeAt(i) + hash * 31) | 0
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function DropZone({ index, activeIndex, onDragOver, onDrop }) {
  const isActive = activeIndex === index
  return (
    <div
      onDragOver={e => { e.preventDefault(); onDragOver(index) }}
      onDrop={e => onDrop(e, index)}
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

  const [viaje, setViaje] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [dropTargetIndex, setDropTargetIndex] = useState(null)
  const [draggingBlockId, setDraggingBlockId] = useState(null)
  const canDrag = useRef(false)

  const ydoc = useMemo(() => new Y.Doc(), [id])

  const handleWsUpdate = useCallback(
    (base64) => {
      Y.applyUpdate(ydoc, base64ToUint8(base64), 'remote')
    },
    [ydoc]
  )

  const { connected, usuariosActivos, sendUpdate } = useItinerarioSocket(id, handleWsUpdate)

  useEffect(() => {
    const handler = (update, origin) => {
      if (origin !== 'remote') {
        sendUpdate(uint8ToBase64(update))
      }
    }
    ydoc.on('update', handler)
    return () => ydoc.off('update', handler)
  }, [ydoc, sendUpdate])

  const recargarViaje = useCallback(() => {
    api.get(`/viajes/${id}`)
      .then(res => setViaje(res.data))
      .catch(() => {})
  }, [id])

  useEffect(() => {
    api.get(`/viajes/${id}`)
      .then(res => {
        setViaje(res.data)
        setLoading(false)
      })
      .catch(err => {
        setError(err.response?.data?.message || 'No se pudo cargar el viaje')
        setLoading(false)
      })
  }, [id])

  async function addBlockFromCajon(fav) {
    try {
      const res = await api.post(`/viajes/${id}/itinerario/bloque`, {
        tipo: fav.tipo,
        contenido: null,
        dato: fav.dato ?? {},
        referenciaId: fav.referenciaId ?? null,
      })
      setViaje(res.data)
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
    } catch (err) {
      alert(err.response?.data?.message || 'Error al añadir el bloque')
    }
  }

  async function deleteBlock(bloqueId) {
    try {
      const res = await api.delete(`/viajes/${id}/itinerario/bloque/${bloqueId}`)
      setViaje(res.data)
    } catch (err) {
      alert(err.response?.data?.message || 'Error al eliminar el bloque')
    }
  }

  async function desvinculerBloque(bloqueId) {
    try {
      const res = await api.patch(`/viajes/${id}/itinerario/bloque/${bloqueId}/desvincular`)
      setViaje(res.data)
    } catch (err) {
      alert(err.response?.data?.message || 'Error al desvincular el bloque')
    }
  }

  async function handleDropAtIndex(e, targetIndex) {
    e.preventDefault()
    setDropTargetIndex(null)
    setDraggingBlockId(null)
    const rawData = e.dataTransfer.getData('application/json')
    if (!rawData) return
    try {
      const data = JSON.parse(rawData)
      const bloques = viaje.itinerario ?? []

      if (data.source === 'block') {
        const currentIds = bloques.map(b => b.id)
        const fromIndex = currentIds.indexOf(data.bloqueId)
        if (fromIndex === -1) return
        const adjustedTarget = fromIndex < targetIndex ? targetIndex - 1 : targetIndex
        if (fromIndex === adjustedTarget) return
        const newIds = [...currentIds]
        newIds.splice(fromIndex, 1)
        newIds.splice(adjustedTarget, 0, data.bloqueId)
        const res = await api.patch(`/viajes/${id}/itinerario/reordenar`, newIds)
        setViaje(res.data)
      } else {
        const res = await api.post(`/viajes/${id}/itinerario/bloque`, {
          tipo: data.tipo,
          contenido: null,
          dato: data.dato ?? {},
          referenciaId: data.referenciaId ?? null,
        })
        const nuevosIds = res.data.itinerario.map(b => b.id)
        if (targetIndex < nuevosIds.length - 1) {
          const nuevoId = nuevosIds[nuevosIds.length - 1]
          const reordenados = nuevosIds.slice(0, -1)
          reordenados.splice(targetIndex, 0, nuevoId)
          const res2 = await api.patch(`/viajes/${id}/itinerario/reordenar`, reordenados)
          setViaje(res2.data)
        } else {
          setViaje(res.data)
        }
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Error al mover el bloque')
    }
  }

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Cargando viaje...</div>
  if (error)   return <div style={{ padding: '40px', textAlign: 'center', color: '#dc2626' }}>{error}</div>

  const bloques = viaje.itinerario ?? []
  const usuarioId = localStorage.getItem('usuarioId')

  return (
    <div className="itinerary-view">
      <div className="cover-image-container">
        {viaje.portadaUrl
          ? <img src={viaje.portadaUrl} alt="portada" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <div className="placeholder-cover"></div>
        }
        <button className="btn-change-cover">
          <i className="ph ph-image"></i> Cambiar portada
        </button>
      </div>

      <div className="editor-document">
        <div className="trip-header-meta">
          <h1 className="trip-title">{viaje.titulo}</h1>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '20px', fontSize: '16px' }}>
            {viaje.fechaSalida && viaje.fechaLlegada
              ? `${viaje.fechaSalida} — ${viaje.fechaLlegada}`
              : ''}
          </p>
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

            <button style={{ background: 'transparent', border: '1px solid var(--border-color)', padding: '8px 12px', borderRadius: '6px', fontWeight: '500', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <i className="ph ph-share-network"></i> Compartir
            </button>
          </div>
        )}

        <div style={{ display: 'flex', gap: '30px', alignItems: 'flex-start', marginTop: '30px' }}>
          <div style={{ flex: 1 }}>
            <div
              id="blocks-container"
              style={{ minHeight: '80px' }}
              onDragLeave={e => {
                if (!e.currentTarget.contains(e.relatedTarget)) setDropTargetIndex(null)
              }}
            >
              {bloques.length === 0 ? (
                <>
                  <DropZone index={0} activeIndex={dropTargetIndex} onDragOver={setDropTargetIndex} onDrop={handleDropAtIndex} />
                  <p style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>El itinerario está vacío. Añade un bloque o arrastra un favorito aquí.</p>
                </>
              ) : (
                <>
                  {bloques.map((bloque, i) => {
                    const commonProps = {
                      bloque,
                      viajeId: id,
                      onDelete: () => deleteBlock(bloque.id),
                      onDesvincular: () => desvinculerBloque(bloque.id),
                    }
                    let blockEl
                    switch (bloque.tipo) {
                      case 'texto':     blockEl = <TextBlock    {...commonProps} ydoc={ydoc} />; break
                      case 'vuelo':     blockEl = <FlightBlock  {...commonProps} />; break
                      case 'hotel':     blockEl = <HotelBlock   {...commonProps} />; break
                      case 'actividad': blockEl = <ActivityBlock {...commonProps} />; break
                      case 'lugar':     blockEl = <RouteBlock   {...commonProps} />; break
                      default:          blockEl = null
                    }
                    return (
                      <Fragment key={bloque.id}>
                        <DropZone index={i} activeIndex={dropTargetIndex} onDragOver={setDropTargetIndex} onDrop={handleDropAtIndex} />
                        <div
                          draggable
                          onPointerDown={e => { canDrag.current = !!e.target.closest('.drag-handle') }}
                          onDragStart={e => {
                            if (!canDrag.current) { e.preventDefault(); return }
                            canDrag.current = false
                            setDraggingBlockId(bloque.id)
                            e.dataTransfer.setData('application/json', JSON.stringify({ source: 'block', bloqueId: bloque.id }))
                          }}
                          onDragEnd={() => { setDraggingBlockId(null); setDropTargetIndex(null) }}
                          style={{ opacity: draggingBlockId === bloque.id ? 0.4 : 1 }}
                        >
                          {blockEl}
                        </div>
                      </Fragment>
                    )
                  })}
                  <DropZone index={bloques.length} activeIndex={dropTargetIndex} onDragOver={setDropTargetIndex} onDrop={handleDropAtIndex} />
                </>
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

          <Cajon onAdd={addBlockFromCajon} onFavChange={recargarViaje} />
        </div>
      </div>
    </div>
  )
}
