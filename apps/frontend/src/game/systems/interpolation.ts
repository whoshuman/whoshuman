import type { GameEntityState, GameStateSnapshotPayload } from "@whoshuman/shared-types";

// El servidor emite snapshots a 20 Hz (cada 50 ms). Renderizar el último tal cual
// daría movimiento a saltos; en su lugar renderizamos ~100 ms EN EL PASADO,
// interpolando entre los dos snapshots que rodean ese instante. Es el estándar
// de los juegos en red: cambias 100 ms de latencia visual por fluidez total.
const RENDER_DELAY_MS = 100;
// Con quedarnos los últimos ~10 snapshots (500 ms) sobra para interpolar.
const MAX_BUFFER = 10;

interface TimedSnapshot {
  receivedAt: number;
  entities: GameEntityState[];
}

// Buffer a nivel de módulo, FUERA de React y de Zustand: llega a 20 Hz y
// provocar un re-render por tick violaría las reglas de rendimiento. Solo lo
// lee el useFrame de la escena (imperativo, sobre refs).
let buffer: TimedSnapshot[] = [];

export function pushSnapshot(snapshot: GameStateSnapshotPayload): void {
  buffer.push({ receivedAt: performance.now(), entities: snapshot.entities });
  if (buffer.length > MAX_BUFFER) buffer = buffer.slice(-MAX_BUFFER);
}

export function clearSnapshots(): void {
  buffer = [];
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// Interpolación angular por el arco corto: de 3.1 a -3.1 rad debe girar 0.08 rad,
// no dar la vuelta entera de -6.2.
function lerpAngle(a: number, b: number, t: number): number {
  let diff = (b - a) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}

function interpolateEntities(
  previous: GameEntityState[],
  next: GameEntityState[],
  t: number
): GameEntityState[] {
  return next.map((target) => {
    const source = previous.find((state) => state.entityId === target.entityId);
    if (!source) return target;
    return {
      ...target,
      x: lerp(source.x, target.x, t),
      y: lerp(source.y, target.y, t),
      z: lerp(source.z, target.z, t),
      rotationY: lerpAngle(source.rotationY, target.rotationY, t)
    };
  });
}

export function sampleWorld(): GameEntityState[] {
  if (buffer.length === 0) return [];
  const renderTime = performance.now() - RENDER_DELAY_MS;

  // Busca el par de snapshots [prev, next] que rodea renderTime.
  let prev = buffer[0];
  let next: TimedSnapshot | null = null;
  for (const snap of buffer) {
    if (snap.receivedAt <= renderTime) {
      prev = snap;
    } else {
      next = snap;
      break;
    }
  }

  // Sin snapshot posterior (red parada o retardo aún no cumplido): último conocido.
  if (!next || next.receivedAt === prev.receivedAt) {
    return prev.entities;
  }

  const t = (renderTime - prev.receivedAt) / (next.receivedAt - prev.receivedAt);
  return interpolateEntities(prev.entities, next.entities, t);
}
