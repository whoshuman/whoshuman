import { GAME_RULES, GameSession } from "./game-session";
import { loadMap, type Heightmap } from "./map";

// construye un heightmap sobre [minX,maxX]×[minZ,maxZ] con altura dada por f(x,z)
const makeHM = (
  minX: number,
  minZ: number,
  maxX: number,
  maxZ: number,
  cell: number,
  f: (x: number, z: number) => number | null
): Heightmap => {
  const cols = Math.round((maxX - minX) / cell) + 1;
  const rows = Math.round((maxZ - minZ) / cell) + 1;
  const data: (number | null)[] = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) data.push(f(minX + c * cell, minZ + r * cell));
  return { minX, minZ, cell, cols, rows, data };
};
const flatHM = makeHM(-10, -5, 10, 5, 5, () => 0);

// Pads del mapa de pruebas. Van pegados al origen porque varias pruebas encogen el mapa
// a 0.1×0.1 alrededor del jugador, y las células nacen SOLO en pads: fuera de esa caja
// no se podrían ni recoger.
const pads = [
  { x: 0, z: 0 },
  { x: 0.02, z: 0.01 },
  { x: -0.02, z: 0.01 },
  { x: 0.01, z: -0.02 },
  { x: -0.01, z: -0.02 },
  { x: 0.03, z: -0.01 },
  { x: -0.03, z: -0.01 },
  { x: 0.015, z: 0.025 },
  { x: -0.015, z: 0.025 }
];

// Copia del PAD_CAMP_CLEARANCE del código: es el radio que la sesión deja libre alrededor
// de cada infiltrado al repartir. Aquí se usa como listón de la prueba anticamping.
const PAD_CAMP_CLEARANCE_TEST = 0.9;

const config = {
  bounds: { minX: -10, minZ: -5, maxX: 10, maxZ: 5 },
  turnSpeed: 2,
  obstacles: [],
  pads,
  heightmap: flatHM,
  maxSlope: 1,
  npcCount: 0,
  npcSpeed: 1.2,
  minPlayers: 2
};
const members = [
  { userId: "u1", role: "hider" as const },
  { userId: "u2", role: "seeker" as const }
];
const crowdSession = (gameId: string) => {
  const map = loadMap("beta-city");
  return new GameSession(gameId, members, {
    bounds: map.bounds,
    turnSpeed: 3,
    obstacles: map.obstacles,
    pads: map.pads,
    heightmap: map.heightmap,
    maxSlope: 1.5,
    npcCount: 32,
    npcSpeed: 0.36,
    minPlayers: 2
  });
};
const find = (s: GameSession, id: string) => s.playerSnapshot().find((p) => p.userId === id)!;

// Tras N ticks andando de frente, el jugador ha recorrido esto en +z. No es
// velocidad × tiempo: arranca por rampa, igual que un NPC.
const walkForward = (s: GameSession, ticks: number) => {
  const before = find(s, "u1");
  s.setInput("u1", 1, 0);
  for (let i = 0; i < ticks; i += 1) s.tick(0.05);
  const after = find(s, "u1");
  return { dx: after.x - before.x, dz: after.z - before.z };
};

