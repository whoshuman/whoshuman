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
import { sampleHeight, type Bounds, type Heightmap, type MapPoint, type Obstacle } from "./map";

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
  // Plataformas de la calle: las células nacen SOLO aquí y son también los destinos de
  // la multitud (ver spawnOneCollectible y chooseNpcHeading).
  pads: MapPoint[];
  heightmap: Heightmap; // altura del suelo por celda
  // Pendiente máxima transitable (altura/distancia). En beta-city el terreno andable
  // llega a 0.12 y las paredes arrancan en 1.72, así que cualquier valor intermedio
  // las separa con holgura.
  maxSlope: number;
  npcCount: number;
  // Velocidad de TODA la multitud, humanos incluidos. Ya no existe una velocidad de
  // jugador aparte: tenerla era regalarle al cazador un modo de distinguirlos.
  npcSpeed: number;
  // Por debajo de esto la partida se abandona. Llega en match.found, para que sea el
  // mismo umbral con el que el matchmaking decidió que había gente suficiente.
  minPlayers: number;
  // ── MODO DEBUG: retirar borrando este campo, GameSession.practiceSwitchRole y el
  // "if (this.config.practice ...)" del reloj en tick(). Nada más en este fichero
  // depende de él. Ver también matchmaking.service.ts (lobby "practice") y
  // game.service.ts (donde se pone a partir del lobbyId). ──
  // Partida en solitario contra la multitud, sin cronómetro, para poder alternar el
  // propio rol (cazador ⇄ infiltrado) y ver el juego desde los dos lados.
  practice?: boolean;
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
  // true mientras se está pidiendo "atrás", para dar la vuelta una sola vez al
  // empezar a pedirlo y no en cada tick (ver tickPlayer).
  reversedFacing: boolean;
  // Giro de 180° en curso al pedir "atrás" (ver REVERSE_FLIP_SECONDS en tickPlayer).
  flipping: boolean;
  flipElapsed: number;
  // Radianes del medio giro YA aplicados al heading. El giro se suma en trozos en vez
  // de asignar el rumbo entero: así lo que gire el jugador con `turn` durante esos
  // 0.18 s se conserva, en vez de que el siguiente tick lo pise.
  flipTurned: number;
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
  // Pad hacia el que sesga el rumbo mientras dure, o null si va a su aire (ver
  // chooseNpcHeading). `padIndex` es para el cupo por pad (que no vayan varios al mismo
  // sitio a la vez); `x,z` NO son el pad exacto sino su propio punto de mira, con un
  // desvío al azar: si dos apuntan al mismo centro, sus rutas se pisan y eso es justo el
  // "van de la mano" que se quiere evitar.
  waypoint: { padIndex: number; x: number; z: number } | null;
  waypointExpire: number; // segundos que le quedan antes de soltarlo y volver al azar
  // Lado y fuerza del rodeo hacia el destino, en -1..1, sorteado al coger el waypoint:
  // es lo que convierte la ruta en un arco propio en vez de en la recta que sigue todo
  // el mundo (ver NPC_WAYPOINT_ARC).
  waypointBias: number;
}

const clamp = (v: number, min: number, max: number) => (v < min ? min : v > max ? max : v);
// Distancia mínima entre centros para CUALQUIER par (NPC-NPC, jugador-NPC,
// jugador-jugador): por debajo de esto uno se atravesaría al otro. Bajada de 0.28 a
// petición explícita, para que la multitud vaya más apretada y se pueda llegar a
// rozar sin que eso cuente como colisión.
const NPC_SEPARATION = 0.18;
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

  /** Cuántos miembros (salvo `ignore`) hay dentro de `radius` de (x,z). Radio libre,
   *  no atado a la celda: para medir aglomeración, no colisión. */
  countNearby(x: number, z: number, radius: number, ignore?: MovableState): number {
    const cellRadius = Math.ceil(radius / NPC_SEPARATION);
    const col = Math.floor(x / NPC_SEPARATION) + CROWD_GRID_ORIGIN;
    const row = Math.floor(z / NPC_SEPARATION) + CROWD_GRID_ORIGIN;
    const radiusSq = radius * radius;
    let count = 0;
    for (let dRow = -cellRadius; dRow <= cellRadius; dRow += 1) {
      for (let dCol = -cellRadius; dCol <= cellRadius; dCol += 1) {
        const bucket = this.buckets.get((row + dRow) * CROWD_GRID_STRIDE + col + dCol);
        if (!bucket) continue;
        for (const other of bucket) {
          if (other === ignore) continue;
          const dx = other.x - x;
          const dz = other.z - z;
          if (dx * dx + dz * dz <= radiusSq) count += 1;
        }
      }
    }
    return count;
  }
}
// Radio de la curva que traza el NPC al cambiar de rumbo, en unidades de mundo
// (~3 anchos de personaje). El giro se deriva de él: ω = v/r. Fijar el radio y no
// los rad/s es lo que evita que bajar npcSpeed convierta la curva en un pivote.
// Medio cuerpo. Las entidades se mueven como un punto, pero ocupan sitio: NPC_SEPARATION es
// la distancia minima entre dos centros, asi que la mitad es el radio efectivo. Se usa para
// que el area jugable recorte el CUERPO y no el centro, o los bordes se ven traspasados.
const BODY_RADIUS = NPC_SEPARATION / 2;

