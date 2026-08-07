import { loadMap } from "./map";

describe("loadMap", () => {
  it("carga beta-city con bounds válidos y obstacles array", () => {
    const m = loadMap("beta-city");
    expect(m.bounds.maxX).toBeGreaterThan(m.bounds.minX);
    expect(m.bounds.maxZ).toBeGreaterThan(m.bounds.minZ);
    expect(Array.isArray(m.obstacles)).toBe(true);
  });

  it("lanza si el mapa no existe", () => {
    expect(() => loadMap("no-existe")).toThrow();
  });
});
