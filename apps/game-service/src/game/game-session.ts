import type { GamePlayerState, PlayerRole } from "@whoshuman/shared-types";
import { sampleHeight, type Bounds, type Heightmap, type Obstacle } from "./map";

export interface GameSessionConfig {
  bounds: Bounds; // área jugable: el jugador no sale de aquí
  speed: number; // unidades/seg (avance)
  turnSpeed: number; // radianes/seg (giro)
  obstacles: Obstacle[]; // AABB bloqueantes en XZ
  heightmap: Heightmap; // altura del suelo por celda
  maxStep: number; // desnivel máx por movimiento (rampa OK, escalón/pared NO)
}

interface SessionPlayer {
  role: PlayerRole;
  x: number;
  z: number;
  h: number; // altura del suelo bajo el jugador
  heading: number; // orientación en radianes (rotationY)
  forward: number; // -1..1
  turn: number; // -1..1
  present: boolean; // ha hecho game:join
}

const clamp = (v: number, min: number, max: number) => (v < min ? min : v > max ? max : v);

/** Una partida en curso. Lógica pura: sin NATS, sin tiempo real. */
export class GameSession {
  readonly gameId: string;
  private readonly players = new Map<string, SessionPlayer>();
  private readonly config: GameSessionConfig;

  constructor(
    gameId: string,
    members: { userId: string; role: PlayerRole }[],
    config: GameSessionConfig
  ) {
    this.gameId = gameId;
    this.config = config;
    const n = Math.max(members.length, 1);
    const b = config.bounds;
    const cx = (b.minX + b.maxX) / 2; // centro del área jugable
    const cz = (b.minZ + b.maxZ) / 2;
    const radius = Math.min(b.maxX - b.minX, b.maxZ - b.minZ) * 0.3;
    members.forEach((m, i) => {
      const angle = (2 * Math.PI * i) / n; // spawns repartidos en círculo
      const spawn = this.freeSpawn(
        cx + Math.cos(angle) * radius,
        cz + Math.sin(angle) * radius,
        cx,
        cz
      );
      this.players.set(m.userId, {
        role: m.role,
        x: spawn.x,
        z: spawn.z,
        h: sampleHeight(config.heightmap, spawn.x, spawn.z) ?? 0,
        heading: 0, // mira hacia +z
        forward: 0,
        turn: 0,
        present: false
      });
    });
  }

  /** Si el spawn cae dentro de un edificio, lo acerca al centro (cx,cz) hasta que quede libre. */
  // ponytail: asume que el centro del área jugable es transitable; si algún mapa no lo cumple, definir spawns en el descriptor.
  private freeSpawn(x: number, z: number, cx: number, cz: number): { x: number; z: number } {
    for (let i = 0; i < 20 && this.blocked(x, z); i++) {
      x = cx + (x - cx) * 0.85;
      z = cz + (z - cz) * 0.85;
    }
    return { x, z };
  }

  markPresent(userId: string): void {
    const p = this.players.get(userId);
    if (p) p.present = true;
  }

  /** Intención del jugador: forward y turn en [-1, 1] (el servidor fija las velocidades). */
  setInput(userId: string, forward: number, turn: number): void {
    const p = this.players.get(userId);
    if (!p || !p.present) return;
    p.forward = clamp(forward, -1, 1);
    p.turn = clamp(turn, -1, 1);
  }

  removePlayer(userId: string): void {
    this.players.delete(userId);
  }

  get isEmpty(): boolean {
    return this.players.size === 0;
  }

  /** Avanza dt segundos: gira con turn, avanza con forward hacia el heading. */
  tick(dtSeconds: number): void {
    const b = this.config.bounds;
    for (const p of this.players.values()) {
      if (!p.present) continue;
      if (p.turn !== 0) {
        p.heading += p.turn * this.config.turnSpeed * dtSeconds;
      }
      if (p.forward !== 0) {
        const step = p.forward * this.config.speed * dtSeconds;
        // movimiento por eje → deslizar a lo largo de las paredes; clamp = no salir del área jugable
        const nx = clamp(p.x + Math.sin(p.heading) * step, b.minX, b.maxX);
        if (this.walkable(nx, p.z, p.h)) {
          p.x = nx;
          p.h = sampleHeight(this.config.heightmap, p.x, p.z) as number;
        }
        const nz = clamp(p.z + Math.cos(p.heading) * step, b.minZ, b.maxZ);
        if (this.walkable(p.x, nz, p.h)) {
          p.z = nz;
          p.h = sampleHeight(this.config.heightmap, p.x, p.z) as number;
        }
      }
    }
  }

  /** ¿se puede pisar (x,z) viniendo de altura h? No si hay edificio, si no hay suelo, o si el desnivel es grande. */
  private walkable(x: number, z: number, h: number): boolean {
    if (this.blocked(x, z)) return false; // edificio
    const th = sampleHeight(this.config.heightmap, x, z);
    if (th === null) return false; // sin suelo (vacío/borde) → no andas al vacío
    return Math.abs(th - h) <= this.config.maxStep; // rampa OK; escalón/pared NO
  }

  /** ¿el punto (x,z) cae dentro de algún obstáculo? El jugador se trata como punto. */
  // ponytail: punto sin radio; añadir volumen del jugador si hace falta "empuje" con cuerpo.
  private blocked(x: number, z: number): boolean {
    for (const o of this.config.obstacles) {
      if (x >= o.minX && x <= o.maxX && z >= o.minZ && z <= o.maxZ) return true;
    }
    return false;
  }

  /** Posiciones oficiales de los jugadores presentes (para el snapshot). */
  snapshot(): GamePlayerState[] {
    const out: GamePlayerState[] = [];
    for (const [userId, p] of this.players) {
      if (!p.present) continue;
      out.push({ userId, x: p.x, y: p.h, z: p.z, rotationY: p.heading });
    }
    return out;
  }
}
