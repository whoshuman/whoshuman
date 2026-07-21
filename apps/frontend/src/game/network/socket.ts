import { io, Socket } from "socket.io-client";

// Singleton a nivel de módulo (mismo patrón que `audio` en musicStore): una única
// conexión WebSocket para toda la app, viva entre pantallas. El estado reactivo
// derivado de ella vive en lobbyStore; aquí solo la conexión cruda.
let socket: Socket | null = null;

export function connectSocket(): Socket {
  if (socket) return socket;

  // VITE_WS_URL en producción (https://localhost vía nginx). En dev queda vacío y
  // usamos el propio origen de Vite: el proxy ws de vite.config redirige /socket.io.
  const url = (import.meta.env.VITE_WS_URL as string) || window.location.origin;

  socket = io(url, {
    // `auth` como función: socket.io la re-ejecuta en cada intento de (re)conexión,
    // así siempre manda el access token vigente (caduca a los 15 min) y no el que
    // hubiera en memoria al crear el socket.
    auth: (cb) => cb({ token: localStorage.getItem("authToken") ?? "" })
  });

  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}
