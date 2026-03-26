import { io, Socket } from 'socket.io-client'

const WS_URL =
  process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001'

let socket: Socket | null = null
let currentToken: string | null = null

export function connectWebSocket(token?: string | null): Socket {
  const nextToken = token ?? null
  if (!socket) {
    currentToken = nextToken
    socket = io(WS_URL, {
      transports: ['websocket'],
      autoConnect: true,
      ...(nextToken ? { auth: { token: nextToken } } : {}),
    })

    socket.on('connect', () => {
      console.log('WebSocket connected')
    })

    socket.on('disconnect', () => {
      console.log('WebSocket disconnected')
    })

    socket.on('error', (error) => {
      console.error('WebSocket error:', error)
    })
  } else if (nextToken && nextToken !== currentToken) {
    currentToken = nextToken
    socket.auth = { token: nextToken }
    if (socket.connected) {
      socket.disconnect()
    }
    socket.connect()
  }

  return socket
}

export function disconnectWebSocket(): void {
  if (socket) {
    socket.disconnect()
    socket = null
    currentToken = null
  }
}

export function getSocket(): Socket | null {
  return socket
}
