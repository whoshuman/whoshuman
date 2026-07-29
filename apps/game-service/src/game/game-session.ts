import { randomUUID } from "node:crypto";
import type {
  GameCollectibleState,
  GameEntityState,
  GameRoundEndReason,
  GameRoundPhase,
  GameRoundState,
  GameScoreState,
  PlayerRole
} from "@whoshuman/shared-types";
import { sampleHeight, type Bounds, type Heightmap, type Obstacle } from "./map";

type NpcMode = "idle" | "turning" | "walking";

interface PlayerDebugState extends GameEntityState {
  userId: string;
  alive: boolean;
  role: PlayerRole;
  score: number;
}

interface NpcDebugState extends GameEntityState {
  mode: NpcMode;
}

export interface GameSessionConfig {
  bounds: Bounds; // área jugable: el jugador no sale de aquí
  speed: number; // unidades/seg (avance)
  turnSpeed: number; // radianes/seg (giro)
  obstacles: Obstacle[]; // AABB bloqueantes en XZ
  heightmap: Heightmap; // altura del suelo por celda
  maxStep: number; // desnivel máx por movimiento (rampa OK, escalón/pared NO)
  npcCount: number;
  npcSpeed: number;
}

export interface GameRoundRecord {
  number: number;
  startedAt: Date;
  endedAt: Date;
}

interface MovableState {
  x: number;
  z: number;
  h: number;
  heading: number;
}

interface SessionPlayer extends MovableState {
  entityId: string;
  skinId: number;
  username: string;
  role: PlayerRole;
  score: number;
  alive: boolean;
  forward: number; // -1..1
  turn: number; // -1..1
  aiming: boolean;
  present: boolean; // ha hecho game:join
}

interface SessionNpc extends MovableState {
  entityId: string;
  skinId: number;
  mode: NpcMode;
  modeTime: number;
  targetHeading: number;
}

const clamp = (v: number, min: number, max: number) => (v < min ? min : v > max ? max : v);
const NPC_SEPARATION = 0.28;
// Nº de modelos en apps/frontend/public/models/personajes: el cliente indexa por skinId.
const CHARACTER_SKIN_COUNT = 4;
const COLLECTIBLE_SEPARATION = 0.4;

export const GAME_RULES = {
  totalRounds: 3,
  roundSeconds: 90,
  intermissionSeconds: 5,
  collectibleCount: 8,
  collectibleRadius: 0.24,
  hiderHitPoints: 100,
  npcHitPoints: -25,
  collectiblePoints: 25
} as const;

/** Una partida en curso. Lógica pura: sin NATS, sin tiempo real. */
export class GameSession {
  readonly gameId: string;
  private readonly players = new Map<string, SessionPlayer>();
  private readonly npcs: SessionNpc[] = [];
  private readonly collectibles: GameCollectibleState[] = [];
  private readonly config: GameSessionConfig;
  private randomSeed: number;
  private seekerUserId: string;
  private roundNumber = 1;
  private roundPhase: GameRoundPhase = "playing";
  private remainingSeconds: number = GAME_RULES.roundSeconds;
  private roundEndReason: GameRoundEndReason = null;
  private roundStartedAt = new Date();
  private readonly completedRounds: GameRoundRecord[] = [];

  constructor(
    gameId: string,
    members: { userId: string; username?: string; role: PlayerRole }[],
    config: GameSessionConfig
  ) {
    this.gameId = gameId;
    this.config = config;
    this.randomSeed = this.seed(gameId);
    this.seekerUserId = members.find((member) => member.role === "seeker")?.userId ?? "";

    members.forEach((m, i) => {
      this.players.set(m.userId, {
        entityId: randomUUID(),
        skinId: i % CHARACTER_SKIN_COUNT,
        username: m.username ?? m.userId,
        role: m.role,
        score: 0,
        alive: true,
        x: 0,
        z: 0,
        h: 0,
        heading: 0,
        forward: 0,
        turn: 0,
        aiming: false,
        present: false
      });
    });

    this.resetRoundWorld(false);
  }

