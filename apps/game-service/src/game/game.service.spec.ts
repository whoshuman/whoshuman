import { GameSubjects } from "@whoshuman/shared-events";
import type { GameStateSnapshotPayload } from "@whoshuman/shared-types";
import { envs } from "../config";
import { GameService } from "./game.service";

describe("GameService", () => {
  let publish: jest.Mock<Promise<void>, [string, unknown]>;
  let service: GameService;

  const members = [
    { userId: "u1", role: "seeker" as const },
    { userId: "u2", role: "hider" as const }
  ];
  const snapshots = () =>
    publish.mock.calls
      .filter(([s]) => s === GameSubjects.stateSnapshot)
      .map(([, p]) => p as GameStateSnapshotPayload);

  beforeEach(() => {
    jest.useFakeTimers();
    publish = jest.fn<Promise<void>, [string, unknown]>().mockResolvedValue(undefined);
    service = new GameService({ publish } as never);
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it("arranca una partida al recibir match.found", () => {
    service.startGame({ gameId: "g1", players: members });
    expect(service.getGameCount()).toBe(1);
    expect(jest.getTimerCount()).toBe(1);
  });

  it("ignora match.found duplicado (idempotente)", () => {
    service.startGame({ gameId: "g1", players: members });
    service.startGame({ gameId: "g1", players: members });
    expect(service.getGameCount()).toBe(1);
  });

  it("publica un snapshot anónimo sin distinguir jugadores de NPC", async () => {
    service.startGame({ gameId: "g1", players: members });
    const joined = service.join({ userId: "u1", gameId: "g1" });
    await jest.advanceTimersByTimeAsync(50); // GAME_TICK_MS default
    const snaps = snapshots();
    expect(snaps.length).toBeGreaterThanOrEqual(1);
    expect(snaps[0].gameId).toBe("g1");
    expect(joined?.role).toBe("seeker");
    expect(snaps.at(-1)!.entities).toHaveLength(envs.gameNpcCount + 1);
    expect(snaps.at(-1)!.entities.some((entity) => entity.entityId === joined?.selfEntityId)).toBe(
      false
    );
    for (const entity of snaps.at(-1)!.entities) {
      expect(entity).not.toHaveProperty("userId");
      expect(entity).not.toHaveProperty("npcId");
      expect(entity).not.toHaveProperty("mode");
    }
  });

  it("aplica el input (avanzar) del jugador", async () => {
    service.startGame({ gameId: "g1", players: members });
    const joined = service.join({ userId: "u2", gameId: "g1" })!;
    await jest.advanceTimersByTimeAsync(50);
    const z0 = snapshots()
      .at(-1)!
      .entities.find((p) => p.entityId === joined.selfEntityId)!.z;
    service.input({ userId: "u2", gameId: "g1", forward: 1, turn: 0 }); // avanza hacia +z
    await jest.advanceTimersByTimeAsync(50);
    const z1 = snapshots()
      .at(-1)!
      .entities.find((p) => p.entityId === joined.selfEntityId)!.z;
    expect(z1).toBeGreaterThan(z0);
  });

  it("solo permite disparar al seeker de la partida", async () => {
    service.startGame({ gameId: "g1", players: members });
    service.join({ userId: "u1", gameId: "g1" });
    const hider = service.join({ userId: "u2", gameId: "g1" })!;

    expect(service.shoot({ userId: "u2", gameId: "g1", targetEntityId: hider.selfEntityId })).toBe(
      false
    );
    expect(service.shoot({ userId: "u1", gameId: "g1", targetEntityId: hider.selfEntityId })).toBe(
      false
    );
    expect(service.aim({ userId: "u1", gameId: "g1", aiming: true })).toBe(true);
    expect(service.shoot({ userId: "u1", gameId: "g1", targetEntityId: hider.selfEntityId })).toBe(
      true
    );
    await jest.advanceTimersByTimeAsync(50);
    expect(
      snapshots()
        .at(-1)!
        .entities.some((entity) => entity.entityId === hider.selfEntityId)
    ).toBe(false);
  });

  it("rechaza el join de un usuario que no pertenece a la partida", () => {
    service.startGame({ gameId: "g1", players: members });
    expect(service.join({ userId: "intruder", gameId: "g1" })).toBeNull();
  });

  it("reconecta durante 45 segundos con la misma entidad y el mismo rol", () => {
    service.startGame({ gameId: "g1", players: members });
    const first = service.join({ userId: "u2", gameId: "g1", socketId: "old" })!;

    service.disconnect({ userId: "u2", gameId: "g1", socketId: "old" });
    jest.advanceTimersByTime(44_999);
    const resumed = service.join({ userId: "u2", gameId: "g1", socketId: "new" });

    expect(resumed).toEqual(first);
    // Un disconnect tardío del socket viejo no debe afectar al socket nuevo.
    service.disconnect({ userId: "u2", gameId: "g1", socketId: "old" });
    jest.advanceTimersByTime(45_001);
    expect(service.join({ userId: "u2", gameId: "g1", socketId: "newer" })).toEqual(first);
  });

  it("elimina al jugador si no vuelve antes de 45 segundos", () => {
    service.startGame({ gameId: "g1", players: members });
    service.join({ userId: "u2", gameId: "g1", socketId: "socket" });
    service.disconnect({ userId: "u2", gameId: "g1", socketId: "socket" });

    jest.advanceTimersByTime(45_000);

    expect(service.join({ userId: "u2", gameId: "g1", socketId: "new" })).toBeNull();
  });

  it("para el loop y elimina la partida cuando se van todos", () => {
    service.startGame({ gameId: "g1", players: members });
    service.leave({ userId: "u1", gameId: "g1" });
    service.leave({ userId: "u2", gameId: "g1" });
    expect(jest.getTimerCount()).toBe(0);
    expect(service.getGameCount()).toBe(0);
  });

  it("ignora payloads inválidos", () => {
    service.startGame({ gameId: "g1" }); // sin players
    expect(service.getGameCount()).toBe(0);
  });
});
