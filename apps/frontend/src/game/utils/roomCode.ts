// Charset sin caracteres ambiguos (0/O, 1/I) para dictar códigos en voz alta.
const CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

// Código de sala tipo WH-7X2K. Para el backend es simplemente un lobbyId más:
// matchmaking crea el lobby en memoria la primera vez que alguien hace join.
export function generateRoomCode(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  let code = "";
  for (const byte of bytes) {
    code += CHARSET[byte % CHARSET.length];
  }
  return `WH-${code}`;
}
