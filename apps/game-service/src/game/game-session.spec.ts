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

const config = {
  bounds: { minX: -10, minZ: -5, maxX: 10, maxZ: 5 },
  turnSpeed: 2,
  obstacles: [],
  heightmap: flatHM,
  maxSlope: 1,
  npcCount: 0,
  npcSpeed: 1.2
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
    heightmap: map.heightmap,
    maxSlope: 1.5,
    npcCount: 32,
    npcSpeed: 0.36
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
      expect(closest).toBeGreaterThan(0.2);
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

  it("los hiders recogen objetos cercanos y reaparecen a los cinco segundos", () => {
    const tinyHeightmap = makeHM(-0.05, -0.05, 0.05, 0.05, 0.05, () => 0);
    const s = new GameSession("collectibles", [{ userId: "u1", username: "Uno", role: "hider" }], {
      ...config,
      bounds: { minX: -0.05, minZ: -0.05, maxX: 0.05, maxZ: 0.05 },
      heightmap: tinyHeightmap
    });
    s.markPresent("u1");

    const initial = s.collectibleSnapshot();
    expect(initial).toHaveLength(GAME_RULES.collectibleCount);
    s.tick(0.05);
    expect(s.collectibleSnapshot()).toHaveLength(0);
    expect(find(s, "u1").score).toBe(GAME_RULES.collectibleCount * GAME_RULES.collectiblePoints);

    s.tick(GAME_RULES.collectibleRespawnSeconds - 0.1);
    expect(s.collectibleSnapshot()).toHaveLength(0);
    s.tick(0.11);
    expect(s.collectibleSnapshot()).toEqual(expect.arrayContaining(initial));
    expect(find(s, "u1").score).toBe(GAME_RULES.collectibleCount * GAME_RULES.collectiblePoints);
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
      heightmap: flatHM,
      maxSlope: 1,
      npcCount: 0,
      npcSpeed: 1.2
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
      heightmap: makeHM(-4, -4, 4, 4, 1, f),
      maxSlope,
      npcCount: 0,
      npcSpeed: 1.2
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
        heightmap: map.heightmap,
        maxSlope: 1.5,
        npcCount: 8,
        npcSpeed: 1.2
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
            expect(
              Math.hypot(frame[i].x - frame[j].x, frame[i].z - frame[j].z)
            ).toBeGreaterThanOrEqual(0.28);
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

    it("cada uno anda a su ritmo y arranca por rampa, sin tirones", () => {
      const session = crowdSession("npc-crowd");
      let previous = new Map(session.npcSnapshot().map((npc) => [npc.entityId, npc]));
      const peakSpeed = new Map<string, number>();
      const wasStopped = new Map<string, boolean>();
      const firstSteps: number[] = [];

      for (let tick = 0; tick < 600; tick += 1) {
        session.tick(0.05);
        const frame = session.npcSnapshot();
        for (const npc of frame) {
          const before = previous.get(npc.entityId)!;
          const speed = Math.hypot(npc.x - before.x, npc.z - before.z) / 0.05;
          // Primer tick tras estar parado: es donde se ve si arranca por rampa o de
          // golpe. Medirlo en cualquier otro momento confundiría la rampa con el
          // frenazo de rozar una pared, que sí es abrupto a propósito.
          if (speed > 0 && wasStopped.get(npc.entityId)) firstSteps.push(speed);
          wasStopped.set(npc.entityId, speed === 0);
          peakSpeed.set(npc.entityId, Math.max(peakSpeed.get(npc.entityId) ?? 0, speed));
        }
        previous = new Map(frame.map((npc) => [npc.entityId, npc]));
      }

      // Velocidades punta distintas entre sí: si fueran todas iguales, la multitud se
      // movería en bloque.
      const peaks = [...peakSpeed.values()].filter((v) => v > 0);
      expect(Math.max(...peaks) / Math.min(...peaks)).toBeGreaterThan(1.15);

      // Sin rampa, el primer tick ya iba a velocidad de crucero (0.36). Con ella
      // arranca en torno al 9% de esa velocidad.
      expect(firstSteps.length).toBeGreaterThan(20);
      const worstStart = Math.max(...firstSteps);
      expect(worstStart).toBeLessThan(0.36 * 0.5);
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