// Radio de giro de la multitud. Estaba en 0.45 (diametro 0.9), afinado para beta-city, que
// era un descampado con tres edificios. En una manzana con calles de 0.45 de ancho eso es el
// DOBLE del corredor: el NPC no cabia girando y se quedaba pegado a las paredes describiendo
// curvas que no le entraban. A 0.16 gira dentro de una calzada.
//
// De paso acerca su agilidad a la del jugador (3 rad/s): con 0.45 giraba a 0.8 rad/s y eso
// era un delator, porque en este juego el cazador tiene que confundir humanos con NPC.
const NPC_TURN_RADIUS = 0.22;
// Amplitud del cambio de rumbo al elegir paseo (±63°). Cuanto más abierto, más
// largo es el arco y más difícil que quepa libre en un mapa de 4×5.
const NPC_HEADING_SPREAD = Math.PI * 0.7;
// Con qué probabilidad, al agotar el tramo, un NPC sin waypoint se pone en camino a un
// pad en vez de tirar rumbo al azar. Cada NPC tira su propio dado, así que no hay reloj
// compartido que los sincronice.
//
// Antes los destinos eran las 7 células, y con tan pocos sitios adonde ir la multitud se
// juntaba en pelotones camino del mismo puñado de puntos; por eso la probabilidad tenía
// que ser baja (0.2). Ahora los destinos son los pads —decenas repartidos por toda la
// calle—, así que caminar con intención ya no amontona: se puede subir.
const NPC_WAYPOINT_CHANCE = 0.32;
// Cono al caminar HACIA el waypoint: bastante más cerrado que el paseo libre, para
// que la curva se note dirigida en vez de errática, pero sin ser una línea recta
// (un beeline exacto se ve tan artificial como el azar puro).
const NPC_WAYPOINT_SPREAD = Math.PI * 0.32;
// Tiempo máximo enganchado a un pad antes de soltarlo y volver al azar: si queda
// detrás de un muro que no rodea a tiempo, no se queda mirándolo para siempre.
const NPC_WAYPOINT_BUDGET_S = 8;
// A esta distancia se da por "llegado" y suelta el waypoint (algo mayor que el radio
// real de recogida: no hace falta pisarlo, solo pasar cerca, como haría cualquiera).
const NPC_WAYPOINT_ARRIVE = 0.4;
// Cuántos NPC pueden llevar el MISMO pad de waypoint a la vez. Con 1 nunca hay dos
// convergiendo al mismo punto exacto: es justo el "van de la mano" que se nota.
const NPC_WAYPOINT_MAX_CLAIMS = 1;
// Cada NPC apunta a un punto propio alrededor del pad, no a su centro exacto: con
// el mismo centro, dos rutas que pasen cerca se pisan y parecen una sola fila. El
// desvío se sortea una vez por waypoint, no por tick, así que la ruta sigue siendo
// una curva firme, no un temblor.
const NPC_WAYPOINT_OFFSET = 0.35;
// Cuánto se aparta de la línea recta el que va a un destino, en unidades de mundo, estando
// lejos. Sin esto la ruta era el segmento recto entre el NPC y su pad, y varios saliendo de
// zonas parecidas hacia lados parecidos dibujaban líneas paralelas: un pelotón. El signo y
// la fuerza se sortean UNA vez por waypoint (npc.waypointBias), así que cada uno describe
// su propio arco y ninguno serpentea por el camino. 0.8 en un mapa de 5×4 es medio ancho
// de calle: se ve el rodeo sin que parezca que va a otro sitio.
const NPC_WAYPOINT_ARC = 0.8;
// Distancia a partir de la cual el arco va a plena anchura. Más cerca se cierra solo,
// proporcionalmente: rodear tiene sentido de lejos, pero a dos pasos del destino hay
// que encararlo o se pasaría de largo dando vueltas.
const NPC_WAYPOINT_ARC_FADE = 1.6;
// Radio (bastante mayor que NPC_SEPARATION) en el que se cuenta cuánta gente hay ya
// para preferir zonas menos concurridas en el paseo libre. Ni una manzana entera ni
// un cuerpo: lo bastante ancho para notar "aquí hay aglomeración" antes de meterse.
const NPC_SPREAD_RADIUS = 1.2;
// Mínimo de rumbos válidos que prueba antes de conformarse, aunque el primero ya
// saliera con densidad 0: con 1 solo intento no hay entre qué elegir de verdad.
const NPC_SPREAD_MIN_SAMPLES = 3;
// Tiempo encajonado tras el cual el NPC busca otra salida en vez de insistir.
const NPC_UNBLOCK_SECONDS = 0.6;
// Cuánto mira hacia delante, en radios de giro. Con 2 ve el obstáculo con el margen
// justo para rodearlo sin frenar: menos y llega pegado, más y esquiva paredes que
// aún le quedan lejos, dando bandazos por el centro del mapa.
// Distancia de sondeo, en radios de giro. Con el radio antiguo sondeaba 0.9 u, o sea dos
// calzadas enteras: casi cualquier rumbo daba "cerrado" y la multitud vivia en modo escape.
const NPC_LOOKAHEAD_TURNS = 2.5;
// Desvíos que se prueban al buscar salida, de menor a mayor: el primero que quepa
// gana, así que siempre rodea por el lado más suave.
const NPC_ESCAPE_OFFSETS = [0.4, 0.8, 1.2, 1.6, 2.0, 2.4, Math.PI];
// Velocidad que conserva tras un roce (por tick). Frenar del todo obligaba a
// rearrancar desde cero por la rampa, y eso se veía como quedarse plantado.
const NPC_BUMP_KEEP = 0.85;
// Cuánto de ese paso se aprovecha para escurrirse de lado al topar de frente.
const NPC_SLIDE_FACTOR = 0.7;
// Variación de ritmo por individuo, como fracción de la velocidad configurada. A CERO
// a propósito: la regla es que nadie va más rápido ni más lento que nadie, ni NPC ni
// humano. Estuvo en 0.25 para que la multitud no pareciera un banco de peces, pero ese
// dado se lo llevaba también el jugador: le tocaba su ritmo al empezar la partida y se
// lo quedaba las tres rondas, así que había partidas a 0.29 y partidas a 0.43 (49% de
// diferencia) rodeado siempre de algún NPC cerca del tope. Se notaba como "hoy voy
// lento" y era exactamente eso. La multitud parece viva por su forma de andar —
// rumbos, esperas, rodeos—, no por ir cada uno a una velocidad distinta.
const NPC_SPEED_VARIATION = 0;
// Rampas de arranque y frenada, como múltiplo de la velocidad de crucero por segundo:
// arrancar de 0 a tope cuesta ~0.55s y frenar ~0.36s. Antes pasaban de parado a
// velocidad máxima en un tick, y el tirón se notaba.
const NPC_ACCELERATION = 1.8;
const NPC_BRAKING = 2.8;
// Duración del giro de 180° al pedir "atrás" (tickPlayer). Antes era un salto en un
// solo tick y se veía como un corte brusco; con esto sigue siendo una acción, no una
// rotación sostenida, pero se ve como un giro rápido en vez de un chasquido.
const REVERSE_FLIP_SECONDS = 0.18;
// Cuánto hay que pedir "atrás" para que cuente como querer darse la vuelta. El teclado
// manda -1, así que le da igual; el umbral es para el joystick del móvil, donde el
// valor es analógico y pasar la zona muerta (0.12) no es una intención, es el pulgar.
const REVERSE_TRIGGER = 0.6;
// Nº de modelos en apps/frontend/public/models/personajes: el cliente indexa por skinId.
const CHARACTER_SKIN_COUNT = 4;
// Separación a la que se deja de buscar sitio para una célula: no es un mínimo duro,
// es el "ya está bastante lejos" que corta la búsqueda de mejor candidato. En el mapa
// real (5×4 con manzanas) 7 células no pueden estar mucho más repartidas que esto.
const COLLECTIBLE_SEPARATION = 1;
// Cuántos pads se sortean antes de quedarse con el más despejado. Más candidatos =
// reparto más regular; 24 ya deja el mapa cubierto sin que se note el coste (solo se
// paga al empezar la ronda y en cada respawn suelto).
const COLLECTIBLE_SPAWN_CANDIDATES = 24;
// Un pad cuenta como ocupado si ya hay una célula a menos de esto. Las células nacen
// clavadas en el centro del pad, así que basta con un margen de coma flotante.
const PAD_TAKEN_RADIUS = 0.1;
// Nadie recibe una célula en las narices: al reponer, se descartan los pads con algún
// infiltrado vivo a menos de esta distancia. Es la regla anticamping — plantarse encima
// de un pad y esperar no da puntos, porque justamente ahí no va a nacer nada.
//
// Menor que la separación entre pads (1.1 en neon-block), así que cada uno tapa el suyo y
// nada más. Con eso sale la cuenta del peor caso: 8 jugadores como mucho → 7 infiltrados
// tapando 7 pads, más las 7 células ya puestas, son 14 pads ocupados de los 16 del mapa;
// siempre queda sitio libre donde reponer. Por eso el mapa no puede traer menos.
const PAD_CAMP_CLEARANCE = 0.9;

