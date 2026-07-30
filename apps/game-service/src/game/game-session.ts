import { randomUUID } from "node:crypto";
import type {
  GameCollectibleState,
  GameEntityState,
  GameRoundEndReason,
  GameRoundPhase,
  GameRoundState,
  GameScoreState,
  PlayerRole,
  SeekerPose,
  SeekerState
} from "@whoshuman/shared-types";
import { sampleHeight, type Bounds, type Heightmap, type Obstacle } from "./map";

// Sin modo "turning": girar parado se veía como si el personaje gravitase sobre sí
// mismo. El NPC solo cambia de rumbo mientras camina, describiendo una curva.
type NpcMode = "idle" | "walking";

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
  turnSpeed: number; // radianes/seg (tope de giro)
  obstacles: Obstacle[]; // AABB bloqueantes en XZ
  heightmap: Heightmap; // altura del suelo por celda
  // Pendiente máxima transitable (altura/distancia). En beta-city el terreno andable
  // llega a 0.12 y las paredes arrancan en 1.72, así que cualquier valor intermedio
  // las separa con holgura.
  maxSlope: number;
  npcCount: number;
  // Velocidad de TODA la multitud, humanos incluidos. Ya no existe una velocidad de
  // jugador aparte: tenerla era regalarle al cazador un modo de distinguirlos.
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
  // Mismos campos que un NPC, y por el mismo motivo: el humano tiene que moverse
  // exactamente igual que la multitud o se le distingue a simple vista.
  speedScale: number;
  velocity: number;
  aiming: boolean;
  // Solo el cazador: su nave orbita con la cámara del cliente, así que el servidor no
  // la simula, solo retransmite la última pose recibida para que el resto la vea.
  pose: SeekerPose | null;
  present: boolean; // ha hecho game:join
}

interface SessionNpc extends MovableState {
  entityId: string;
  skinId: number;
  mode: NpcMode;
  modeTime: number;
  targetHeading: number;
  blockedTime: number; // segundos seguidos sin poder avanzar
  speedScale: number; // su ritmo propio: una multitud a la misma velocidad parece un banco de peces
  velocity: number; // u/s actual; sube y baja por rampa en vez de saltar
}

const clamp = (v: number, min: number, max: number) => (v < min ? min : v > max ? max : v);
const NPC_SEPARATION = 0.28;
// Columnas de la rejilla de separación. Codifica (fila, columna) en un solo entero y
// admite coordenadas negativas con el desplazamiento de la mitad.
const CROWD_GRID_STRIDE = 4096;
const CROWD_GRID_ORIGIN = CROWD_GRID_STRIDE / 2;

/**
 * Rejilla uniforme para las consultas de separación entre miembros de la multitud.
 *
 * Antes se recorría la lista entera en cada consulta, que es O(n²) por tick; con la
 * anticipación de obstáculos (que sondea varios puntos por delante de cada NPC) el
 * coste se multiplicó por seis. Con la celda del tamaño del radio de separación basta
 * mirar las 9 celdas vecinas, así que cada consulta pasa a ser prácticamente O(1).
 */
class CrowdGrid {
  private readonly buckets = new Map<number, MovableState[]>();
  private readonly placed = new Map<MovableState, number>();

  private static key(x: number, z: number): number {
    const col = Math.floor(x / NPC_SEPARATION) + CROWD_GRID_ORIGIN;
    const row = Math.floor(z / NPC_SEPARATION) + CROWD_GRID_ORIGIN;
    return row * CROWD_GRID_STRIDE + col;
  }

  clear(): void {
    this.buckets.clear();
    this.placed.clear();
  }

  add(member: MovableState): void {
    const key = CrowdGrid.key(member.x, member.z);
    const bucket = this.buckets.get(key);
    if (bucket) bucket.push(member);
    else this.buckets.set(key, [member]);
    this.placed.set(member, key);
  }

  remove(member: MovableState): void {
    const key = this.placed.get(member);
    if (key === undefined) return;
    const bucket = this.buckets.get(key);
    const at = bucket?.indexOf(member) ?? -1;
    if (bucket && at >= 0) bucket.splice(at, 1);
    this.placed.delete(member);
  }

