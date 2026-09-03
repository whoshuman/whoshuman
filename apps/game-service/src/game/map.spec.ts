import { GAME_RULES } from "./game-session";
import { loadMap, sampleHeight } from "./map";

describe("loadMap", () => {
  it("carga beta-city con bounds válidos y obstacles array", () => {
    const m = loadMap("beta-city");
    expect(m.bounds.maxX).toBeGreaterThan(m.bounds.minX);
    expect(m.bounds.maxZ).toBeGreaterThan(m.bounds.minZ);
    expect(Array.isArray(m.obstacles)).toBe(true);
    // Las células nacen SOLO en pads, así que tiene que haber de sobra: con cuatro, quien
    // se plantara encima de uno cobraría por esperar. Ver PAD_CAMP_CLEARANCE.
    expect(m.pads.length).toBeGreaterThanOrEqual(10);
    for (const pad of m.pads) {
      expect(pad.x).toBeGreaterThanOrEqual(m.bounds.minX);
      expect(pad.x).toBeLessThanOrEqual(m.bounds.maxX);
      expect(pad.z).toBeGreaterThanOrEqual(m.bounds.minZ);
      expect(pad.z).toBeLessThanOrEqual(m.bounds.maxZ);
      expect(sampleHeight(m.heightmap, pad.x, pad.z)).not.toBeNull();
      expect(
        m.obstacles.some(
          (wall) =>
            pad.x >= wall.minX && pad.x <= wall.maxX && pad.z >= wall.minZ && pad.z <= wall.maxZ
        )
      ).toBe(false);
    }
    // Ninguno pegado a otro: dos pads en el mismo sitio no son dos sitios donde buscar.
    for (let i = 0; i < m.pads.length; i += 1) {
      for (let j = i + 1; j < m.pads.length; j += 1) {
        const a = m.pads[i];
        const b = m.pads[j];
        expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThanOrEqual(0.5);
      }
    }
  });

  // El mapa de verdad. El mínimo no es un gusto: con 8 jugadores como mucho, el peor caso
  // son 7 infiltrados tapando un pad cada uno más las 7 células ya repartidas; si los pads
  // no pasan de ahí, el reparto se queda sin sitio y la regla anticamping deja de valer.
  it("neon-block trae pads de sobra y todos sobre calle", () => {
    const m = loadMap("neon-block");
    expect(m.pads.length).toBeGreaterThan(GAME_RULES.collectibleCount + 7);
    for (const pad of m.pads) {
      expect(sampleHeight(m.heightmap, pad.x, pad.z)).not.toBeNull();
      // Con el margen de la célula: un pad rozando la pared dejaría la célula dentro
      // del edificio, donde no se puede recoger.
      const margin = 0.24;
      expect(
        m.obstacles.some(
          (wall) =>
            pad.x >= wall.minX - margin &&
            pad.x <= wall.maxX + margin &&
            pad.z >= wall.minZ - margin &&
            pad.z <= wall.maxZ + margin
        )
      ).toBe(false);
    }
  });

  it("lanza si el mapa no existe", () => {
    expect(() => loadMap("no-existe")).toThrow();
  });
});
