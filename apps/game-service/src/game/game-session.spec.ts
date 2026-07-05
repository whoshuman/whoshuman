import { GameSession } from "./game-session";
import type { Heightmap } from "./map";

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
  speed: 5,
  turnSpeed: 2,
  obstacles: [],
  heightmap: flatHM,
  maxStep: 1
};
const members = [
  { userId: "u1", role: "seeker" as const },
  { userId: "u2", role: "hider" as const }
];
const find = (s: GameSession, id: string) => s.snapshot().find((p) => p.userId === id)!;

describe("GameSession", () => {
  it("avanza hacia donde mira (heading 0 → +z)", () => {
    const s = new GameSession("g1", members, config);
    s.markPresent("u1");
    const before = find(s, "u1");
    s.setInput("u1", 1, 0);
    s.tick(0.05);
    expect(find(s, "u1").z - before.z).toBeCloseTo(0.25, 5);
    expect(find(s, "u1").x - before.x).toBeCloseTo(0, 5);
  });

  it("girar cambia la rotación SIN mover (girar en el sitio)", () => {
    const s = new GameSession("g1", members, config);
    s.markPresent("u1");
    const before = find(s, "u1");
    s.setInput("u1", 0, 1);
    s.tick(0.05);
    const after = find(s, "u1");
    expect(after.rotationY).toBeCloseTo(0.1, 5);
    expect(after.x).toBe(before.x);
    expect(after.z).toBe(before.z);
  });

  it("recorta forward/turn a [-1,1] (no acelera)", () => {
    const s = new GameSession("g1", members, config);
    s.markPresent("u1");
    const before = find(s, "u1");
    s.setInput("u1", 10, 0);
    s.tick(0.05);
    expect(find(s, "u1").z - before.z).toBeCloseTo(0.25, 5);
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

  it("solo incluye en el snapshot a jugadores presentes", () => {
    const s = new GameSession("g1", members, config);
    s.markPresent("u1");
    expect(s.snapshot().map((p) => p.userId)).toEqual(["u1"]);
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
      speed: 5,
      turnSpeed: 2,
      obstacles,
      heightmap: flatHM,
      maxStep: 1
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
      const p = s.snapshot()[0];
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
      const z0 = s.snapshot()[0].z;
      for (let i = 0; i < 10; i++) s.tick(0.05);
      const p = s.snapshot()[0];
      expect(p.x).toBeLessThanOrEqual(3.06); // x bloqueado por la pared
      expect(p.z).toBeGreaterThan(z0); // pero deslizó en z
    });

    it("sin obstáculos se mueve libre (regresión)", () => {
      const s = new GameSession("g", [{ userId: "u", role: "hider" }], cfgWithWall([]));
      s.markPresent("u");
      s.setInput("u", 1, 0);
      s.tick(0.05);
      expect(s.snapshot()[0].z).toBeGreaterThan(0);
    });

    it("ningún jugador nace dentro de un edificio", () => {
      // 1 jugador nace en (radius,0)=(3,0); ponemos un muro que lo cubre
      const s = new GameSession(
        "g",
        [{ userId: "u", role: "hider" }],
        cfgWithWall([{ minX: 2, minZ: -1, maxX: 4, maxZ: 1 }])
      );
      s.markPresent("u");
      const { x, z } = s.snapshot()[0];
      const dentro = x >= 2 && x <= 4 && z >= -1 && z <= 1;
      expect(dentro).toBe(false);
    });
  });

  describe("altura (rampas/escalones)", () => {
    // spawn en (radius,0) mirando +z; radius=min(8,8)*0.3=2.4 → (2.4,0). Camina hacia +z.
    const cfgH = (f: (x: number, z: number) => number | null, maxStep: number) => ({
      bounds: { minX: -4, minZ: -4, maxX: 4, maxZ: 4 },
      speed: 5,
      turnSpeed: 2,
      obstacles: [],
      heightmap: makeHM(-4, -4, 4, 4, 1, f),
      maxStep
    });
    const walk = (f: (x: number, z: number) => number | null, maxStep: number) => {
      const s = new GameSession("g", [{ userId: "u", role: "hider" }], cfgH(f, maxStep));
      s.markPresent("u");
      s.setInput("u", 1, 0);
      for (let i = 0; i < 40; i++) s.tick(0.05);
      return s.snapshot()[0];
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
});
