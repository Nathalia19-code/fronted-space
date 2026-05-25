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
  const navigate = useNavigate()

  const [viaje, setViaje] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [aviso, setAviso] = useState(null)
  const [dropTargetIndex, setDropTargetIndex] = useState(null)
  const [draggingBlockId, setDraggingBlockId] = useState(null)
  const canDrag = useRef(false)
  const coverInputRef = useRef(null)
  const [uploadingCover, setUploadingCover] = useState(false)
  const [tituloEdit, setTituloEdit] = useState('')
  const [fechaSalidaEdit, setFechaSalidaEdit] = useState('')
  const [fechaLlegadaEdit, setFechaLlegadaEdit] = useState('')
  const metaFocused = useRef(false)
  const debounceMeta = useRef(null)
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
    clearTimeout(debounceMeta.current)
    debounceMeta.current = setTimeout(async () => {
      try {
        const res = await api.put(`/viajes/${id}`, {
          titulo:       nuevoTitulo,
          fechaSalida:  nuevaFechaSalida,
          fechaLlegada: nuevaFechaLleg,
          portadaUrl:   viaje.portadaUrl,
          grupal:       viaje.grupal,
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
        sendCambioEstructura()
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
          sendCambioEstructura()
        } else {
          setViaje(res.data)
        }
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
      </div>

      <div className="editor-document">
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '20px', fontSize: '16px', color: 'var(--text-secondary)' }}>
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

            <div style={{ display: 'flex', gap: '8px' }}>
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
                      case 'texto':     blockEl = <TextBlock    {...commonProps} onContentSaved={sendCambioEstructura} ydoc={ydoc} />; break
                      case 'vuelo':     blockEl = <FlightBlock  {...commonProps} onContentSaved={sendCambioEstructura} />; break
                      case 'hotel':     blockEl = <HotelBlock   {...commonProps} onContentSaved={sendCambioEstructura} />; break
                      case 'actividad': blockEl = <ActivityBlock {...commonProps} onContentSaved={sendCambioEstructura} />; break
                      case 'lugar':     blockEl = <RouteBlock   {...commonProps} onContentSaved={sendCambioEstructura} />; break
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

          <Cajon onAdd={addBlockFromCajon} onFavChange={recargarViaje} onEstructuraCambiada={sendCambioEstructura} />
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