  private resetRoundWorld(rotateSeeker: boolean): void {
    const userIds = [...this.players.keys()];
    if (rotateSeeker && userIds.length > 0 && this.seekerUserId) {
      const current = userIds.indexOf(this.seekerUserId);
      this.seekerUserId = userIds[(current + 1 + userIds.length) % userIds.length];
    }

    this.npcs.length = 0;
    this.collectibles.length = 0;
    const n = Math.max(userIds.length, 1);
    const b = this.config.bounds;
    const cx = (b.minX + b.maxX) / 2;
    const cz = (b.minZ + b.maxZ) / 2;
    const radius = Math.min(b.maxX - b.minX, b.maxZ - b.minZ) * 0.3;
    userIds.forEach((userId, index) => {
      const player = this.players.get(userId) as SessionPlayer;
      const angle = (2 * Math.PI * index) / n;
      const spawn = this.freeSpawn(
        cx + Math.cos(angle) * radius,
        cz + Math.sin(angle) * radius,
        cx,
        cz
      );
      if (this.seekerUserId) {
        player.role = userId === this.seekerUserId ? "seeker" : "hider";
      }
      player.alive = true;
      player.x = spawn.x;
      player.z = spawn.z;
      player.h = sampleHeight(this.config.heightmap, spawn.x, spawn.z) ?? 0;
      player.heading = 0;
      player.forward = 0;
      player.turn = 0;
      player.aiming = false;
    });

    this.spawnNpcs();
    this.spawnCollectibles();
  }

  private spawnNpcs(): void {
    for (let i = 0; i < this.config.npcCount; i += 1) {
      const spawn = this.randomWalkablePoint();
      const heading = this.random() * Math.PI * 2;
      this.npcs.push({
        entityId: randomUUID(),
        skinId: (this.players.size + i) % CHARACTER_SKIN_COUNT,
        x: spawn.x,
        z: spawn.z,
        h: spawn.h,
        heading,
        targetHeading: heading,
        mode: "idle",
        modeTime: 0.2 + this.random() * 1.8
      });
    }
  }

  private spawnCollectibles(): void {
    for (let i = 0; i < GAME_RULES.collectibleCount; i += 1) {
      let spawn = this.randomWalkablePoint();
      for (let attempt = 0; attempt < 20; attempt += 1) {
        const separated = this.collectibles.every(
          (item) => Math.hypot(item.x - spawn.x, item.z - spawn.z) >= COLLECTIBLE_SEPARATION
        );
        if (separated) break;
        spawn = this.randomWalkablePoint();
      }
      this.collectibles.push({
        collectibleId: randomUUID(),
        x: spawn.x,
        y: spawn.h + 0.14,
        z: spawn.z
      });
    }
  }

  private seed(value: string): number {
    let seed = 2166136261;
    for (let i = 0; i < value.length; i += 1) {
      seed = Math.imul(seed ^ value.charCodeAt(i), 16777619);
    }
    return seed >>> 0;
  }

  private random(): number {
    this.randomSeed = (Math.imul(this.randomSeed, 1664525) + 1013904223) >>> 0;
    return this.randomSeed / 4294967296;
  }

