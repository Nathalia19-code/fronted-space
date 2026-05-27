import { useEffect, useRef } from 'react'
import { Client } from '@stomp/stompjs'
import SockJS from 'sockjs-client'

/**
 * Hook que mantiene una conexión STOMP/SockJS suscrita a las notificaciones de cambios
 * en favoritos del usuario actual.
 *
 * <p>Se conecta al endpoint WebSocket ({@code VITE_API_URL}/ws) e inmediatamente se
 * suscribe a {@code /topic/favoritos/{usuarioId}}. Cualquier mensaje recibido dispara
 * el callback {@code onCambio}, que suele ser la función de recarga del estado local.
 * El callback se almacena en un ref para evitar reconexiones cuando cambia la referencia
 * de la función entre renders.
 *
 * <p>Si no hay {@code token} o {@code usuarioId} en {@code localStorage}, el hook no
 * establece ninguna conexión y retorna sin efecto.
 *
 * <p>Se usa en {@code HomePage}, {@code FavoritesPage} y {@code Cajon}.
 *
 * @param {Function} onCambio - Callback invocado cuando llega cualquier mensaje en el topic.
 */
export default function useFavoritosSocket(onCambio) {
  const onCambioRef = useRef(onCambio)
  useEffect(() => { onCambioRef.current = onCambio }, [onCambio])

  useEffect(() => {
    const token = localStorage.getItem('token')
    const usuarioId = localStorage.getItem('usuarioId')
    if (!token || !usuarioId) return

    const client = new Client({
      webSocketFactory: () => new SockJS((import.meta.env.VITE_API_URL || 'http://localhost:8080') + '/ws'),
      connectHeaders: { Authorization: `Bearer ${token}` },
      reconnectDelay: 5000,
      onConnect: () => {
        client.subscribe(`/topic/favoritos/${usuarioId}`, () => {
          onCambioRef.current?.()
        })
      },
    })

    client.activate()
    return () => { client.deactivate() }
  }, [])
}