  /** Reubica tras moverse. Barato: casi siempre sigue en la misma celda. */
  update(member: MovableState): void {
    if (this.placed.get(member) === CrowdGrid.key(member.x, member.z)) return;
    this.remove(member);
    this.add(member);
  }

  /** ¿Nadie (salvo `ignore`) a menos de NPC_SEPARATION de (x,z)? */
  isClear(x: number, z: number, ignore?: MovableState): boolean {
    const col = Math.floor(x / NPC_SEPARATION) + CROWD_GRID_ORIGIN;
    const row = Math.floor(z / NPC_SEPARATION) + CROWD_GRID_ORIGIN;
    for (let dRow = -1; dRow <= 1; dRow += 1) {
      for (let dCol = -1; dCol <= 1; dCol += 1) {
        const bucket = this.buckets.get((row + dRow) * CROWD_GRID_STRIDE + col + dCol);
        if (!bucket) continue;
        for (const other of bucket) {
          if (other === ignore) continue;
          const dx = other.x - x;
          const dz = other.z - z;
          if (dx * dx + dz * dz < NPC_SEPARATION * NPC_SEPARATION) return false;
        }
      }
    }
    return true;
  }
}
// Radio de la curva que traza el NPC al cambiar de rumbo, en unidades de mundo
// (~3 anchos de personaje). El giro se deriva de él: ω = v/r. Fijar el radio y no
// los rad/s es lo que evita que bajar npcSpeed convierta la curva en un pivote.
const NPC_TURN_RADIUS = 0.45;
// Amplitud del cambio de rumbo al elegir paseo (±63°). Cuanto más abierto, más
// largo es el arco y más difícil que quepa libre en un mapa de 4×5.
const NPC_HEADING_SPREAD = Math.PI * 0.7;
// Tiempo encajonado tras el cual el NPC busca otra salida en vez de insistir.
const NPC_UNBLOCK_SECONDS = 0.6;
// Cuánto mira hacia delante, en radios de giro. Con 2 ve el obstáculo con el margen
// justo para rodearlo sin frenar: menos y llega pegado, más y esquiva paredes que
// aún le quedan lejos, dando bandazos por el centro del mapa.
const NPC_LOOKAHEAD_TURNS = 2;
// Desvíos que se prueban al buscar salida, de menor a mayor: el primero que quepa
// gana, así que siempre rodea por el lado más suave.
const NPC_ESCAPE_OFFSETS = [0.4, 0.8, 1.2, 1.6, 2.0, 2.4, Math.PI];
// Velocidad que conserva tras un roce (por tick). Frenar del todo obligaba a
// rearrancar desde cero por la rampa, y eso se veía como quedarse plantado.
const NPC_BUMP_KEEP = 0.85;
// Cuánto de ese paso se aprovecha para escurrirse de lado al topar de frente.
const NPC_SLIDE_FACTOR = 0.7;
// Cada NPC anda a su propio ritmo dentro de ±25% del configurado. Sin esto los 32 se
// mueven en bloque, que es lo que delata que son autómatas.
const NPC_SPEED_VARIATION = 0.25;
// Rampas de arranque y frenada, como múltiplo de la velocidad de crucero por segundo:
// arrancar de 0 a tope cuesta ~0.55s y frenar ~0.36s. Antes pasaban de parado a
// velocidad máxima en un tick, y el tirón se notaba.
const NPC_ACCELERATION = 1.8;
const NPC_BRAKING = 2.8;
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
  private readonly crowd = new CrowdGrid();
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
        speedScale: 1 + (this.random() * 2 - 1) * NPC_SPEED_VARIATION,
        velocity: 0,
        aiming: false,
        pose: null,
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
      player.velocity = 0;
      player.aiming = false;
    });

    this.spawnNpcs();
    this.spawnCollectibles();
  }

  private spawnNpcs(): void {
    // Los jugadores ya tienen sitio: se parte de ellos y cada NPC se añade al nacer,
    // que es lo que hace que no se apilen unos sobre otros.
    this.rebuildCrowd();
    for (let i = 0; i < this.config.npcCount; i += 1) {
      const spawn = this.randomWalkablePoint(true);
      const heading = this.random() * Math.PI * 2;
      const npc: SessionNpc = {
        entityId: randomUUID(),
        skinId: (this.players.size + i) % CHARACTER_SKIN_COUNT,
        x: spawn.x,
        z: spawn.z,
        h: spawn.h,
        heading,
        targetHeading: heading,
        mode: "idle",
        modeTime: 0.2 + this.random() * 1.8,
        blockedTime: 0,
        speedScale: 1 + (this.random() * 2 - 1) * NPC_SPEED_VARIATION,
        velocity: 0
      };
      this.npcs.push(npc);
      this.crowd.add(npc);
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

  /**
   * ¿Se puede salir de (x,z) andando? Un punto puede estar libre de edificios y aun así
   * quedar cercado por cuestas: quien nace ahí no se mueve en toda la partida, porque
   * no hay dirección que la pendiente le permita tomar. Basta con que quede alguna.
   */
  private canRoam(x: number, z: number, h: number): boolean {
    const step = Math.max(this.config.heightmap.cell, 0.2);
    for (let i = 0; i < 8; i += 1) {
      const heading = (i * Math.PI) / 4;
      const nx = x + Math.sin(heading) * step;
      const nz = z + Math.cos(heading) * step;
      if (this.insideBounds(nx, nz) && this.walkable(nx, nz, h, step)) return true;
    }
    return false;
  }

  /**
   * `roaming` solo para quien va a andar: necesita sitio libre entre la gente y alguna
   * salida. Un objeto no necesita ninguna de las dos, y exigírselo dejaba sin sitio los
   * mapas pequeños, donde todo punto cae dentro del espacio personal de alguien.
   */
  private randomWalkablePoint(roaming = false): { x: number; z: number; h: number } {
    const { bounds, heightmap } = this.config;
    const usable = (x: number, z: number, h: number | null): h is number =>
      h !== null &&
      !this.blocked(x, z) &&
      (!roaming || (this.clearOfCrowd(x, z) && this.canRoam(x, z, h)));

    for (let i = 0; i < 100; i += 1) {
      const x = bounds.minX + this.random() * (bounds.maxX - bounds.minX);
      const z = bounds.minZ + this.random() * (bounds.maxZ - bounds.minZ);
      const h = sampleHeight(heightmap, x, z);
      if (usable(x, z, h)) return { x, z, h };
    }

    for (let row = 0; row < heightmap.rows; row += 1) {
      for (let col = 0; col < heightmap.cols; col += 1) {
        const x = heightmap.minX + col * heightmap.cell;
        const z = heightmap.minZ + row * heightmap.cell;
        const h = sampleHeight(heightmap, x, z);
        if (usable(x, z, h)) return { x, z, h };
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
    // Se olvida la nave: si no, seguiría dibujada en el cielo tras marcharse.
    player.pose = null;
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

  setAiming(userId: string, aiming: boolean, pose?: SeekerPose): boolean {
    const player = this.players.get(userId);
    if (!player?.present || player.role !== "seeker" || this.roundPhase !== "playing") {
      return false;
    }
    player.aiming = aiming;
    if (pose) player.pose = pose;
    return true;
  }

  /** La nave del cazador, para que el resto de jugadores la vea sobrevolar. */
  seekerSnapshot(): SeekerState | null {
    for (const player of this.players.values()) {
      if (player.role !== "seeker" || !player.present || !player.pose) continue;
      return { ...player.pose, aiming: player.aiming };
    }
    return null;
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
        player.velocity = 0;
        this.crowd.remove(player); // eliminado: su cuerpo deja de estorbar al instante
        shooter.score += GAME_RULES.hiderHitPoints;
        if (this.allHidersFound) this.endRound("all-hiders-found");
        return true;
      }
    }

    const npcIndex = this.npcs.findIndex((npc) => npc.entityId === targetEntityId);
    if (npcIndex < 0) return false;
    this.crowd.remove(this.npcs[npcIndex]);
    this.npcs.splice(npcIndex, 1);
    shooter.score += GAME_RULES.npcHitPoints;
    return true;
  }

  removePlayer(userId: string): GameScoreState | null {
    const player = this.players.get(userId);
    if (!player) return null;
    this.crowd.remove(player);
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

    // Punto de partida limpio para las consultas de separación de este tick: durante
    // él se mantiene al día sola, según cada uno se va moviendo.
    this.rebuildCrowd();

    for (const p of this.players.values()) {
      if (!p.present || !p.alive || p.role === "seeker") continue;
      this.tickPlayer(p, dtSeconds);
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

  /**
   * El humano se mueve con el mismo modelo que la multitud: su propia velocidad de
   * crucero, la misma rampa de arranque y frenada, el mismo radio de giro y la misma
   * separación con los demás. Todo lo que aquí difiriese sería un modo gratis de
   * distinguir a los jugadores sin necesidad de observarles la conducta, que es
   * justo de lo que va la partida.
   */
  private tickPlayer(player: SessionPlayer, dtSeconds: number): void {
    const cruise = this.cruiseSpeed(player.speedScale);
    // Con signo: así andar hacia atrás y soltar la tecla frenan por la misma rampa,
    // sin que al llegar a cero se dé la vuelta.
    const target = cruise * clamp(player.forward, -1, 1);
    const braking = Math.abs(target) < Math.abs(player.velocity);
    const rate = (braking ? NPC_BRAKING : NPC_ACCELERATION) * cruise * dtSeconds;
    player.velocity =
      target > player.velocity
        ? Math.min(target, player.velocity + rate)
        : Math.max(target, player.velocity - rate);

    const moved =
      player.velocity !== 0 && this.moveForward(player, player.velocity * dtSeconds, player);
    // El rumbo solo cambia si de verdad se ha avanzado: pivotar parado delataría al
    // humano, porque nadie más en la multitud lo hace.
    if (moved && player.turn !== 0) {
      player.heading += player.turn * this.turnRate(player.speedScale) * dtSeconds;
    }
    if (!moved) player.velocity = 0; // topar con algo para en seco, igual que un NPC
  }

  private tickNpc(npc: SessionNpc, dtSeconds: number): void {
    // La velocidad persigue a la de crucero por rampa: ni arranca ni frena de golpe.
    const cruise = this.npcCruiseSpeed(npc);
    const target = npc.mode === "walking" ? cruise : 0;
    const rate = (npc.mode === "walking" ? NPC_ACCELERATION : NPC_BRAKING) * cruise * dtSeconds;
    npc.velocity =
      target > npc.velocity
        ? Math.min(target, npc.velocity + rate)
        : Math.max(target, npc.velocity - rate);

    if (npc.mode === "idle") {
      npc.modeTime -= dtSeconds;
      // Aún puede llevar inercia: se le deja recorrerla en vez de clavarse en seco.
      // Si topa con algo, la pierde, igual que andando.
      if (npc.velocity > 0 && !this.moveForward(npc, npc.velocity * dtSeconds, npc)) {
        npc.velocity = 0;
      }
      if (npc.modeTime <= 0) this.chooseNpcHeading(npc);
      return;
    }

    npc.modeTime -= dtSeconds;
    // Anticipación: mira lo que tiene delante y, si está cerrado, elige salida ANTES
    // de llegar. Sin esto se empotraba contra el muro y solo entonces empezaba a
    // girar, pegado a él; ahora lo esquiva trazando la curva, como quien ve venir la
    // pared. La distancia de sondeo es la que necesita para virar sin frenar.
    const lookahead = NPC_TURN_RADIUS * NPC_LOOKAHEAD_TURNS;
    if (!this.wayAhead(npc, npc.heading, lookahead, true)) {
      const escape = this.freeHeading(npc, lookahead, true);
      if (escape !== null) npc.targetHeading = escape;
    }

    const distance = npc.velocity * dtSeconds;
    const moved = this.moveForward(npc, distance, npc);
    // El rumbo se corrige de forma gradual: el NPC describe una curva en lugar de
    // pivotar y arrancar de golpe.
    const difference = this.shortestAngle(npc.targetHeading - npc.heading);
    const turn = this.npcTurnRate(npc) * dtSeconds;
    npc.heading =
      Math.abs(difference) <= turn ? npc.targetHeading : npc.heading + Math.sign(difference) * turn;

    if (moved) {
      npc.blockedTime = 0;
      if (npc.modeTime <= 0) {
        npc.mode = "idle";
        npc.modeTime = 0.4 + this.random() * 1.8;
      }
      return;
    }

    // Única situación en la que gira sin avanzar: encajonado. No pasar por aquí lo
    // condenaba a mirar el obstáculo de por vida, porque parado no cambia de rumbo,
    // y en un minuto se paraba la multitud entera. El cliente lo dibuja caminando
    // (su rumbo cambia), así que se ve dando pasos para encararse, no gravitando.
    if (npc.blockedTime === 0) {
      npc.targetHeading = this.unblockHeading(npc);
      npc.modeTime = Math.max(npc.modeTime, 1);
    }
    npc.blockedTime += dtSeconds;
    // Al agotarse vuelve a 0, que es la señal de reevaluar la salida: el hueco pudo
    // abrirse o cerrarse mientras tanto.
    if (npc.blockedTime >= NPC_UNBLOCK_SECONDS) npc.blockedTime = 0;

    // Frena, pero NO en seco: quien roza a otro al cruzarse aminora el paso y sigue,
    // como en una acera concurrida. Pararlo del todo obligaba a rearrancar desde cero
    // por la rampa cada vez, y eso es lo que se veía como quedarse plantado contra el
    // muro. Mantener algo de velocidad también deja que el giro siga corriendo, así
    // que se despega antes.
    npc.velocity *= NPC_BUMP_KEEP;
    // Y se escurre por el lado libre en cuanto lo hay, sin esperar a virar del todo.
    this.slideAside(npc, npc.velocity * dtSeconds);
  }

  /**
   * Al topar de frente, prueba a desplazarse en perpendicular (a un lado y a otro).
   * Es lo que hace cualquiera al cruzarse con alguien: apartarse un poco sin dejar de
   * andar. Sin esto el NPC se quedaba clavado hasta completar el giro.
   */
  private slideAside(npc: SessionNpc, distance: number): void {
    if (distance <= 0) return;
    const original = npc.heading;
    for (const sign of [1, -1]) {
      npc.heading = original + (Math.PI / 2) * sign;
      const moved = this.moveForward(npc, distance * NPC_SLIDE_FACTOR, npc);
      npc.heading = original;
      if (moved) return;
    }
  }

  /**
   * ¿Queda sitio libre siguiendo `heading` durante `distance`?
   *
   * `crowd` decide si la gente cuenta como obstáculo. Para anticipar un muro NO debe
   * contar: en una multitud siempre hay alguien cruzándose por delante, y tomarlo por
   * un obstáculo hacía que el NPC virase sin parar. La gente se resuelve al llegar,
   * escurriéndose por el eje libre, que es como se esquiva de verdad al caminar.
   */
  private wayAhead(
    npc: SessionNpc,
    heading: number,
    distance: number,
    crowd: boolean
  ): boolean {
    const step = Math.max(this.config.heightmap.cell / 2, 0.1);
    const sin = Math.sin(heading);
    const cos = Math.cos(heading);
    let h = npc.h;
    for (let travelled = step; travelled <= distance; travelled += step) {
      const x = npc.x + sin * travelled;
      const z = npc.z + cos * travelled;
      if (!this.insideBounds(x, z) || !this.walkable(x, z, h, step)) return false;
      if (crowd && !this.clearOfCrowd(x, z, npc)) return false;
      h = sampleHeight(this.config.heightmap, x, z) as number;
    }
    return true;
  }

  /**
   * Salida más barata en giro: se prueban desvíos crecientes a un lado y a otro y se
   * coge el primero libre. Cuanto menos tenga que rotar, más natural se ve el rodeo.
   * `null` = cercado por completo.
   */
  private freeHeading(npc: SessionNpc, distance: number, crowd: boolean): number | null {
    for (const offset of NPC_ESCAPE_OFFSETS) {
      for (const sign of [1, -1]) {
        const heading = npc.heading + offset * sign;
        if (this.wayAhead(npc, heading, distance, crowd)) return heading;
      }
    }
    return null;
  }

  private unblockHeading(npc: SessionNpc): number {
    // Pegado a algo: basta con encontrar por dónde despegarse, no hace falta ver lejos.
    // Aquí la gente sí cuenta: si está atascado, puede ser justamente contra alguien.
    const step = Math.max(this.config.heightmap.cell / 2, 0.12);
    return this.freeHeading(npc, step, true) ?? npc.heading + Math.PI; // cercado: media vuelta
  }

  private chooseNpcHeading(npc: SessionNpc): void {
    for (let i = 0; i < 12; i += 1) {
      const heading = npc.heading + (this.random() - 0.5) * NPC_HEADING_SPREAD;
      const distance = 0.3 + this.random() * 0.6;
      if (this.pathIsClear(npc, heading, distance)) {
        this.startNpcWalk(npc, heading, distance);
        return;
      }
    }
    // Encajonado: ningún trayecto sale limpio. Se arranca igualmente, porque el
    // avance ya va con colisiones y al rozar una pared se desliza, que es como
    // consigue salir. Sin esta válvula se quedaría mirando al muro para siempre,
    // ya que parado no gira.
    this.startNpcWalk(npc, npc.heading + (this.random() - 0.5) * Math.PI * 2, 0.3);
  }

  private startNpcWalk(npc: SessionNpc, heading: number, distance: number): void {
    npc.targetHeading = heading;
    // El giro se consume andando, así que el paseo dura lo que la curva más el
    // tramo recto; si no, se pararía antes de encarar el rumbo elegido.
    npc.modeTime =
      this.turnDuration(npc, npc.heading, heading) + distance / this.npcCruiseSpeed(npc);
    npc.mode = "walking";
  }

  // Velocidad y giro salen de la misma fórmula para humanos y NPC: son la multitud.
  private cruiseSpeed(speedScale: number): number {
    return this.config.npcSpeed * speedScale;
  }

  // Radio de giro constante: quien va más rápido describe una curva más abierta, igual
  // que en la realidad, en vez de girar todos igual de cerrado.
  private turnRate(speedScale: number): number {
    return Math.min(this.config.turnSpeed, this.cruiseSpeed(speedScale) / NPC_TURN_RADIUS);
  }

  private npcCruiseSpeed(npc: SessionNpc): number {
    return this.cruiseSpeed(npc.speedScale);
  }

  private npcTurnRate(npc: SessionNpc): number {
    return this.turnRate(npc.speedScale);
  }

  private turnDuration(npc: SessionNpc, from: number, to: number): number {
    return Math.abs(this.shortestAngle(to - from)) / this.npcTurnRate(npc);
  }

  // Ahora el NPC gira mientras anda, así que su recorrido es un arco más un tramo
  // recto. Se recorre paso a paso: validar la recta al rumbo nuevo lo metería en
  // las paredes justo durante la curva.
  private pathIsClear(npc: SessionNpc, targetHeading: number, distance: number): boolean {
    const step = Math.min(this.config.heightmap.cell / 2, 0.12);
    const cruise = this.npcCruiseSpeed(npc);
    const turn = this.npcTurnRate(npc) * (step / cruise);
    const total = cruise * this.turnDuration(npc, npc.heading, targetHeading) + distance;
    let x = npc.x;
    let z = npc.z;
    let h = npc.h;
    let heading = npc.heading;
    for (let travelled = step; travelled <= total; travelled += step) {
      const difference = this.shortestAngle(targetHeading - heading);
      heading =
        Math.abs(difference) <= turn ? targetHeading : heading + Math.sign(difference) * turn;
      x += Math.sin(heading) * step;
      z += Math.cos(heading) * step;
      if (
        !this.insideBounds(x, z) ||
        !this.walkable(x, z, h, step) ||
        !this.clearOfCrowd(x, z, npc)
      ) {
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

  /**
   * Separación con el resto de la multitud, humanos incluidos. Antes solo miraba a los
   * NPC: los jugadores los atravesaban de lado a lado y los NPC les pasaban por encima,
   * que es lo primero que delataría a un humano en medio del gentío.
   */
  private clearOfCrowd(x: number, z: number, ignore?: MovableState): boolean {
    return this.crowd.isClear(x, z, ignore);
  }

  /** ¿Ocupa sitio en el mapa? El cazador vuela y los eliminados ya no estorban. */
  private hasBody(player: SessionPlayer): boolean {
    // Sin mirar `present` a propósito: su cuerpo ya sale en el snapshot y tiene sitio
    // reservado desde el inicio de ronda. Exigirlo hacía que los NPC nacieran encima
    // de quien aún no se había conectado, y al entrar no podía ni moverse.
    return player.alive && player.role !== "seeker";
  }

  /** Rehace la rejilla de separación desde cero. O(n), una vez por tick. */
  private rebuildCrowd(): void {
    this.crowd.clear();
    for (const npc of this.npcs) this.crowd.add(npc);
    for (const player of this.players.values()) {
      if (this.hasBody(player)) this.crowd.add(player);
    }
  }

  private shortestAngle(angle: number): number {
    if (angle > Math.PI) return angle - Math.PI * 2;
    if (angle < -Math.PI) return angle + Math.PI * 2;
    return angle;
  }

  /**
   * Movimiento compartido: jugadores y NPC obedecen exactamente las mismas colisiones.
   * Con `member` se respeta además la separación con el resto de la multitud, y por eje
   * igual que las paredes: quien topa con otro se escurre a su lado en vez de clavarse.
   * Frenarlo del todo los dejaba encarados y bloqueados para siempre, porque parado no
   * gira.
   */
  private moveForward(entity: MovableState, distance: number, member?: MovableState): boolean {
    const b = this.config.bounds;
    const beforeX = entity.x;
    const beforeZ = entity.z;
    // movimiento por eje → deslizar a lo largo de las paredes; clamp = no salir del área jugable
    const nx = clamp(entity.x + Math.sin(entity.heading) * distance, b.minX, b.maxX);
    if (
      this.walkable(nx, entity.z, entity.h, Math.abs(nx - entity.x)) &&
      (!member || this.clearOfCrowd(nx, entity.z, member))
    ) {
      entity.x = nx;
      entity.h = sampleHeight(this.config.heightmap, entity.x, entity.z) as number;
    }
    const nz = clamp(entity.z + Math.cos(entity.heading) * distance, b.minZ, b.maxZ);
    if (
      this.walkable(entity.x, nz, entity.h, Math.abs(nz - entity.z)) &&
      (!member || this.clearOfCrowd(entity.x, nz, member))
    ) {
      entity.z = nz;
      entity.h = sampleHeight(this.config.heightmap, entity.x, entity.z) as number;
    }
    const moved = entity.x !== beforeX || entity.z !== beforeZ;
    // La rejilla tiene que reflejar la posición nueva antes de la siguiente consulta,
    // o dos que se muevan en el mismo tick podrían acabar uno encima del otro.
    if (moved && member) this.crowd.update(member);
    return moved;
  }

  /**
   * ¿se puede pisar (x,z) viniendo de altura h tras recorrer `distance` en horizontal?
   * No si hay edificio, si no hay suelo, o si la cuesta es demasiado empinada.
   *
   * El criterio es la PENDIENTE, no el desnivel suelto: comparar solo el desnivel lo
   * ataba a la velocidad, porque quien anda despacio salva menos altura por paso y
   * acababa subiendo paredes a base de pasitos. Con la multitud entera a 0.36 eso
   * dejaba escalar cualquier cosa.
   */
  private walkable(x: number, z: number, h: number, distance: number): boolean {
    if (this.blocked(x, z)) return false; // edificio
    const th = sampleHeight(this.config.heightmap, x, z);
    if (th === null) return false; // sin suelo (vacío/borde) → no andas al vacío
    if (distance <= 0) return true; // no hay avance: nada que escalar
    // Solo limita SUBIR. Bajar siempre se puede: frenar también el descenso dejaba
    // encerrado a quien apareciera en una cuesta, sin poder ni dejarse caer.
    return (th - h) / distance <= this.config.maxSlope; // rampa OK; pared NO
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