  private randomWalkablePoint(): { x: number; z: number; h: number } {
    const { bounds, heightmap } = this.config;
    for (let i = 0; i < 100; i += 1) {
      const x = bounds.minX + this.random() * (bounds.maxX - bounds.minX);
      const z = bounds.minZ + this.random() * (bounds.maxZ - bounds.minZ);
      const h = sampleHeight(heightmap, x, z);
      if (h !== null && !this.blocked(x, z) && this.clearOfNpcs(x, z)) return { x, z, h };
    }

    for (let row = 0; row < heightmap.rows; row += 1) {
      for (let col = 0; col < heightmap.cols; col += 1) {
        const x = heightmap.minX + col * heightmap.cell;
        const z = heightmap.minZ + row * heightmap.cell;
        const h = sampleHeight(heightmap, x, z);
        if (h !== null && !this.blocked(x, z) && this.clearOfNpcs(x, z)) return { x, z, h };
      }
    }
    throw new Error("Map has no walkable point for NPCs");
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

  markPresent(userId: string): { entityId: string; role: PlayerRole } | null {
    const p = this.players.get(userId);
    if (!p) return null;
    p.present = true;
    p.aiming = false;
    return { entityId: p.entityId, role: p.role };
  }

  markDisconnected(userId: string): boolean {
    const player = this.players.get(userId);
    if (!player) return false;
    player.present = false;
    player.forward = 0;
    player.turn = 0;
    player.aiming = false;
    return true;
  }

  /** Intención del jugador: forward y turn en [-1, 1] (el servidor fija las velocidades). */
  setInput(userId: string, forward: number, turn: number): void {
    const p = this.players.get(userId);
    if (!p || !p.present || !p.alive || p.role === "seeker" || this.roundPhase !== "playing") {
      return;
    }
    p.forward = clamp(forward, -1, 1);
    p.turn = clamp(turn, -1, 1);
  }

  setAiming(userId: string, aiming: boolean): boolean {
    const player = this.players.get(userId);
    if (!player?.present || player.role !== "seeker" || this.roundPhase !== "playing") {
      return false;
    }
    player.aiming = aiming;
    return true;
  }

  shoot(userId: string, targetEntityId: string): boolean {
    const shooter = this.players.get(userId);
    if (
      this.roundPhase !== "playing" ||
      !shooter?.present ||
      shooter.role !== "seeker" ||
      !shooter.aiming ||
      shooter.entityId === targetEntityId
    ) {
      return false;
    }

    for (const player of this.players.values()) {
      if (player.entityId === targetEntityId && player.role === "hider" && player.alive) {
        player.alive = false;
        player.forward = 0;
        player.turn = 0;
        shooter.score += GAME_RULES.hiderHitPoints;
        if (this.allHidersFound) this.endRound("all-hiders-found");
        return true;
      }
    }

    const npcIndex = this.npcs.findIndex((npc) => npc.entityId === targetEntityId);
    if (npcIndex < 0) return false;
    this.npcs.splice(npcIndex, 1);
    shooter.score += GAME_RULES.npcHitPoints;
    return true;
  }

  removePlayer(userId: string): GameScoreState | null {
    const player = this.players.get(userId);
    if (!player) return null;
    this.players.delete(userId);
    if (this.roundPhase === "playing" && this.allHidersFound) {
      this.endRound("all-hiders-found");
    }
    return {
      userId,
      username: player.username,
      score: player.score,
      role: player.role,
      alive: player.alive
    };
  }

  get isEmpty(): boolean {
    return this.players.size === 0;
  }

  /** Avanza dt segundos: gira con turn, avanza con forward hacia el heading. */
  tick(dtSeconds: number): void {
    if (this.roundPhase === "finished") return;
    this.remainingSeconds = Math.max(0, this.remainingSeconds - dtSeconds);
    if (this.roundPhase === "intermission") {
      if (this.remainingSeconds === 0) this.startNextRound();
      return;
    }

    for (const p of this.players.values()) {
      if (!p.present || !p.alive || p.role === "seeker") continue;
      if (p.turn !== 0) {
        p.heading += p.turn * this.config.turnSpeed * dtSeconds;
      }
      if (p.forward !== 0) {
        this.moveForward(p, p.forward * this.config.speed * dtSeconds);
      }
    }

    for (const npc of this.npcs) this.tickNpc(npc, dtSeconds);
    this.collectNearbyItems();
    if (this.remainingSeconds === 0) this.endRound("time");
  }

  private collectNearbyItems(): void {
    for (const player of this.players.values()) {
      if (!player.present || !player.alive || player.role !== "hider") continue;
      for (let i = this.collectibles.length - 1; i >= 0; i -= 1) {
        const item = this.collectibles[i];
        if (Math.hypot(player.x - item.x, player.z - item.z) > GAME_RULES.collectibleRadius) {
          continue;
        }
        this.collectibles.splice(i, 1);
        player.score += GAME_RULES.collectiblePoints;
      }
    }
  }

  private get allHidersFound(): boolean {
    const hiders = [...this.players.values()].filter((player) => player.role === "hider");
    return hiders.length > 0 && hiders.every((player) => !player.alive);
  }

  private endRound(reason: Exclude<GameRoundEndReason, null>): void {
    if (this.roundPhase !== "playing") return;
    this.roundEndReason = reason;
    this.completedRounds.push({
      number: this.roundNumber,
      startedAt: this.roundStartedAt,
      endedAt: new Date()
    });
    for (const player of this.players.values()) {
      player.forward = 0;
      player.turn = 0;
      player.aiming = false;
    }
    if (this.roundNumber >= GAME_RULES.totalRounds) {
      this.roundPhase = "finished";
      this.remainingSeconds = 0;
      return;
    }
    this.roundPhase = "intermission";
    this.remainingSeconds = GAME_RULES.intermissionSeconds;
  }

  private startNextRound(): void {
    this.roundNumber += 1;
    this.roundPhase = "playing";
    this.remainingSeconds = GAME_RULES.roundSeconds;
    this.roundEndReason = null;
    this.roundStartedAt = new Date();
    this.resetRoundWorld(true);
  }

  private tickNpc(npc: SessionNpc, dtSeconds: number): void {
    if (npc.mode === "idle") {
      npc.modeTime -= dtSeconds;
      if (npc.modeTime <= 0) this.chooseNpcHeading(npc);
      return;
    }

    if (npc.mode === "turning") {
      const difference = this.shortestAngle(npc.targetHeading - npc.heading);
      const step = Math.min(this.config.turnSpeed, 1.8) * dtSeconds;
      if (Math.abs(difference) <= step) {
        npc.heading = npc.targetHeading;
        npc.mode = "walking";
      } else {
        npc.heading += Math.sign(difference) * step;
      }
      return;
    }

    npc.modeTime -= dtSeconds;
    const distance = this.config.npcSpeed * dtSeconds;
    const moved = this.clearOfNpcs(
      npc.x + Math.sin(npc.heading) * distance,
      npc.z + Math.cos(npc.heading) * distance,
      npc
    )
      ? this.moveForward(npc, distance)
      : false;
    if (!moved || npc.modeTime <= 0) {
      npc.mode = "idle";
      npc.modeTime = 0.4 + this.random() * 1.8;
    }
  }

  private chooseNpcHeading(npc: SessionNpc): void {
    for (let i = 0; i < 12; i += 1) {
      const heading = npc.heading + (this.random() - 0.5) * Math.PI * 1.5;
      const distance = 0.45 + this.random() * 0.9;
      if (this.pathIsClear(npc, heading, distance)) {
        npc.targetHeading = heading;
        npc.modeTime = distance / this.config.npcSpeed;
        npc.mode = "turning";
        return;
      }
    }
    npc.modeTime = 0.2 + this.random() * 0.4;
  }

  private pathIsClear(npc: SessionNpc, heading: number, distance: number): boolean {
    const step = Math.min(this.config.heightmap.cell / 2, 0.12);
    let h = npc.h;
    for (let travelled = step; travelled <= distance; travelled += step) {
      const x = npc.x + Math.sin(heading) * travelled;
      const z = npc.z + Math.cos(heading) * travelled;
      if (!this.insideBounds(x, z) || !this.walkable(x, z, h) || !this.clearOfNpcs(x, z, npc)) {
        return false;
      }
      h = sampleHeight(this.config.heightmap, x, z) as number;
    }
    return true;
  }

  private insideBounds(x: number, z: number): boolean {
    const b = this.config.bounds;
    return x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ;
  }

  // ponytail: O(n²) para una multitud de hasta 64; usar una rejilla espacial solo si ese límite crece.
  private clearOfNpcs(x: number, z: number, ignore?: SessionNpc): boolean {
    return this.npcs.every(
      (other) => other === ignore || Math.hypot(other.x - x, other.z - z) >= NPC_SEPARATION
    );
  }

  private shortestAngle(angle: number): number {
    if (angle > Math.PI) return angle - Math.PI * 2;
    if (angle < -Math.PI) return angle + Math.PI * 2;
    return angle;
  }

  /** Movimiento compartido: jugadores y NPC obedecen exactamente las mismas colisiones. */
  private moveForward(entity: MovableState, distance: number): boolean {
    const b = this.config.bounds;
    const beforeX = entity.x;
    const beforeZ = entity.z;
    // movimiento por eje → deslizar a lo largo de las paredes; clamp = no salir del área jugable
    const nx = clamp(entity.x + Math.sin(entity.heading) * distance, b.minX, b.maxX);
    if (this.walkable(nx, entity.z, entity.h)) {
      entity.x = nx;
      entity.h = sampleHeight(this.config.heightmap, entity.x, entity.z) as number;
    }
    const nz = clamp(entity.z + Math.cos(entity.heading) * distance, b.minZ, b.maxZ);
    if (this.walkable(entity.x, nz, entity.h)) {
      entity.z = nz;
      entity.h = sampleHeight(this.config.heightmap, entity.x, entity.z) as number;
    }
    return entity.x !== beforeX || entity.z !== beforeZ;
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

  /** Solo para pruebas internas; nunca se publica porque contiene userId. */
  playerSnapshot(): PlayerDebugState[] {
    const out: PlayerDebugState[] = [];
    for (const [userId, p] of this.players) {
      if (!p.present) continue;
      out.push({
        userId,
        entityId: p.entityId,
        skinId: p.skinId,
        alive: p.alive,
        role: p.role,
        score: p.score,
        x: p.x,
        y: p.h,
        z: p.z,
        rotationY: p.heading
      });
    }
    return out;
  }

  /** Solo para pruebas internas; el modo revelaría cuáles entidades son NPC. */
  npcSnapshot(): NpcDebugState[] {
    return this.npcs.map((npc) => ({
      entityId: npc.entityId,
      skinId: npc.skinId,
      x: npc.x,
      y: npc.h,
      z: npc.z,
      rotationY: npc.heading,
      mode: npc.mode
    }));
  }

  roundSnapshot(): GameRoundState {
    return {
      phase: this.roundPhase,
      current: this.roundNumber,
      total: GAME_RULES.totalRounds,
      remainingSeconds: Math.ceil(this.remainingSeconds),
      endReason: this.roundEndReason
    };
  }

  scoreSnapshot(): GameScoreState[] {
    return [...this.players.entries()].map(([userId, player]) => ({
      userId,
      username: player.username,
      score: player.score,
      role: player.role,
      alive: player.alive
    }));
  }

  roundRecords(): GameRoundRecord[] {
    return this.completedRounds.map((round) => ({ ...round }));
  }

  collectibleSnapshot(): GameCollectibleState[] {
    return this.collectibles.map((item) => ({ ...item }));
  }

  /** Estado público: humanos y NPC tienen exactamente la misma forma y orden opaco. */
  snapshot(): GameEntityState[] {
    const entities: GameEntityState[] = [];
    for (const player of this.players.values()) {
      if (player.role === "seeker" || !player.alive) continue;
      entities.push({
        entityId: player.entityId,
        skinId: player.skinId,
        x: player.x,
        y: player.h,
        z: player.z,
        rotationY: player.heading
      });
    }
    for (const npc of this.npcs) {
      entities.push({
        entityId: npc.entityId,
        skinId: npc.skinId,
        x: npc.x,
        y: npc.h,
        z: npc.z,
        rotationY: npc.heading
      });
    }
    return entities.sort((a, b) => a.entityId.localeCompare(b.entityId));
  }
}
