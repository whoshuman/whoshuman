import { GameSession } from "./game-session";

const config = { mapSize: 50, speed: 5 };
const members = [
  { userId: "u1", role: "seeker" as const },
  { userId: "u2", role: "hider" as const }
];
const find = (s: GameSession, id: string) => s.snapshot().find((p) => p.userId === id)!;

describe("GameSession", () => {
  it("integra el movimiento según move·speed·dt", () => {
    const s = new GameSession("g1", members, config);
    s.markPresent("u1");
    const before = find(s, "u1");
    s.setMove("u1", { x: 1, z: 0 });
    s.tick(0.05); // 5 * 0.05 = 0.25
    expect(find(s, "u1").x - before.x).toBeCloseTo(0.25, 5);
  });

  it("normaliza move cuando |move| > 1 (no acelera)", () => {
    const s = new GameSession("g1", members, config);
    s.markPresent("u1");
    const before = find(s, "u1");
    s.setMove("u1", { x: 10, z: 0 }); // |move|=10 → normalizado a 1
    s.tick(0.05);
    expect(find(s, "u1").x - before.x).toBeCloseTo(0.25, 5);
  });

  it("deriva rotationY del vector de movimiento", () => {
    const s = new GameSession("g1", members, config);
    s.markPresent("u1");
    s.setMove("u1", { x: 1, z: 0 });
    s.tick(0.05);
    expect(find(s, "u1").rotationY).toBeCloseTo(Math.PI / 2, 5); // atan2(1,0)
  });

  it("no mueve a un jugador quieto (move {0,0})", () => {
    const s = new GameSession("g1", members, config);
    s.markPresent("u1");
    const before = find(s, "u1");
    s.setMove("u1", { x: 0, z: 0 });
    s.tick(0.05);
    const after = find(s, "u1");
    expect(after.x).toBe(before.x);
    expect(after.z).toBe(before.z);
  });

  it("recorta la posición a los límites del mapa", () => {
    const s = new GameSession("g1", members, config);
    s.markPresent("u1");
    s.setMove("u1", { x: 1, z: 0 });
    for (let i = 0; i < 1000; i += 1) s.tick(0.05);
    expect(find(s, "u1").x).toBeLessThanOrEqual(25);
  });

  it("solo incluye en el snapshot a jugadores presentes", () => {
    const s = new GameSession("g1", members, config);
    s.markPresent("u1"); // u2 no hace join
    expect(s.snapshot().map((p) => p.userId)).toEqual(["u1"]);
  });

  it("queda vacío cuando se van todos", () => {
    const s = new GameSession("g1", members, config);
    s.removePlayer("u1");
    s.removePlayer("u2");
    expect(s.isEmpty).toBe(true);
  });
});
