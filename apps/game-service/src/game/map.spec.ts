import { loadMap, sampleHeight } from "./map";

describe("loadMap", () => {
  it("carga beta-city con bounds válidos y obstacles array", () => {
    const m = loadMap("beta-city");
    expect(m.bounds.maxX).toBeGreaterThan(m.bounds.minX);
    expect(m.bounds.maxZ).toBeGreaterThan(m.bounds.minZ);
    expect(Array.isArray(m.obstacles)).toBe(true);
    expect(m.collectibleSpawns).toHaveLength(7);
    for (const spawn of m.collectibleSpawns) {
      expect(spawn.x).toBeGreaterThanOrEqual(m.bounds.minX);
      expect(spawn.x).toBeLessThanOrEqual(m.bounds.maxX);
      expect(spawn.z).toBeGreaterThanOrEqual(m.bounds.minZ);
      expect(spawn.z).toBeLessThanOrEqual(m.bounds.maxZ);
      expect(sampleHeight(m.heightmap, spawn.x, spawn.z)).not.toBeNull();
      expect(
        m.obstacles.some(
          (wall) =>
            spawn.x >= wall.minX &&
            spawn.x <= wall.maxX &&
            spawn.z >= wall.minZ &&
            spawn.z <= wall.maxZ
        )
      ).toBe(false);
    }
    for (let i = 0; i < m.collectibleSpawns.length; i += 1) {
      for (let j = i + 1; j < m.collectibleSpawns.length; j += 1) {
        const a = m.collectibleSpawns[i];
        const b = m.collectibleSpawns[j];
        expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it("lanza si el mapa no existe", () => {
    expect(() => loadMap("no-existe")).toThrow();
  });
});