describe("GameSession", () => {
  it("avanza hacia donde mira (heading 0 → +z)", () => {
    const s = new GameSession("g1", members, config);
    s.markPresent("u1");
    const { dx, dz } = walkForward(s, 40);
    expect(dz).toBeGreaterThan(0.5);
    expect(dx).toBeCloseTo(0, 5);
  });

  it("arranca por rampa, no de golpe: no delata al humano entre la multitud", () => {
    const s = new GameSession("g1", members, config);
    s.markPresent("u1");
    const first = walkForward(s, 1).dz;
    // Sin rampa el primer tick ya iba a velocidad de crucero (1.2 × 0.05 = 0.06).
    expect(first).toBeGreaterThan(0);
    expect(first).toBeLessThan(1.2 * 0.05 * 0.5);
  });

  it("no supera la velocidad de la multitud", () => {
    const s = new GameSession("g1", members, config);
    s.markPresent("u1");
    // Ya a plena marcha: ni el tick más largo pasa del crucero + su variación.
    walkForward(s, 60);
    const step = walkForward(s, 1).dz;
    expect(step).toBeLessThanOrEqual(1.2 * 1.25 * 0.05 + 1e-9);
  });

  it("permite girar parado sin desplazar al jugador", () => {
    const s = new GameSession("g1", members, config);
    s.markPresent("u1");
    const before = find(s, "u1");
    s.setInput("u1", 0, 1);
    s.tick(0.05);
    const after = find(s, "u1");
    expect(after.rotationY).toBeGreaterThan(before.rotationY);
    expect(after.x).toBe(before.x);
    expect(after.z).toBe(before.z);
  });

  it("todos los jugadores giran a la misma velocidad", () => {
    const players = [
      { userId: "u1", role: "hider" as const },
      { userId: "u2", role: "hider" as const },
      { userId: "u3", role: "seeker" as const }
    ];
    const s = new GameSession("same-turn-rate", players, config);
    s.markPresent("u1");
    s.markPresent("u2");
    s.setInput("u1", 0, 1);
    s.setInput("u2", 0, 1);
    s.tick(0.05);

    expect(find(s, "u1").rotationY).toBeCloseTo(find(s, "u2").rotationY, 8);
  });

  it("girar mientras se avanza sí cambia la rotación", () => {
    const s = new GameSession("g1", members, config);
    s.markPresent("u1");
    const before = find(s, "u1");
    s.setInput("u1", 1, 1);
    for (let i = 0; i < 10; i += 1) s.tick(0.05);
    const after = find(s, "u1");
    expect(after.z - before.z).toBeGreaterThan(0);
    expect(after.rotationY).toBeGreaterThan(0);
  });

  it("recorta forward/turn a [-1,1] (no acelera)", () => {
    const s = new GameSession("g1", members, config);
    s.markPresent("u1");
    const normal = new GameSession("g1", members, config);
    normal.markPresent("u1");

    s.setInput("u1", 10, 0);
    normal.setInput("u1", 1, 0);
    for (let i = 0; i < 40; i += 1) {
      s.tick(0.05);
      normal.tick(0.05);
    }
    expect(find(s, "u1").z).toBeCloseTo(find(normal, "u1").z, 5);
  });

  it("recorta la posición al fondo del mapa (depth/2)", () => {
    const s = new GameSession("g1", members, config);
    s.markPresent("u1");
    s.setInput("u1", 1, 0);
    for (let i = 0; i < 1000; i += 1) s.tick(0.05);
    expect(find(s, "u1").z).toBeLessThanOrEqual(5);
  });

  it("no hace nada con forward=0 y turn=0", () => {
    const s = new GameSession("g1", members, config);
    s.markPresent("u1");
    const before = find(s, "u1");
    s.setInput("u1", 0, 0);
    s.tick(0.05);
    const after = find(s, "u1");
    expect(after.x).toBe(before.x);
    expect(after.z).toBe(before.z);
    expect(after.rotationY).toBe(before.rotationY);
  });

  // El juego consiste en no saber quién es humano. Cualquier diferencia mecánica entre
  // un jugador y un NPC sería un atajo para cazarlos sin observarles la conducta.
  describe("el humano se mueve como la multitud", () => {
    it('pedir "atrás" da la vuelta de un tirón (giro corto) y anda de frente, no hace marcha atrás', () => {
      const s = crowdSession("media-vuelta");
      s.markPresent("u1");
      const start = find(s, "u1");
      expect(start.rotationY).toBe(0);

      // La vuelta es una ACCIÓN disparada de una vez, no una rotación que se sostiene
      // mientras se aguanta la tecla: se completa sola en un giro corto (REVERSE_FLIP_SECONDS).
      s.setInput("u1", -1, 0);
      // A media vuelta (antes de completarse el giro de 0.18s) todavía no ha andado:
      // gira sobre el sitio, no en arco.
      s.tick(0.05);
      s.tick(0.05);
      expect(find(s, "u1").z).toBeCloseTo(start.z, 5);
      expect(find(s, "u1").x).toBeCloseTo(start.x, 5);

      for (let i = 0; i < 6; i += 1) s.tick(0.05);
      expect(find(s, "u1").rotationY).toBeCloseTo(Math.PI, 5);

      for (let i = 0; i < 40; i += 1) s.tick(0.05);
      const after = find(s, "u1");
      // Sigue mirando para allá (no ha vuelto a girar tick a tick).
      expect(after.rotationY).toBeCloseTo(Math.PI, 5);
      // Con heading π camina hacia -z (cos π = -1): se ha alejado, no clavado en su sitio.
      expect(after.z - start.z).toBeLessThan(-0.1);
    });

    // El joystick del móvil manda un valor analógico, y el pulgar cruza el cero cada
    // dos por tres al trazar el arco de un giro. Cuando cualquier negativo disparaba la
    // media vuelta, rozar la zona muerta bastaba: el personaje giraba sobre sí mismo sin
    // avanzar (medido: 34 medias vueltas y 1/18 del recorrido en 10 s).
    it("un roce hacia atrás del joystick no dispara la media vuelta", () => {
      const s = crowdSession("joystick");
      s.markPresent("u1");
      const start = find(s, "u1");

      let medias = 0;
      // Camino ANDADO, no distancia entre el principio y el final: el gesto traza un
      // círculo, así que el desplazamiento neto depende de dónde acabe la vuelta y de con
      // quién se cruce por el camino (medido: 0.38–0.54 según la semilla, con el mismo
      // comportamiento). Lo que la prueba quiere decir es "sigue andando en vez de girar
      // sobre sí mismo", y eso es el camino: con el fallo eran 1/18 de esto.
      let camino = 0;
      let previa = start;
      let anterior = start.rotationY;
      for (let tick = 0; tick < 200; tick += 1) {
        // Gesto de girar en el que el pulgar roza el borde de abajo cada 12 ticks.
        s.setInput("u1", tick % 12 === 0 ? -0.13 : 0.6, 0.3);
        s.tick(0.05);
        const actual = find(s, "u1");
        camino += Math.hypot(actual.x - previa.x, actual.z - previa.z);
        previa = actual;
        if (Math.abs(actual.rotationY - anterior) > 1) medias += 1;
        anterior = actual.rotationY;
      }

      expect(medias).toBe(0);
      expect(camino).toBeGreaterThan(1.5);
    });

    it("no anda más rápido que un NPC", () => {
      const s = crowdSession("mimetismo");
      s.markPresent("u1");
      s.setInput("u1", 1, 0);

      let fastestPlayer = 0;
      let fastestNpc = 0;
      let previousPlayer = find(s, "u1");
      let previousNpcs = new Map(s.npcSnapshot().map((n) => [n.entityId, n]));

      for (let tick = 0; tick < 400; tick += 1) {
        s.tick(0.05);
        const player = find(s, "u1");
        fastestPlayer = Math.max(
          fastestPlayer,
          Math.hypot(player.x - previousPlayer.x, player.z - previousPlayer.z) / 0.05
        );
        previousPlayer = player;
        const npcs = s.npcSnapshot();
        for (const npc of npcs) {
          const before = previousNpcs.get(npc.entityId)!;
          fastestNpc = Math.max(fastestNpc, Math.hypot(npc.x - before.x, npc.z - before.z) / 0.05);
        }
        previousNpcs = new Map(npcs.map((n) => [n.entityId, n]));
      }

      expect(fastestPlayer).toBeGreaterThan(0);
      expect(fastestPlayer).toBeLessThanOrEqual(fastestNpc + 1e-9);
    });

    it("no atraviesa a los NPC: respeta su espacio como uno más", () => {
      const s = crowdSession("mimetismo");
      s.markPresent("u1");
      s.setInput("u1", 1, 1); // dar vueltas por el mapa, cruzándose con la multitud
      let closest = Infinity;

      for (let tick = 0; tick < 600; tick += 1) {
        s.tick(0.05);
        const player = find(s, "u1");
        for (const npc of s.npcSnapshot()) {
          closest = Math.min(closest, Math.hypot(npc.x - player.x, npc.z - player.z));
        }
      }

      // Antes el jugador los atravesaba de lado a lado y la distancia bajaba a ~0.
      // Umbral por debajo de NPC_SEPARATION (0.18): se pidió que pudieran rozarse, así
      // que el margen es pequeño a propósito, solo para pillar el "atravesar" real.
      expect(closest).toBeGreaterThan(0.12);
    });
  });

  describe("nave del cazador", () => {
    const pose = {
      x: 6.4,
      y: 2.2,
      z: 1.1,
      dirX: 0,
      dirY: -0.4,
      dirZ: 0.9,
      aimX: 6.4,
      aimY: 0,
      aimZ: 6.05
    };

    it("publica la pose para que el resto la vea, con el estado de la mira", () => {
      const s = new GameSession("g1", members, config);
      s.markPresent("u2");
      expect(s.seekerSnapshot()).toBeNull(); // sin pose todavía no hay nada que pintar

      s.setAiming("u2", true, pose);
      expect(s.seekerSnapshot()).toEqual({ ...pose, aiming: true });

      // Soltar la mira no hace desaparecer la nave: sigue sobrevolando el mapa.
      s.setAiming("u2", false);
      expect(s.seekerSnapshot()).toEqual({ ...pose, aiming: false });
    });

    it("no filtra al cazador entre las entidades", () => {
      const s = new GameSession("g1", members, config);
      s.markPresent("u1");
      s.markPresent("u2");
      s.setAiming("u2", true, pose);
      const seekerEntityId = s.playerSnapshot().find((p) => p.userId === "u2")?.entityId;
      expect(s.snapshot().some((e) => e.entityId === seekerEntityId)).toBe(false);
    });

    it("olvida la nave cuando el cazador se va", () => {
      const s = new GameSession("g1", members, config);
      s.markPresent("u2");
      s.setAiming("u2", true, pose);
      s.markDisconnected("u2");
      expect(s.seekerSnapshot()).toBeNull();
    });

    it("ignora la pose de quien no es cazador", () => {
      const s = new GameSession("g1", members, config);
      s.markPresent("u1");
      expect(s.setAiming("u1", true, pose)).toBe(false);
      expect(s.seekerSnapshot()).toBeNull();
    });
  });

  it("solo incluye en el snapshot a jugadores presentes", () => {
    const s = new GameSession("g1", members, config);
    s.markPresent("u1");
    expect(s.playerSnapshot().map((p) => p.userId)).toEqual(["u1"]);
  });

  it("detiene al desconectado y conserva su entidad al volver", () => {
    const s = new GameSession("g1", members, config);
    const firstJoin = s.markPresent("u1")!;
    const before = find(s, "u1");
    s.setInput("u1", 1, 1);

    expect(s.markDisconnected("u1")).toBe(true);
    s.tick(1);
    const resumed = s.markPresent("u1")!;
    const after = find(s, "u1");

    expect(resumed).toEqual(firstJoin);
    expect(after.x).toBe(before.x);
    expect(after.z).toBe(before.z);
    expect(after.rotationY).toBe(before.rotationY);
  });

  it("publica una skin estable para cada entidad", () => {
    const s = new GameSession("g1", members, config);
    const player = s.markPresent("u1")!;
    const privateState = find(s, "u1");
    const publicState = s.snapshot().find((entity) => entity.entityId === player.entityId);

    expect(publicState?.skinId).toBe(privateState.skinId);
    s.tick(1);
    expect(s.snapshot().find((entity) => entity.entityId === player.entityId)?.skinId).toBe(
      privateState.skinId
    );
  });

  it("el seeker no camina ni aparece entre la multitud", () => {
    const s = new GameSession("g1", members, config);
    const seeker = s.markPresent("u2")!;
    const before = find(s, "u2");
    s.setInput("u2", 1, 1);
    s.tick(0.05);
    expect(find(s, "u2")).toEqual(before);
    expect(s.snapshot().some((entity) => entity.entityId === seeker.entityId)).toBe(false);
  });

  it("solo el seeker presente puede eliminar por entityId", () => {
    const s = new GameSession("g1", members, { ...config, npcCount: 1 });
    const hider = s.markPresent("u1")!;
    s.markPresent("u2");
    const npcId = s.npcSnapshot()[0].entityId;

    expect(s.shoot("u1", npcId)).toBe(false);
    expect(s.shoot("u2", npcId)).toBe(false);
    expect(s.setAiming("u1", true)).toBe(false);
    expect(s.setAiming("u2", true)).toBe(true);
    expect(s.shoot("u2", npcId)).toBe(true);
    s.setAiming("u2", false);
    expect(s.shoot("u2", hider.entityId)).toBe(false);
    s.setAiming("u2", true);
    expect(s.shoot("u2", hider.entityId)).toBe(true);
    expect(s.snapshot()).toHaveLength(0);
  });

  it("suma por encontrar cyborgs, resta por disparar a NPCs y termina la ronda", () => {
    const s = new GameSession("g1", members, { ...config, npcCount: 1 });
    const hider = s.markPresent("u1")!;
    s.markPresent("u2");
    const npcId = s.npcSnapshot()[0].entityId;

    s.setAiming("u2", true);
    expect(s.shoot("u2", npcId)).toBe(true);
    expect(find(s, "u2").score).toBe(GAME_RULES.npcHitPoints);
    expect(s.shoot("u2", hider.entityId)).toBe(true);
    expect(find(s, "u2").score).toBe(GAME_RULES.npcHitPoints + GAME_RULES.hiderHitPoints);
    expect(s.roundSnapshot()).toMatchObject({
      phase: "intermission",
      current: 1,
      endReason: "all-hiders-found"
    });
  });

  it("rota el seeker, conserva puntos y termina después de tres rondas", () => {
    const rotatingMembers = [
      { userId: "u1", username: "Uno", role: "hider" as const },
      { userId: "u2", username: "Dos", role: "seeker" as const },
      { userId: "u3", username: "Tres", role: "hider" as const }
    ];
    const s = new GameSession("rounds", rotatingMembers, config);
    rotatingMembers.forEach(({ userId }) => s.markPresent(userId));

    s.tick(GAME_RULES.roundSeconds);
    expect(s.roundSnapshot().phase).toBe("intermission");
    s.tick(GAME_RULES.intermissionSeconds);
    expect(s.roundSnapshot()).toMatchObject({ phase: "playing", current: 2 });
    expect(s.scoreSnapshot().find((entry) => entry.role === "seeker")?.userId).toBe("u3");

    s.tick(GAME_RULES.roundSeconds);
    s.tick(GAME_RULES.intermissionSeconds);
    expect(s.roundSnapshot()).toMatchObject({ phase: "playing", current: 3 });
    expect(s.scoreSnapshot().find((entry) => entry.role === "seeker")?.userId).toBe("u1");

    s.tick(GAME_RULES.roundSeconds);
    expect(s.roundSnapshot()).toMatchObject({
      phase: "finished",
      current: 3,
      endReason: "time"
    });
  });

  describe("abandonos", () => {
    const trio = [
      { userId: "u1", username: "Uno", role: "hider" as const },
      { userId: "u2", username: "Dos", role: "seeker" as const },
      { userId: "u3", username: "Tres", role: "hider" as const }
    ];
    const started = () => {
      const s = new GameSession("abandon", trio, config);
      trio.forEach(({ userId }) => s.markPresent(userId));
      return s;
    };

    it("si se va el cazador y queda gente, repite la ronda con otro cazador", () => {
      const s = started();

      s.removePlayer("u2");
      expect(s.roundSnapshot()).toMatchObject({
        phase: "intermission",
        current: 1,
        endReason: "seeker-left"
      });

      s.tick(GAME_RULES.intermissionSeconds);
      // Misma ronda, no la siguiente: la anulada no cuenta.
      expect(s.roundSnapshot()).toMatchObject({ phase: "playing", current: 1 });
      const seeker = s.scoreSnapshot().find((entry) => entry.role === "seeker");
      expect(seeker?.userId).not.toBe("u2");
      expect(["u1", "u3"]).toContain(seeker?.userId);
    });

    it("la ronda repetida conserva los puntos ya ganados", () => {
      const s = started();
      s.setAiming("u2", true);
      s.shoot("u2", find(s, "u1").entityId);
      expect(find(s, "u2").score).toBe(GAME_RULES.hiderHitPoints);

      // El disparo dejó vivo a u3, así que la ronda sigue en juego.
      expect(s.roundSnapshot().phase).toBe("playing");
      s.removePlayer("u3");
      s.tick(GAME_RULES.intermissionSeconds);

      expect(s.scoreSnapshot().find((entry) => entry.userId === "u2")?.score).toBe(
        GAME_RULES.hiderHitPoints
      );
    });

    it("si se va un hider y aún hay mínimo, la ronda continúa", () => {
      const s = started();
      s.removePlayer("u3");
      expect(s.roundSnapshot()).toMatchObject({ phase: "playing", current: 1, endReason: null });
    });

    it("termina la partida cuando se baja del mínimo de jugadores", () => {
      const s = started();
      s.removePlayer("u3");
      s.removePlayer("u1");
      expect(s.roundSnapshot()).toMatchObject({ phase: "finished", endReason: "abandoned" });
    });

    it("quedarse sin cazador y sin mínimo termina la partida, no la reinicia", () => {
      const s = new GameSession("abandon", trio, { ...config, minPlayers: 3 });
      trio.forEach(({ userId }) => s.markPresent(userId));

      s.removePlayer("u2");
      expect(s.roundSnapshot()).toMatchObject({ phase: "finished", endReason: "abandoned" });
    });

    it("también termina si el abandono ocurre durante la intermisión", () => {
      const s = started();
      s.tick(GAME_RULES.roundSeconds);
      expect(s.roundSnapshot().phase).toBe("intermission");

      s.removePlayer("u1");
      s.removePlayer("u3");
      expect(s.roundSnapshot()).toMatchObject({ phase: "finished", endReason: "abandoned" });
    });

    it("una partida terminada por abandono ya no avanza", () => {
      const s = started();
      s.removePlayer("u1");
      s.removePlayer("u3");

      s.tick(GAME_RULES.roundSeconds);
      expect(s.roundSnapshot()).toMatchObject({ phase: "finished", endReason: "abandoned" });
    });
  });

  it("los hiders recogen objetos cercanos y reaparecen tras el delay en un punto nuevo", () => {
    const tinyHeightmap = makeHM(-0.05, -0.05, 0.05, 0.05, 0.05, () => 0);
    const s = new GameSession("collectibles", [{ userId: "u1", username: "Uno", role: "hider" }], {
      ...config,
      bounds: { minX: -0.05, minZ: -0.05, maxX: 0.05, maxZ: 0.05 },
      heightmap: tinyHeightmap
    });
    s.markPresent("u1");

    const initial = s.collectibleSnapshot();
    expect(initial).toHaveLength(GAME_RULES.collectibleCount);
    const initialIds = new Set(initial.map((item) => item.collectibleId));
    s.tick(0.05);
    expect(s.collectibleSnapshot()).toHaveLength(0);
    expect(find(s, "u1").score).toBe(GAME_RULES.collectibleCount * GAME_RULES.collectiblePoints);

    s.tick(GAME_RULES.collectibleRespawnSeconds - 0.1);
    expect(s.collectibleSnapshot()).toHaveLength(0);
    s.tick(0.11);
    // Repone el mismo número, pero como objetos nuevos: nunca vuelve el id recogido, así
    // que quien se quedara plantado encima no la recuperaría sola al cumplirse el delay.
    const respawned = s.collectibleSnapshot();
    expect(respawned).toHaveLength(GAME_RULES.collectibleCount);
    expect(respawned.every((item) => !initialIds.has(item.collectibleId))).toBe(true);
    expect(find(s, "u1").score).toBe(GAME_RULES.collectibleCount * GAME_RULES.collectiblePoints);
  });

  // El azar uniforme agrupa: antes del reparto por mejor candidato salían racimos de
  // células en un lado del mapa (huecos mínimos de 0.48) y media manzana vacía.
  it("reparte las células por el mapa, sin racimos en un lado", () => {
    const map = loadMap("neon-block");
    for (const seed of ["reparto-a", "reparto-b", "reparto-c"]) {
      const s = new GameSession(seed, members, {
        bounds: map.bounds,
        turnSpeed: 3,
        obstacles: map.obstacles,
        pads: map.pads,
        heightmap: map.heightmap,
        maxSlope: 1.5,
        npcCount: 0,
        npcSpeed: 0.36,
        minPlayers: 2
      });
      const items = s.collectibleSnapshot();
      expect(items).toHaveLength(GAME_RULES.collectibleCount);

      let minGap = Infinity;
      for (let a = 0; a < items.length; a += 1) {
        for (let b = a + 1; b < items.length; b += 1) {
          minGap = Math.min(minGap, Math.hypot(items[a].x - items[b].x, items[a].z - items[b].z));
        }
      }
      // El mapa mide 5×4 y son 7 células: por debajo de esto ya se ven pegadas.
      expect(minGap).toBeGreaterThan(0.9);

      // Y no se amontonan todas en la misma mitad del mapa.
      const left = items.filter((item) => item.x < 0).length;
      expect(left).toBeGreaterThanOrEqual(2);
      expect(left).toBeLessThanOrEqual(GAME_RULES.collectibleCount - 2);
    }
  });

  // Las células nacen solo en los pads del mapa: son los sitios dibujados en el suelo, y
  // que estén marcados es lo que permite saber dónde mirar sin saber dónde saldrá.
  describe("pads", () => {
    const mapaReal = loadMap("neon-block");
    const sesionEnMapa = (gameId: string, jugadores = members) =>
      new GameSession(gameId, jugadores, {
        bounds: mapaReal.bounds,
        turnSpeed: 3,
        obstacles: mapaReal.obstacles,
        pads: mapaReal.pads,
        heightmap: mapaReal.heightmap,
        maxSlope: 1.5,
        npcCount: 0,
        npcSpeed: 0.36,
        minPlayers: 2
      });
    const enUnPad = (x: number, z: number) =>
      mapaReal.pads.some((pad) => Math.hypot(pad.x - x, pad.z - z) < 0.001);

    it("toda célula nace clavada en un pad, ronda tras ronda", () => {
      for (const semilla of ["pads-a", "pads-b", "pads-c"]) {
        const s = sesionEnMapa(semilla);
        s.markPresent("u1");
        expect(s.collectibleSnapshot()).toHaveLength(GAME_RULES.collectibleCount);
        for (const item of s.collectibleSnapshot()) {
          expect(enUnPad(item.x, item.z)).toBe(true);
        }
        // Y las de la ronda siguiente tampoco: el reparto se rehace entero al empezarla.
        s.tick(GAME_RULES.roundSeconds);
        s.tick(GAME_RULES.intermissionSeconds + 0.05);
        expect(s.collectibleSnapshot()).toHaveLength(GAME_RULES.collectibleCount);
        for (const item of s.collectibleSnapshot()) {
          expect(enUnPad(item.x, item.z)).toBe(true);
        }
      }
    });

    // La regla anticamping: plantarse en un pad y esperar no da puntos, porque mientras
    // se esté encima ahí no nace nada. Con pocos pads esto no se podría garantizar —el
    // reparto se quedaría sin sitio—; por eso el mapa trae decenas.
    //
    // El mapa es de mentira a propósito: así se sabe dónde nace el jugador (centro + 30 %
    // del lado, sin obstáculos que lo aparten) y se le puede poner un pad justo debajo.
    it("no deja nacer una célula encima de quien se queda plantado", () => {
      const suelo = makeHM(-10, -5, 10, 5, 5, () => 0);
      const otros = [
        { x: 0, z: 0 },
        { x: 2, z: 2 },
        { x: -4, z: -3 },
        { x: 4, z: 3 },
        { x: -2, z: 2 },
        { x: 0, z: -4 },
        { x: 3, z: -3 },
        { x: -6, z: 3 },
        { x: -8, z: -2 }
      ];
      // Dónde nace el infiltrado en este mapa, preguntándoselo a la propia sesión en vez
      // de repetir aquí su fórmula de reparto en corro.
      const sonda = new GameSession("sonda", members, { ...config, heightmap: suelo, pads: otros });
      sonda.markPresent("u1");
      const nace = find(sonda, "u1");
      const padDelJugador = { x: nace.x, z: nace.z };

      for (const semilla of ["camping-a", "camping-b", "camping-c"]) {
        const s = new GameSession(semilla, members, {
          ...config,
          heightmap: suelo,
          pads: [padDelJugador, ...otros]
        });
        s.markPresent("u1");
        // El jugador nace justo en su pad y no se le manda ninguna orden: se queda ahí.
        const jugador = find(s, "u1");
        expect(Math.hypot(jugador.x - padDelJugador.x, jugador.z - padDelJugador.z)).toBeLessThan(
          0.01
        );

        // Ninguna célula nace al alcance de un infiltrado quieto. Se mira contra TODOS los
        // infiltrados vivos y no contra un usuario fijo: al empezar cada ronda el papel de
        // cazador rota, y encima del cazador sí puede nacer una —no las recoge, así que no
        // hay nada que camperear.
        let nacidasEncima = 0;
        for (let ronda = 0; ronda < 3; ronda += 1) {
          const infiltrados = s.playerSnapshot().filter((p) => p.role === "hider" && p.alive);
          for (const item of s.collectibleSnapshot()) {
            for (const infiltrado of infiltrados) {
              const distancia = Math.hypot(item.x - infiltrado.x, item.z - infiltrado.z);
              if (distancia < PAD_CAMP_CLEARANCE_TEST) nacidasEncima += 1;
            }
          }
          s.tick(GAME_RULES.roundSeconds);
          s.tick(GAME_RULES.intermissionSeconds + 0.05);
        }
        expect(nacidasEncima).toBe(0);
        // Y por tanto quien nació sobre un pad y no se movió no ha sumado ni un punto.
        expect(find(s, "u1").score).toBe(0);
      }
    });
  });

  it("queda vacío cuando se van todos", () => {
    const s = new GameSession("g1", members, config);
    s.removePlayer("u1");
    s.removePlayer("u2");
    expect(s.isEmpty).toBe(true);
  });

  describe("colisión", () => {
    const cfgWithWall = (obstacles: import("./map").Obstacle[]) => ({
      bounds: { minX: -10, minZ: -5, maxX: 10, maxZ: 5 },
      turnSpeed: 2,
      obstacles,
      pads,
      heightmap: flatHM,
      maxSlope: 1,
      npcCount: 0,
      npcSpeed: 1.2,
      minPlayers: 1
    });

    it("un obstáculo delante bloquea el avance en z", () => {
      // spawn en (3,0) mirando +z; muro que cubre z ∈ [1,4] alrededor de x=3
      const s = new GameSession(
        "g",
        [{ userId: "u", role: "hider" }],
        cfgWithWall([{ minX: 2, minZ: 1, maxX: 4, maxZ: 4 }])
      );
      s.markPresent("u");
      s.setInput("u", 1, 0); // avanzar hacia +z
      for (let i = 0; i < 20; i++) s.tick(0.05); // 1s de avance
      const p = s.playerSnapshot()[0];
      expect(p.z).toBeLessThan(1); // no ha entrado en el muro
    });

    it("desliza: con x bloqueado y z libre, avanza en z", () => {
      // pared vertical a la derecha del spawn (x > 3.05); el jugador mira en diagonal +x+z
      const s = new GameSession(
        "g",
        [{ userId: "u", role: "hider" }],
        cfgWithWall([{ minX: 3.05, minZ: -10, maxX: 9, maxZ: 10 }])
      );
      s.markPresent("u");
      s.setInput("u", 0, 1); // gira (heading hacia +x)
      for (let i = 0; i < 8; i++) s.tick(0.05);
      s.setInput("u", 1, 0); // avanza en diagonal
      const z0 = s.playerSnapshot()[0].z;
      for (let i = 0; i < 10; i++) s.tick(0.05);
      const p = s.playerSnapshot()[0];
      expect(p.x).toBeLessThanOrEqual(3.06); // x bloqueado por la pared
      expect(p.z).toBeGreaterThan(z0); // pero deslizó en z
    });

    it("sin obstáculos se mueve libre (regresión)", () => {
      const s = new GameSession("g", [{ userId: "u", role: "hider" }], cfgWithWall([]));
      s.markPresent("u");
      s.setInput("u", 1, 0);
      s.tick(0.05);
      expect(s.playerSnapshot()[0].z).toBeGreaterThan(0);
    });

    it("ningún jugador nace dentro de un edificio", () => {
      // 1 jugador nace en (radius,0)=(3,0); ponemos un muro que lo cubre
      const s = new GameSession(
        "g",
        [{ userId: "u", role: "hider" }],
        cfgWithWall([{ minX: 2, minZ: -1, maxX: 4, maxZ: 1 }])
      );
      s.markPresent("u");
      const { x, z } = s.playerSnapshot()[0];
      const dentro = x >= 2 && x <= 4 && z >= -1 && z <= 1;
      expect(dentro).toBe(false);
    });
  });

  describe("altura (rampas/escalones)", () => {
    // spawn en (radius,0) mirando +z; radius=min(8,8)*0.3=2.4 → (2.4,0). Camina hacia +z.
    const cfgH = (f: (x: number, z: number) => number | null, maxSlope: number) => ({
      bounds: { minX: -4, minZ: -4, maxX: 4, maxZ: 4 },
      turnSpeed: 2,
      obstacles: [],
      pads,
      heightmap: makeHM(-4, -4, 4, 4, 1, f),
      maxSlope,
      npcCount: 0,
      npcSpeed: 1.2,
      minPlayers: 1
    });
    const walk = (f: (x: number, z: number) => number | null, maxSlope: number) => {
      const s = new GameSession("g", [{ userId: "u", role: "hider" }], cfgH(f, maxSlope));
      s.markPresent("u");
      s.setInput("u", 1, 0);
      for (let i = 0; i < 40; i++) s.tick(0.05);
      return s.playerSnapshot()[0];
    };

    it("un escalón grande bloquea el avance", () => {
      const p = walk((_x, z) => (z >= 1 ? 3 : 0), 0.35); // pared de altura 3 en z>=1
      expect(p.z).toBeLessThan(1);
    });

    it("una rampa suave se puede subir (y sube de altura)", () => {
      const p = walk((_x, z) => z * 0.1, 0.35); // pendiente 0.1/unidad
      expect(p.z).toBeGreaterThan(1); // avanzó cruzando z=1
      expect(p.y).toBeGreaterThan(0.1); // y subió con la rampa
    });

    it("un hueco sin suelo bloquea el avance", () => {
      const p = walk((_x, z) => (z >= 1 ? null : 0), 0.35);
      expect(p.z).toBeLessThan(1);
    });

    it("suelo plano no estorba (regresión)", () => {
      const p = walk(() => 0, 0.35);
      expect(p.z).toBeGreaterThan(1);
    });
  });

  describe("NPCs", () => {
    it("pasean durante 60 segundos sin salir del mapa ni atravesar edificios", () => {
      const map = loadMap("beta-city");
      const session = new GameSession("npc-test", members, {
        bounds: map.bounds,
        turnSpeed: 3,
        obstacles: map.obstacles,
        pads: map.pads,
        heightmap: map.heightmap,
        maxSlope: 1.5,
        npcCount: 8,
        npcSpeed: 1.2,
        minPlayers: 2
      });
      const initial = session.npcSnapshot();
      const previous = new Map(initial.map((npc) => [npc.entityId, npc]));
      const modes = new Set(initial.map((npc) => npc.mode));

      for (let tick = 0; tick < 1200; tick += 1) {
        session.tick(0.05);
        const frame = session.npcSnapshot();
        for (const npc of frame) {
          modes.add(npc.mode);
          const before = previous.get(npc.entityId)!;
          // Cada NPC anda a su ritmo, hasta un 25% por encima del configurado: la cota
          // es esa, no la velocidad base. Sigue garantizando que nadie se teletransporta.
          expect(Math.hypot(npc.x - before.x, npc.z - before.z)).toBeLessThanOrEqual(
            1.2 * 1.25 * 0.05 + 1e-9
          );
          previous.set(npc.entityId, npc);
          expect(Number.isFinite(npc.x) && Number.isFinite(npc.y) && Number.isFinite(npc.z)).toBe(
            true
          );
          expect(npc.x).toBeGreaterThanOrEqual(map.bounds.minX);
          expect(npc.x).toBeLessThanOrEqual(map.bounds.maxX);
          expect(npc.z).toBeGreaterThanOrEqual(map.bounds.minZ);
          expect(npc.z).toBeLessThanOrEqual(map.bounds.maxZ);
          expect(
            map.obstacles.some(
              (wall) =>
                npc.x >= wall.minX && npc.x <= wall.maxX && npc.z >= wall.minZ && npc.z <= wall.maxZ
            )
          ).toBe(false);
        }
        for (let i = 0; i < frame.length; i += 1) {
          for (let j = i + 1; j < frame.length; j += 1) {
            // NPC_SEPARATION bajó de 0.28 a 0.18 a petición explícita: la multitud va
            // más apretada.
            expect(
              Math.hypot(frame[i].x - frame[j].x, frame[i].z - frame[j].z)
            ).toBeGreaterThanOrEqual(0.18);
          }
        }
      }

      const final = session.npcSnapshot();
      expect(final).toHaveLength(8);
      expect(
        final.some((npc, index) => npc.x !== initial[index].x || npc.z !== initial[index].z)
      ).toBe(true);
      expect(modes).toEqual(new Set(["idle", "walking"]));
    });

    it("gira sobre todo en marcha, no plantado", () => {
      const session = crowdSession("npc-crowd");
      let previous = new Map(session.npcSnapshot().map((npc) => [npc.entityId, npc]));
      let curva = 0;
      let plantado = 0;

      for (let tick = 0; tick < 1200; tick += 1) {
        session.tick(0.05);
        const frame = session.npcSnapshot();
        for (const npc of frame) {
          const before = previous.get(npc.entityId)!;
          if (npc.rotationY === before.rotationY) continue;
          if (npc.x !== before.x || npc.z !== before.z) curva += 1;
          else plantado += 1;
        }
        previous = new Map(frame.map((npc) => [npc.entityId, npc]));
      }

      expect(curva).toBeGreaterThan(0);
      // Girar plantado es solo la válvula de desatasco. Si pasa de un tercio, es que
      // ha vuelto a ser la forma normal de cambiar de rumbo (medido: ~20%).
      expect(plantado / (curva + plantado)).toBeLessThan(1 / 3);
    });

    it("nadie va más rápido ni más lento que nadie", () => {
      const session = crowdSession("npc-crowd");
      let previous = new Map(session.npcSnapshot().map((npc) => [npc.entityId, npc]));
      const peakSpeed = new Map<string, number>();

      for (let tick = 0; tick < 600; tick += 1) {
        session.tick(0.05);
        const frame = session.npcSnapshot();
        for (const npc of frame) {
          const before = previous.get(npc.entityId)!;
          const speed = Math.hypot(npc.x - before.x, npc.z - before.z) / 0.05;
          peakSpeed.set(npc.entityId, Math.max(peakSpeed.get(npc.entityId) ?? 0, speed));
        }
        previous = new Map(frame.map((npc) => [npc.entityId, npc]));
      }

      // Misma velocidad punta para todos. Antes se exigía justo lo contrario (que
      // difirieran ≥1.15×, para que la multitud no fuera en bloque), pero ese ritmo
      // por individuo se lo llevaba también el humano: le tocaba en el sorteo y se lo
      // quedaba la partida entera, con diferencias de hasta el 49% entre una partida y
      // otra. La regla es que nadie va más rápido ni más lento que nadie.
      const peaks = [...peakSpeed.values()].filter((v) => v > 0);
      expect(Math.max(...peaks) - Math.min(...peaks)).toBeLessThan(1e-9);

      // Y el humano va a esa misma velocidad, ni más ni menos. Se compara su PUNTA con la
      // de la multitud, no su paso en un tick suelto: andando entre gente, el tick que
      // toque puede caer justo en un roce (frena a NPC_BUMP_KEEP y se escurre de lado), y
      // entonces la medida no dice a qué velocidad va, dice con quién se ha cruzado.
      const humano = crowdSession("npc-crowd");
      humano.markPresent("u1");
      humano.setInput("u1", 1, 0);
      let suPunta = 0;
      let anterior = find(humano, "u1");
      for (let i = 0; i < 240; i += 1) {
        humano.tick(0.05);
        const ahora = find(humano, "u1");
        suPunta = Math.max(suPunta, Math.hypot(ahora.x - anterior.x, ahora.z - anterior.z) / 0.05);
        anterior = ahora;
      }
      expect(suPunta).toBeCloseTo(Math.max(...peaks), 6);

      // Aquí NO se comprueba la rampa de arranque. Se intentó como "primer tick tras
      // desplazamiento 0", y eso no medía la rampa: un NPC bloqueado contra un muro
      // tampoco se desplaza, pero conserva su velocidad (NPC_BUMP_KEEP), así que al
      // soltarse daba un paso grande que se leía como un tirón de arranque. Pasaba o
      // fallaba según la semilla sin que la rampa tuviera nada que ver. La rampa la
      // cubre "arranca por rampa, no de golpe", que la mide desde parado de verdad y
      // vale para los dos: humano y NPC comparten fórmula y constantes a propósito.
    });

    it("no se quedan empotrados contra muros ni contra otros", () => {
      const session = crowdSession("npc-crowd");
      let previous = new Map(session.npcSnapshot().map((npc) => [npc.entityId, npc]));
      const streak = new Map<string, number>();
      let stalled = 0;
      let walking = 0;
      let worst = 0;

      for (let tick = 0; tick < 1200; tick += 1) {
        session.tick(0.05);
        const frame = session.npcSnapshot();
        for (const npc of frame) {
          const before = previous.get(npc.entityId)!;
          if (npc.mode !== "walking") {
            streak.set(npc.entityId, 0);
            continue;
          }
          walking += 1;
          // Quiere andar pero no avanza = está empotrado contra algo.
          if (npc.x === before.x && npc.z === before.z) {
            stalled += 1;
            const run = (streak.get(npc.entityId) ?? 0) + 1;
            streak.set(npc.entityId, run);
            worst = Math.max(worst, run);
          } else {
            streak.set(npc.entityId, 0);
          }
        }
        previous = new Map(frame.map((npc) => [npc.entityId, npc]));
      }

      // Antes de escurrirse de lado: 12.5% del tiempo y rachas de 6.4s plantado
      // contra la pared. Ahora ~2%, lo mismo que un NPC solo en el mapa.
      expect(stalled / walking).toBeLessThan(0.05);
      expect(worst).toBeLessThan(20); // 1s
    });

    it("la multitud no se congela: nadie se queda clavado", () => {
      const session = crowdSession("npc-crowd");
      let previous = new Map(session.npcSnapshot().map((npc) => [npc.entityId, npc]));
      const streak = new Map<string, number>();
      let worst = 0;

      for (let tick = 0; tick < 1200; tick += 1) {
        session.tick(0.05);
        const frame = session.npcSnapshot();
        for (const npc of frame) {
          const before = previous.get(npc.entityId)!;
          const quieto = npc.x === before.x && npc.z === before.z;
          const run = quieto ? (streak.get(npc.entityId) ?? 0) + 1 : 0;
          streak.set(npc.entityId, run);
          if (run > worst) worst = run;
        }
        previous = new Map(frame.map((npc) => [npc.entityId, npc]));
      }

      // Antes de la válvula, un NPC encajonado no volvía a moverse nunca y en un
      // minuto se paraban los 32. 200 ticks = 10 s parado seguidos.
      expect(worst).toBeLessThan(200);
    });
  });
});
