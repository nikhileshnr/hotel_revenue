import { io } from 'socket.io-client';

let socket = null;

/**
 * Get or create the Socket.io client connection.
 * Connects with JWT token from localStorage for authentication.
 * Maintains a single socket instance throughout the app lifecycle.
 */
export function getSocket() {
  // Return existing socket (even if temporarily disconnected — it will auto-reconnect)
  if (socket) {
    return socket;
  }

  const token = localStorage.getItem('token');
  if (!token) {
    console.warn('[Socket] No token found, cannot connect');
    return null;
  }

  socket = io(import.meta.env.VITE_SOCKET_URL || '/', {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
  });

  socket.on('connect', () => {
    console.log('[Socket] Connected:', socket.id);
  });

  socket.on('disconnect', (reason) => {
    console.log('[Socket] Disconnected:', reason);
  });

  socket.on('connect_error', (err) => {
    console.error('[Socket] Connection error:', err.message);
  });

  return socket;
}

/**
 * Disconnect and clean up the socket connection.
 */
export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

/**
 * Check if socket is currently connected.
 */
export function isSocketConnected() {
  return socket?.connected ?? false;
}
