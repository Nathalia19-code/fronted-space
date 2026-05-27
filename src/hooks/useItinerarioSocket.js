import { useEffect, useRef, useState, useCallback } from 'react'
import { Client } from '@stomp/stompjs'
import SockJS from 'sockjs-client'

/**
 * Convierte un {@code Uint8Array} a una cadena base64.
 *
 * <p>Yjs serializa sus updates como {@code Uint8Array}. STOMP solo transmite texto,
 * por lo que es necesario codificar el binario antes de publicarlo. Se procesa en
 * bloques de 8192 bytes para evitar desbordamientos de pila con arrays grandes en
 * {@code String.fromCharCode}.
 *
 * @param {Uint8Array} uint8 - Array binario a codificar.
 * @returns {string} Cadena base64 equivalente.
 */
export function uint8ToBase64(uint8) {
  const CHUNK = 8192
  const chunks = []
  for (let i = 0; i < uint8.length; i += CHUNK) {
    chunks.push(String.fromCharCode(...uint8.subarray(i, i + CHUNK)))
  }
  return btoa(chunks.join(''))
}

/**
 * Convierte una cadena base64 a un {@code Uint8Array}.
 *
 * <p>Operación inversa de {@link uint8ToBase64}. Se usa para reconstruir el
 * {@code Uint8Array} del update de Yjs a partir del mensaje STOMP recibido, antes
 * de pasarlo a {@code Y.applyUpdate}.
 *
 * @param {string} base64 - Cadena base64 a decodificar.
 * @returns {Uint8Array} Array binario equivalente.
 */
export function base64ToUint8(base64) {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/**
 * Hook que gestiona la conexión STOMP/SockJS del editor colaborativo de itinerarios.
 *
 * <p>Establece una conexión WebSocket autenticada (JWT en {@code connectHeaders}) y abre
 * tres suscripciones para el itinerario indicado:
 * <ul>
 *   <li>{@code /topic/viaje/{id}} — updates Yjs de otros colaboradores. Ignora mensajes
 *       cuyo {@code origen} coincida con el {@code usuarioId} propio para no aplicar
 *       el cambio dos veces.
 *   <li>{@code /topic/viaje/{id}/presencia} — lista actualizada de {@code usuariosActivos}
 *       cada vez que alguien entra o sale del editor.
 *   <li>{@code /topic/viaje/{id}/estructura} — eventos de cambio estructural:
 *       {@code "eliminado"} (si otro usuario borró el itinerario), {@code "acceso-revocado"}
 *       (si el usuario actual fue expulsado o salió voluntariamente) y cualquier cambio
 *       sin {@code accion} (bloque añadido/borrado/reordenado por otro colaborador).
 * </ul>
 *
 * <p>Al conectar publica en {@code /app/viaje/{id}/unirse} para registrar presencia.
 *
 * <p>Todos los callbacks ({@code onUpdate}, {@code onRecargar}, {@code onEliminado},
 * {@code onAccesoRevocado}) se almacenan en refs para evitar reconexiones cuando sus
 * referencias cambian entre renders.
 *
 * @param {string} viajeId - ID del itinerario al que conectarse.
 * @param {Function} onUpdate - Recibe el update Yjs en base64 cuando otro colaborador edita.
 * @param {Function} onRecargar - Invocado al recibir un cambio estructural de otro colaborador.
 * @param {Function} onEliminado - Invocado cuando otro usuario elimina el itinerario.
 * @param {Function} onAccesoRevocado - Invocado cuando el usuario actual pierde el acceso.
 * @returns {{ connected: boolean, usuariosActivos: string[], sendUpdate: Function, sendCambioEstructura: Function }}
 */
export default function useItinerarioSocket(viajeId, onUpdate, onRecargar, onEliminado, onAccesoRevocado) {
  const [connected, setConnected] = useState(false)
  const [usuariosActivos, setUsuariosActivos] = useState([])
  const clientRef = useRef(null)

  const onUpdateRef = useRef(onUpdate)
  useEffect(() => { onUpdateRef.current = onUpdate }, [onUpdate])

  const onRecargarRef = useRef(onRecargar)
  useEffect(() => { onRecargarRef.current = onRecargar }, [onRecargar])

  const onEliminadoRef = useRef(onEliminado)
  useEffect(() => { onEliminadoRef.current = onEliminado }, [onEliminado])

  const onAccesoRevocadoRef = useRef(onAccesoRevocado)
  useEffect(() => { onAccesoRevocadoRef.current = onAccesoRevocado }, [onAccesoRevocado])

  useEffect(() => {
    if (!viajeId) return

    const token = localStorage.getItem('token')
    const usuarioId = localStorage.getItem('usuarioId')

    const client = new Client({
      webSocketFactory: () => new SockJS((import.meta.env.VITE_API_URL || 'http://localhost:8080') + '/ws'),
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

        // Recibir avisos de cambios estructurales (bloques añadidos, borrados, reordenados)
        client.subscribe(`/topic/viaje/${viajeId}/estructura`, (message) => {
          const msg = JSON.parse(message.body)
          if (msg.accion === 'eliminado' && msg.origen !== usuarioId) {
            onEliminadoRef.current?.()
          } else if (msg.accion === 'acceso-revocado' && msg.afectado === usuarioId) {
            onAccesoRevocadoRef.current?.()
          } else if (msg.accion === 'acceso-revocado' && msg.afectado !== usuarioId) {
            onRecargarRef.current?.()
          } else if (!msg.accion && msg.origen !== usuarioId) {
            onRecargarRef.current?.()
          }
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

  const sendCambioEstructura = useCallback(() => {
    if (clientRef.current?.connected) {
      clientRef.current.publish({
        destination: `/app/viaje/${viajeId}/cambio-estructura`,
        body: '{}',
      })
    }
  }, [viajeId])

  return { connected, usuariosActivos, sendUpdate, sendCambioEstructura }
}
