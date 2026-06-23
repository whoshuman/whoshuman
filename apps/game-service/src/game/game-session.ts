import type { GamePlayerState, PlayerRole } from "@whoshuman/shared-types";

export interface GameSessionConfig {
  mapSize: number; // lado del cuadrado, centrado en 0 → límites ±mapSize/2
  speed: number; // unidades/seg
}

interface SessionPlayer {
  role: PlayerRole;
  x: number;
  z: number;
  rotationY: number;
  move: { x: number; z: number };
  present: boolean; // ha hecho game:join (está en /game)
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
    const radius = config.mapSize * 0.3;
    members.forEach((m, i) => {
      const angle = (2 * Math.PI * i) / n; // spawns repartidos en círculo
      this.players.set(m.userId, {
        role: m.role,
        x: Math.cos(angle) * radius,
        z: Math.sin(angle) * radius,
        rotationY: 0,
        move: { x: 0, z: 0 },
        present: false
      });
    });
  }

  markPresent(userId: string): void {
    const p = this.players.get(userId);
    if (p) p.present = true;
  }

  setMove(userId: string, move: { x: number; z: number }): void {
    const p = this.players.get(userId);
    if (!p || !p.present) return;
    // Normaliza si |move| > 1: el cliente NO fija la velocidad (anti-cheat).
    const len = Math.hypot(move.x, move.z);
    p.move = len > 1 ? { x: move.x / len, z: move.z / len } : { x: move.x, z: move.z };
  }

  removePlayer(userId: string): void {
    this.players.delete(userId);
  }

  get isEmpty(): boolean {
    return this.players.size === 0;
  }

  /** Avanza la simulación dt segundos. */
  tick(dtSeconds: number): void {
    const half = this.config.mapSize / 2;
    for (const p of this.players.values()) {
      if (!p.present) continue;
      if (p.move.x === 0 && p.move.z === 0) continue;
      p.x = clamp(p.x + p.move.x * this.config.speed * dtSeconds, -half, half);
      p.z = clamp(p.z + p.move.z * this.config.speed * dtSeconds, -half, half);
      p.rotationY = Math.atan2(p.move.x, p.move.z); // miras hacia donde andas
    }
  }

  /** Posiciones oficiales de los jugadores presentes (para el snapshot). */
  snapshot(): GamePlayerState[] {
    const out: GamePlayerState[] = [];
    for (const [userId, p] of this.players) {
      if (!p.present) continue;
      out.push({ userId, x: p.x, y: 0, z: p.z, rotationY: p.rotationY });
    }
    return out;
  }
}
