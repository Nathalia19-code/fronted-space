import { useEffect, useRef, useState, useCallback } from 'react'
import { Client } from '@stomp/stompjs'
import SockJS from 'sockjs-client'

// Yjs updates son Uint8Array. STOMP solo habla texto, así que se codifica en base64.
export function uint8ToBase64(uint8) {
  const CHUNK = 8192
  const chunks = []
  for (let i = 0; i < uint8.length; i += CHUNK) {
    chunks.push(String.fromCharCode(...uint8.subarray(i, i + CHUNK)))
  }
  return btoa(chunks.join(''))
}

export function base64ToUint8(base64) {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export default function useItinerarioSocket(viajeId, onUpdate) {
  const [connected, setConnected] = useState(false)
  const [usuariosActivos, setUsuariosActivos] = useState([])
  const clientRef = useRef(null)

  // Ref para evitar que el efecto se re-ejecute cuando cambia el callback
  const onUpdateRef = useRef(onUpdate)
  useEffect(() => { onUpdateRef.current = onUpdate }, [onUpdate])

  useEffect(() => {
    if (!viajeId) return

    const token = localStorage.getItem('token')
    const usuarioId = localStorage.getItem('usuarioId')

    const client = new Client({
      webSocketFactory: () => new SockJS('http://localhost:8080/ws'),
      connectHeaders: { Authorization: `Bearer ${token}` },
      reconnectDelay: 5000,

      onConnect: () => {
        setConnected(true)

        // Recibir cambios del editor de otros colaboradores
        client.subscribe(`/topic/viaje/${viajeId}`, (message) => {
          const msg = JSON.parse(message.body)
          // Ignorar mensajes propios para no aplicar el cambio dos veces
          if (msg.origen !== usuarioId && msg.update) {
            onUpdateRef.current?.(msg.update)
          }
        })

        // Recibir lista de usuarios activos (presencia)
        client.subscribe(`/topic/viaje/${viajeId}/presencia`, (message) => {
          const msg = JSON.parse(message.body)
          setUsuariosActivos(msg.usuariosActivos ?? [])
        })

        // Registrar presencia al entrar al editor
        client.publish({
          destination: `/app/viaje/${viajeId}/unirse`,
          body: '{}',
        })
      },

      onDisconnect: () => setConnected(false),
      onStompError: () => setConnected(false),
    })

    client.activate()
    clientRef.current = client

    return () => {
      client.deactivate()
      clientRef.current = null
    }
  }, [viajeId])

  const sendUpdate = useCallback(
    (base64) => {
      if (clientRef.current?.connected) {
        clientRef.current.publish({
          destination: `/app/viaje/${viajeId}/update`,
          body: JSON.stringify({ update: base64 }),
        })
      }
    },
    [viajeId]
  )

  return { connected, usuariosActivos, sendUpdate }
}
