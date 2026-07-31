import type {
  GameEntityState,
  GameStateSnapshotPayload,
  SeekerState
} from "@whoshuman/shared-types";

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
  seeker: SeekerState | null;
}

// Buffer a nivel de módulo, FUERA de React y de Zustand: llega a 20 Hz y
// provocar un re-render por tick violaría las reglas de rendimiento. Solo lo
// lee el useFrame de la escena (imperativo, sobre refs).
let buffer: TimedSnapshot[] = [];

export function pushSnapshot(snapshot: GameStateSnapshotPayload): void {
  buffer.push({
    receivedAt: performance.now(),
    entities: snapshot.entities,
    seeker: snapshot.seeker ?? null
  });
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

// Busca el par de snapshots [prev, next] que rodea el instante que toca pintar, y
// cuánto hay que interpolar entre ellos. t === null = sin posterior (red parada o
// retardo aún no cumplido): se usa prev tal cual.
function samplePair(): { prev: TimedSnapshot; next: TimedSnapshot | null; t: number } | null {
  if (buffer.length === 0) return null;
  const renderTime = performance.now() - RENDER_DELAY_MS;

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

  if (!next || next.receivedAt === prev.receivedAt) return { prev, next: null, t: 0 };
  return { prev, next, t: (renderTime - prev.receivedAt) / (next.receivedAt - prev.receivedAt) };
}

export function sampleWorld(): GameEntityState[] {
  const pair = samplePair();
  if (!pair) return [];
  if (!pair.next) return pair.prev.entities;
  return interpolateEntities(pair.prev.entities, pair.next.entities, pair.t);
}

/** La nave del cazador, suavizada igual que el resto: llega a 20 Hz. */
export function sampleSeeker(): SeekerState | null {
  const pair = samplePair();
  if (!pair) return null;
  const source = pair.prev.seeker;
  if (!source) return null;
  const target = pair.next?.seeker;
  if (!target) return source;
  return {
    x: lerp(source.x, target.x, pair.t),
    y: lerp(source.y, target.y, pair.t),
    z: lerp(source.z, target.z, pair.t),
    dirX: lerp(source.dirX, target.dirX, pair.t),
    dirY: lerp(source.dirY, target.dirY, pair.t),
    dirZ: lerp(source.dirZ, target.dirZ, pair.t),
    aimX: lerp(source.aimX, target.aimX, pair.t),
    aimY: lerp(source.aimY, target.aimY, pair.t),
    aimZ: lerp(source.aimZ, target.aimZ, pair.t),
    // Es un booleano: interpolarlo no significa nada, manda el snapshot más reciente.
    aiming: target.aiming
  };
}
