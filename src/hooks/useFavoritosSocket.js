import { useEffect, useRef } from 'react'
import { Client } from '@stomp/stompjs'
import SockJS from 'sockjs-client'

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