interface PendingCollectible {
  respawnAt: number;
}

export const GAME_RULES = {
  totalRounds: 3,
  roundSeconds: 90,
  intermissionSeconds: 5,
  collectibleCount: 7,
  collectibleRespawnSeconds: 3,
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
  private readonly pendingCollectibles: PendingCollectible[] = [];
  private readonly config: GameSessionConfig;
  private elapsedSeconds = 0;
  private randomSeed: number;
  private seekerUserId: string;
  private roundNumber = 1;
  private roundPhase: GameRoundPhase = "playing";
  private remainingSeconds: number = GAME_RULES.roundSeconds;
  private roundEndReason: GameRoundEndReason = null;
  // La ronda en curso se anuló (se fue el cazador) y toca repetirla con el mismo
  // número en vez de avanzar al siguiente.
  private roundRestart = false;
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
        present: false,
        reversedFacing: false,
        flipping: false,
        flipTurned: 0,
        flipElapsed: 0
      });
    });

    this.resetRoundWorld(false);
  }

  private resetRoundWorld(rotateSeeker: boolean): void {
    const userIds = [...this.players.keys()];
    if (rotateSeeker && userIds.length > 0 && this.seekerUserId) {
      // Si el cazador anterior abandonó ya no está en la lista, indexOf da -1 y el
      // turno arranca por el primero. Es justo lo que queremos al reiniciar una ronda
      // por su marcha: alguien tiene que heredar el rol.
      const current = userIds.indexOf(this.seekerUserId);
      this.seekerUserId = userIds[(current + 1 + userIds.length) % userIds.length];
    }

    this.npcs.length = 0;
    this.collectibles.length = 0;
    this.pendingCollectibles.length = 0;
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
      player.reversedFacing = false;
      player.flipping = false;
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
        velocity: 0,
        waypoint: null,
        waypointExpire: 0,
        waypointBias: 0
      };
      this.npcs.push(npc);
      this.crowd.add(npc);
    }
  }

  // Las celulas nacen SOLO en los pads del mapa. Hubo dos intentos antes: puntos fijos
  // (7 "cruces", 4 de ellos en las esquinas, siempre los mismos) y sorteo libre por toda
  // el area jugable (repartido, pero nacian en mitad de la nada y no habia forma de saber
  // donde mirar). Los pads son muchos y estan dibujados en el suelo: se ve de antemano
  // donde puede salir algo, y aun asi no se puede predecir en cual.
  private spawnCollectibles(): void {
    for (let i = 0; i < GAME_RULES.collectibleCount; i += 1) {
      this.collectibles.push(this.spawnOneCollectible());
    }
  }

  /**
   * Pad para una célula, elegido por "mejor candidato": se sortean varios pads libres y
   * se elige el que MÁS lejos cae de la célula más cercana, en vez de quedarse con el
   * primero que respete una distancia mínima.
   *
   * El azar uniforme agrupa: con solo un mínimo corto salían racimos en un lado del mapa
   * y media manzana vacía, porque en cuanto el primero valía se dejaba de buscar. Así el
   * reparto tiende a rejilla sin dejar de ser aleatorio, y encima nunca falla: si el mapa
   * no da para COLLECTIBLE_SEPARATION, se queda con lo mejor que haya encontrado en vez
   * de rendirse y soltarla encima de otra.
   *
   * La usan tanto el reparto inicial como cada respawn, así que una recién repuesta
   * también busca el hueco más despejado que quede.
   */
  private spawnOneCollectible(): GameCollectibleState {
    const free = this.freePads();
    let best = free[Math.floor(this.random() * free.length)];
    let bestGap = this.nearestCollectibleDistance(best.x, best.z);
    for (
      let attempt = 1;
      attempt < COLLECTIBLE_SPAWN_CANDIDATES && bestGap < COLLECTIBLE_SEPARATION;
      attempt += 1
    ) {
      const candidate = free[Math.floor(this.random() * free.length)];
      const gap = this.nearestCollectibleDistance(candidate.x, candidate.z);
      if (gap > bestGap) {
        best = candidate;
        bestGap = gap;
      }
    }
    // Nunca es null con un mapa cargado por loadMap, que rechaza los pads sin suelo
    // debajo (ver padProblem). El 0 es para las sesiones de prueba, que arman la config
    // a mano y no pasan por esa puerta.
    const height = sampleHeight(this.config.heightmap, best.x, best.z) ?? 0;
    return { collectibleId: randomUUID(), x: best.x, y: height + 0.14, z: best.z };
  }

  /**
   * Pads donde puede nacer una célula: ni los que ya tienen una, ni aquellos sobre los
   * que hay alguien esperando (ver PAD_CAMP_CLEARANCE). Esto último es lo que hace que
   * quedarse plantado en un pad no dé puntos: mientras se esté encima, ahí no sale nada.
   *
   * Los descartes se van soltando en orden si dejan la lista vacía —primero el de la
   * gente, después el de las células—, porque el reparto no puede quedarse sin sitio en
   * un mapa con pocos pads. Vaciarse del todo es imposible: el mapa no carga sin pads.
   */
  private freePads(): MapPoint[] {
    const taken = (pad: MapPoint) =>
      this.collectibles.some(
        (item) => Math.hypot(item.x - pad.x, item.z - pad.z) < PAD_TAKEN_RADIUS
      );
    const camped = (pad: MapPoint) => {
      for (const player of this.players.values()) {
        if (!player.alive || player.role === "seeker") continue;
        if (Math.hypot(player.x - pad.x, player.z - pad.z) < PAD_CAMP_CLEARANCE) return true;
      }
      return false;
    };
    const free = this.config.pads.filter((pad) => !taken(pad) && !camped(pad));
    if (free.length > 0) return free;
    const sinCelula = this.config.pads.filter((pad) => !taken(pad));
    return sinCelula.length > 0 ? sinCelula : this.config.pads;
  }

  /** Distancia a la célula ya colocada más cercana. Infinito si aún no hay ninguna. */
  private nearestCollectibleDistance(x: number, z: number): number {
    let nearest = Infinity;
    for (const item of this.collectibles) {
      nearest = Math.min(nearest, Math.hypot(item.x - x, item.z - z));
    }
    return nearest;
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
      // Se muestrea en todo el area y luego se mete el punto hacia dentro medio cuerpo, en
      // vez de muestrear ya sobre el area encogida: asi la mayoria de puntos caen donde
      // caian y solo se corrigen los del borde. Reescalar el rango entero recolocaba a toda
      // la multitud y cambiaba como se estorban entre si.
      const x = clamp(
        bounds.minX + this.random() * (bounds.maxX - bounds.minX),
        bounds.minX + BODY_RADIUS,
        bounds.maxX - BODY_RADIUS
      );
      const z = clamp(
        bounds.minZ + this.random() * (bounds.maxZ - bounds.minZ),
        bounds.minZ + BODY_RADIUS,
        bounds.maxZ - BODY_RADIUS
      );
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

  // MODO DEBUG: retirar junto con el campo `practice` de arriba.
  // Alterna al jugador entre cazador e infiltrado sin pasar por intermision. Como
  // infiltrado nace en un punto libre nuevo; como cazador no necesita posicion en
  // el suelo, la nave la lleva el propio cliente.
  practiceSwitchRole(userId: string): boolean {
    if (!this.config.practice) return false;
    const player = this.players.get(userId);
    if (!player) return false;

    if (player.role === "seeker") {
      const spawn = this.randomWalkablePoint(true);
      player.role = "hider";
      player.x = spawn.x;
      player.z = spawn.z;
      player.h = spawn.h;
      player.alive = true;
      this.seekerUserId = "";
    } else {
      player.role = "seeker";
      this.seekerUserId = userId;
    }
    player.forward = 0;
    player.turn = 0;
    player.velocity = 0;
    player.aiming = false;
    player.reversedFacing = false;
    player.flipping = false;
    return true;
  }

  removePlayer(userId: string): GameScoreState | null {
    const player = this.players.get(userId);
    if (!player) return null;
    this.crowd.remove(player);
    this.players.delete(userId);

    // El orden manda: quedarse sin gente gana sobre cualquier otra consecuencia.
    if (this.players.size < this.config.minPlayers) {
      this.abortGame();
    } else if (this.roundPhase === "playing" && player.role === "seeker") {
      // Sin cazador la ronda ya no se puede jugar: nadie ve la nave ni puede
      // disparar, así que correría en vacío hasta agotar el reloj.
      this.restartRound();
    } else if (this.roundPhase === "playing" && this.allHidersFound) {
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
    this.elapsedSeconds += dtSeconds;
    // MODO DEBUG: en practice la ronda no se acaba por reloj. La INTERMISIÓN sí lo
    // gasta igual: es lo único que la saca de ahí, y sin esto una ronda que terminase
    // por otra vía (restartRound al irse el cazador, con más de uno en la cola) dejaba
    // la sesión congelada para siempre en la pantalla de intermisión.
    if (!this.config.practice || this.roundPhase === "intermission") {
      this.remainingSeconds = Math.max(0, this.remainingSeconds - dtSeconds);
    }
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
    this.respawnCollectibles();
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
        this.pendingCollectibles.push({
          respawnAt: this.elapsedSeconds + GAME_RULES.collectibleRespawnSeconds
        });
        player.score += GAME_RULES.collectiblePoints;
      }
    }
  }

  // Repone en un punto NUEVO, no en el que se cogió: si volviera al mismo sitio, un
  // hider parado encima la recogería sola nada más cumplirse el delay.
  private respawnCollectibles(): void {
    for (let i = this.pendingCollectibles.length - 1; i >= 0; i -= 1) {
      const pending = this.pendingCollectibles[i];
      if (pending.respawnAt > this.elapsedSeconds) continue;
      this.pendingCollectibles.splice(i, 1);
      this.collectibles.push(this.spawnOneCollectible());
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
    this.stopEveryone();
    if (this.roundNumber >= GAME_RULES.totalRounds) {
      this.roundPhase = "finished";
      this.remainingSeconds = 0;
      return;
    }
    this.roundPhase = "intermission";
    this.remainingSeconds = GAME_RULES.intermissionSeconds;
  }

  /**
   * Corta la partida por abandono. No es un endRound porque tiene que funcionar
   * también desde la intermisión, y porque la ronda a medias no cuenta: no entra en
   * completedRounds ni se guarda nada de esta partida.
   */
  private abortGame(): void {
    if (this.roundPhase === "finished") return;
    this.stopEveryone();
    this.roundEndReason = "abandoned";
    this.roundPhase = "finished";
    this.remainingSeconds = 0;
  }

  /**
   * Anula la ronda en curso y la programa de nuevo con el mismo número: pasa por la
   * intermisión para que a todos les dé tiempo a leer por qué se ha reiniciado.
   */
  private restartRound(): void {
    this.stopEveryone();
    this.roundEndReason = "seeker-left";
    this.roundPhase = "intermission";
    this.remainingSeconds = GAME_RULES.intermissionSeconds;
    this.roundRestart = true;
  }

  private stopEveryone(): void {
    for (const player of this.players.values()) {
      player.forward = 0;
      player.turn = 0;
      player.aiming = false;
    }
  }

  private startNextRound(): void {
    // Una ronda anulada se repite, no avanza.
    if (!this.roundRestart) this.roundNumber += 1;
    this.roundRestart = false;
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

    // "Atrás" no es marcha atrás: es la ACCIÓN de darse la vuelta, de un solo tirón
    // (no una rotación que se sostiene mientras se aguanta la tecla), y a partir de ahí
    // se anda de frente en la nueva dirección — nadie en este juego camina de espaldas.
    // El giro en sí dura REVERSE_FLIP_SECONDS para no verse como un salto en seco.
    // reversedFacing marca que el giro YA se disparó: sin él, cada tick que se
    // mantenga pulsado dispararía otro medio giro y acabaría dando vueltas sobre sí
    // mismo en vez de quedarse mirando para atrás.
    //
    // Hace falta pedirlo A PROPÓSITO (REVERSE_TRIGGER): en teclado `forward` es -1/0/1,
    // pero con joystick es analógico y el pulgar cruza el cero constantemente al trazar
    // el arco de un giro. Disparando con cualquier valor negativo, rozar la zona muerta
    // (~5 px de stick) bastaba para media vuelta + parada en seco, y encadenadas dejaban
    // al personaje girando sobre sí mismo sin avanzar: medido, 34 medias vueltas y 1/18
    // del recorrido en 10 s. Entre 0 y -REVERSE_TRIGGER no se pide nada.
    if (player.forward < -REVERSE_TRIGGER && !player.reversedFacing && !player.flipping) {
      player.flipping = true;
      player.flipTurned = 0;
      player.flipElapsed = 0;
      player.reversedFacing = true;
      // Se para en seco al empezar a girar: si arrastrara la velocidad que ya llevaba
      // saldría derrapando en la vieja dirección mientras gira, en vez de plantarse.
      player.velocity = 0;
    } else if (player.forward >= 0 && !player.flipping) {
      player.reversedFacing = false;
    }

    if (player.flipping) {
      player.flipElapsed += dtSeconds;
      const t = Math.min(1, player.flipElapsed / REVERSE_FLIP_SECONDS);
      // ease-out: arranca rápido y se asienta, no lineal ni instantáneo.
      const eased = 1 - (1 - t) * (1 - t);
      // Se suma lo que falta por girar, no se asigna el rumbo entero: asignándolo, el
      // giro que el jugador metiera con `turn` se perdía al tick siguiente.
      const turned = Math.PI * eased;
      player.heading += turned - player.flipTurned;
      player.flipTurned = turned;
      if (t >= 1) player.flipping = false;
    }

    // De aquí en adelante solo cuenta la magnitud: el giro de arriba ya puso (o está
    // poniendo) el rumbo en la dirección pedida, así que "atrás" ya no invierte el
    // sentido del avance. Mientras gira no anda: es un giro sobre el sitio, no un
    // arco caminando — si no, con el heading todavía a medio girar el paso saldría
    // en diagonal en vez de hacia donde estaba mirando.
    //
    // Un "atrás" que no llega al umbral tampoco es un "adelante": se deja de pedir
    // marcha y se frena por la rampa. Tomarlo como magnitud haría andar hacia delante
    // a quien está tirando del stick justo al revés.
    const requested = player.forward < 0 && !player.reversedFacing ? 0 : Math.abs(player.forward);
    const target = player.flipping ? 0 : cruise * clamp(requested, 0, 1);
    const braking = target < player.velocity;
    const rate = (braking ? NPC_BRAKING : NPC_ACCELERATION) * cruise * dtSeconds;
    player.velocity =
      target > player.velocity
        ? Math.min(target, player.velocity + rate)
        : Math.max(target, player.velocity - rate);

    const moved =
      player.velocity !== 0 && this.moveForward(player, player.velocity * dtSeconds, player);
    // El giro debe responder también estando quieto: en móvil, desplazar el joystick
    // horizontalmente produce turn sin forward y antes no hacía absolutamente nada.
    if (player.turn !== 0) {
      player.heading += player.turn * this.turnRate() * dtSeconds;
    }
    // Topar con algo aminora, NO para en seco. Antes el jugador se quedaba a cero mientras
    // los NPC conservaban NPC_BUMP_KEEP, asi que bastaba con mirar como reacciona alguien al
    // rozar una pared para saber si era humano. En un juego que va de no distinguirlos, eso
    // era un delator: humanos y multitud comparten ahora la misma fisica de choque.
    if (!moved) {
      player.velocity *= NPC_BUMP_KEEP;
      // A los NPC esto ya les tocaba (ver tickNpc): sin ella, rozar una esquina en las
      // calles estrechas del mapa real dejaba al jugador perdiendo velocidad en cada
      // roce mientras el NPC se escurría y seguía — la causa real de que "el jugador
      // vaya más lento" pese a compartir fórmula de velocidad.
      this.slideAside(player, player.velocity * dtSeconds);
    }
  }

  private tickNpc(npc: SessionNpc, dtSeconds: number): void {
    if (npc.waypoint) {
      npc.waypointExpire -= dtSeconds;
      if (npc.waypointExpire <= 0) npc.waypoint = null;
    }
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
      // Antes de aqui pasaba por "idle" un rato al agotar el tramo: la multitud se
      // paraba en seco cada pocos segundos. Encadenar el siguiente tramo sin soltar
      // la marcha la mantiene fluida; el giro entre tramos ya se traza como curva.
      if (npc.modeTime <= 0) this.chooseNpcHeading(npc);
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
   * andar. Sin esto se queda clavado hasta completar el giro — genérico (jugador o
   * NPC) porque solo toca `.heading`, que comparten los dos.
   */
  private slideAside(entity: MovableState, distance: number): void {
    if (distance <= 0) return;
    const original = entity.heading;
    for (const sign of [1, -1]) {
      entity.heading = original + (Math.PI / 2) * sign;
      const moved = this.moveForward(entity, distance * NPC_SLIDE_FACTOR, entity);
      entity.heading = original;
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
  private wayAhead(npc: SessionNpc, heading: number, distance: number, crowd: boolean): boolean {
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

  /** Cuántos NPC llevan ya cada pad como waypoint, para no pasar de NPC_WAYPOINT_MAX_CLAIMS. */
  private waypointClaims(): Map<number, number> {
    const claims = new Map<number, number>();
    for (const other of this.npcs) {
      if (!other.waypoint) continue;
      claims.set(other.waypoint.padIndex, (claims.get(other.waypoint.padIndex) ?? 0) + 1);
    }
    return claims;
  }

  private chooseNpcHeading(npc: SessionNpc): void {
    // Sin waypoint en curso, a veces se pone en camino a un pad: así el paseo parece que
    // va a algún sitio en vez de ser puro azar local. Ver NPC_WAYPOINT_CHANCE.
    //
    // Los destinos son los pads y no las células a propósito. Las células son 7 y además
    // van cambiando de sitio al recogerse; los pads son 16 y están fijos y repartidos por
    // toda la calle, así que hay más sitios adonde ir y ninguno se mueve bajo los pies de
    // quien iba hacia él. De paso, caminar hacia donde nacen las células es lo que haría
    // cualquier vecino, así que el cazador tampoco puede distinguir a nadie por adónde va.
    if (!npc.waypoint && this.random() < NPC_WAYPOINT_CHANCE) {
      const claims = this.waypointClaims();
      const eligible: number[] = [];
      for (let index = 0; index < this.config.pads.length; index += 1) {
        if ((claims.get(index) ?? 0) < NPC_WAYPOINT_MAX_CLAIMS) eligible.push(index);
      }
      if (eligible.length > 0) {
        const padIndex = eligible[Math.floor(this.random() * eligible.length)];
        const target = this.config.pads[padIndex];
        // Punto de mira propio alrededor del pad, no su centro: si el desvío
        // fuera 0, dos NPC que se cruzaran de camino al mismo sitio pisarían la misma
        // línea y eso es exactamente lo que se veía como "ir de la mano".
        const angle = this.random() * Math.PI * 2;
        const offset = this.random() * NPC_WAYPOINT_OFFSET;
        npc.waypoint = {
          padIndex,
          x: target.x + Math.sin(angle) * offset,
          z: target.z + Math.cos(angle) * offset
        };
        npc.waypointExpire = NPC_WAYPOINT_BUDGET_S;
        // El lado del rodeo se sortea aquí y no en cada tramo: el arco tiene que ser el
        // mismo durante todo el viaje, o la ruta serpentea en vez de curvarse.
        npc.waypointBias = this.random() * 2 - 1;
      }
    }

    const heldWaypoint = npc.waypoint;
    // sin(heading)/cos(heading) son dx/dz en moveForward: atan2(dx,dz) es la fórmula
    // inversa, el rumbo que apunta exactamente al waypoint.
    const aim = heldWaypoint ? this.waypointAim(npc) : null;
    const center = aim ? Math.atan2(aim.x - npc.x, aim.z - npc.z) : npc.heading;
    const spread = heldWaypoint ? NPC_WAYPOINT_SPREAD : NPC_HEADING_SPREAD;

    // Entre los rumbos que caben no se queda con el primero: prueba varios y prefiere el
    // que lleva a una zona menos concurrida (NPC_SPREAD_RADIUS, bastante más ancho que la
    // separación de cuerpo). Sin esto el azar puro amontona la multitud en la parte más
    // abierta del mapa, porque ahí caben más rumbos válidos y nunca hay presión para
    // repartirse.
    //
    // Vale igual con destino que sin él. Antes el que iba a un sitio cogía el PRIMER rumbo
    // que cupiera, y ahí estaba el pelotón: dos que fueran a pads vecinos elegían el mismo
    // hueco entre edificios y acababan andando pegados en fila. Ahora el destino manda la
    // dirección general (el cono es más cerrado, NPC_WAYPOINT_SPREAD) pero el carril lo
    // elige cada uno por donde hay menos gente.
    let best: { heading: number; distance: number; density: number } | null = null;
    let tried = 0;
    for (let i = 0; i < 12; i += 1) {
      const heading = center + (this.random() - 0.5) * spread;
      const distance = 0.3 + this.random() * 0.6;
      if (!this.pathIsClear(npc, heading, distance)) continue;
      tried += 1;
      const nx = npc.x + Math.sin(heading) * distance;
      const nz = npc.z + Math.cos(heading) * distance;
      const density = this.crowd.countNearby(nx, nz, NPC_SPREAD_RADIUS, npc);
      if (!best || density < best.density) best = { heading, distance, density };
      if (density === 0 && tried >= NPC_SPREAD_MIN_SAMPLES) break;
    }
    if (best) {
      this.startNpcWalk(npc, best.heading, best.distance);
      if (
        heldWaypoint &&
        Math.hypot(heldWaypoint.x - npc.x, heldWaypoint.z - npc.z) <= NPC_WAYPOINT_ARRIVE
      ) {
        npc.waypoint = null;
      }
      return;
    }
    // Encajonado: ningún trayecto sale limpio. Se arranca igualmente, porque el
    // avance ya va con colisiones y al rozar una pared se desliza, que es como
    // consigue salir. Sin esta válvula se quedaría mirando al muro para siempre,
    // ya que parado no gira. Suelta el waypoint: si el sitio no dejaba ni un hueco
    // libre, insistir en él solo lo dejaría encajonado otra vez a la próxima.
    npc.waypoint = null;
    this.startNpcWalk(npc, npc.heading + (this.random() - 0.5) * Math.PI * 2, 0.3);
  }

  /**
   * Adónde mira de verdad el que va a un pad: NO al pad, sino a un punto apartado en
   * perpendicular que se va cerrando conforme se acerca. Eso convierte el trayecto en un
   * arco —se sale por un lado y entra girando— en vez de en el segmento recto entre los
   * dos puntos, que es lo que dibujaba carriles paralelos cuando varios salían de zonas
   * parecidas hacia el mismo lado del mapa.
   *
   * Se corrige el PUNTO y no el ángulo: el rumbo de cada tramo se sortea dentro de un cono
   * y luego se elige por gente, así que un sesgo angular se lo comía el propio sorteo. El
   * punto, en cambio, manda sobre todo el mecanismo.
   */
  private waypointAim(npc: SessionNpc): MapPoint {
    const waypoint = npc.waypoint as { padIndex: number; x: number; z: number };
    const dx = waypoint.x - npc.x;
    const dz = waypoint.z - npc.z;
    const remaining = Math.hypot(dx, dz);
    if (remaining < 1e-6) return waypoint;
    const closing = Math.min(1, remaining / NPC_WAYPOINT_ARC_FADE);
    const side = npc.waypointBias * NPC_WAYPOINT_ARC * closing;
    // Perpendicular unitaria a la línea que lo une con el pad.
    return { x: waypoint.x + (dz / remaining) * side, z: waypoint.z - (dx / remaining) * side };
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
  private turnRate(): number {
    return Math.min(this.config.turnSpeed, this.config.npcSpeed / NPC_TURN_RADIUS);
  }

  private npcCruiseSpeed(npc: SessionNpc): number {
    return this.cruiseSpeed(npc.speedScale);
  }

  private npcTurnRate(npc: SessionNpc): number {
    return Math.min(this.config.turnSpeed, this.npcCruiseSpeed(npc) / NPC_TURN_RADIUS);
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
    // movimiento por eje → deslizar a lo largo de las paredes; clamp = no salir del área
    // jugable. El margen es medio cuerpo: recortando el centro contra el borde exacto, la
    // mitad del personaje quedaba fuera del mapa y se veía asomar por el canto.
    const nx = clamp(
      entity.x + Math.sin(entity.heading) * distance,
      b.minX + BODY_RADIUS,
      b.maxX - BODY_RADIUS
    );
    if (
      this.walkable(nx, entity.z, entity.h, Math.abs(nx - entity.x)) &&
      (!member || this.clearOfCrowd(nx, entity.z, member))
    ) {
      entity.x = nx;
      entity.h = sampleHeight(this.config.heightmap, entity.x, entity.z) as number;
    }
    const nz = clamp(
      entity.z + Math.cos(entity.heading) * distance,
      b.minZ + BODY_RADIUS,
      b.maxZ - BODY_RADIUS
    );
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
