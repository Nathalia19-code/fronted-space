import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import * as Y from 'yjs'
import api from '../api/axiosConfig'
import TextBlock from '../components/blocks/TextBlock'
import FlightBlock from '../components/blocks/FlightBlock'
import HotelBlock from '../components/blocks/HotelBlock'
import RouteBlock from '../components/blocks/RouteBlock'
import Cajon from '../components/Cajon'
import useItinerarioSocket, { uint8ToBase64, base64ToUint8 } from '../hooks/useItinerarioSocket'

// Colores para los avatares de colaboradores
const AVATAR_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899']
function colorParaId(id) {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (id.charCodeAt(i) + hash * 31) | 0
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

export default function ItineraryPage() {
  const { id } = useParams()

  const [viaje, setViaje] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Un Y.Doc por viaje — es el documento compartido de Yjs
  // useMemo garantiza que el mismo Y.Doc se reutilice mientras el id no cambie
  const ydoc = useMemo(() => new Y.Doc(), [id])

  // Cuando llega un update de otro colaborador, se aplica al Y.Doc local
  // El origen 'remote' evita que el listener de abajo lo reenvíe otra vez
  const handleWsUpdate = useCallback(
    (base64) => {
      Y.applyUpdate(ydoc, base64ToUint8(base64), 'remote')
    },
    [ydoc]
  )

  const { connected, usuariosActivos, sendUpdate } = useItinerarioSocket(id, handleWsUpdate)

  // Cada vez que el Y.Doc cambia (por escritura local), se envía por WebSocket
  // Si el cambio viene de 'remote' (otro colaborador), se ignora para no hacer eco
  useEffect(() => {
    const handler = (update, origin) => {
      if (origin !== 'remote') {
        sendUpdate(uint8ToBase64(update))
      }
    }
    ydoc.on('update', handler)
    return () => ydoc.off('update', handler)
  }, [ydoc, sendUpdate])

  // Carga inicial del viaje desde MongoDB
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

  async function handleDrop(e) {
    e.preventDefault()
    try {
      const fav = JSON.parse(e.dataTransfer.getData('application/json'))
      const res = await api.post(`/viajes/${id}/itinerario/bloque`, {
        tipo: fav.tipo,
        contenido: null,
        dato: fav.datos ?? {},
      })
      setViaje(res.data)
    } catch (err) {
      alert(err.response?.data?.message || 'Error al añadir el favorito')
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

  function renderBlock(bloque) {
    const props = {
      key: bloque.id,
      bloque,
      viajeId: id,
      onDelete: () => deleteBlock(bloque.id),
    }
    switch (bloque.tipo) {
      case 'texto':  return <TextBlock   {...props} ydoc={ydoc} />
      case 'vuelo':  return <FlightBlock {...props} />
      case 'hotel':  return <HotelBlock  {...props} />
      case 'lugar':  return <RouteBlock  {...props} />
      default:       return null
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
              : viaje.destino}
          </p>
        </div>

        {viaje.grupal && (
          <div className="collaborators-bar">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {/* Avatar de cada usuario activo */}
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

              {/* Indicador de conexión */}
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
              onDragOver={e => e.preventDefault()}
              onDrop={handleDrop}
              style={{ minHeight: '80px' }}
            >
              {bloques.length === 0
                ? <p style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>El itinerario está vacío. Añade un bloque o arrastra un favorito aquí.</p>
                : bloques.map(bloque => renderBlock(bloque))
              }
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
              <button className="btn-insert-block" onClick={() => addBlock('lugar')}>
                <i className="ph ph-map-pin-line"></i> Lugar/Ruta
              </button>
            </div>
          </div>

          <Cajon />
        </div>
      </div>
    </div>
  )
}
