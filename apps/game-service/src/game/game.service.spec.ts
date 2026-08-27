import { GameSubjects } from "@whoshuman/shared-events";
import type { GameStateSnapshotPayload } from "@whoshuman/shared-types";
import { envs } from "../config";
import { GAME_RULES } from "./game-session";
import { GameService } from "./game.service";

describe("GameService", () => {
  let publish: jest.Mock<Promise<void>, [string, unknown]>;
  let prisma: {
    game: { upsert: jest.Mock };
    round: { deleteMany: jest.Mock; createMany: jest.Mock };
    score: { upsert: jest.Mock };
    $transaction: jest.Mock;
  };
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
    prisma = {
      game: { upsert: jest.fn().mockResolvedValue({}) },
      round: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 3 })
      },
      score: { upsert: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn().mockResolvedValue([])
    };
    service = new GameService({ publish } as never, prisma as never);
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
    expect(joined?.selfUserId).toBe("u1");
    expect(snaps.at(-1)!.entities).toHaveLength(envs.gameNpcCount + 1);
    expect(snaps.at(-1)!.collectibles).toHaveLength(GAME_RULES.collectibleCount);
    expect(snaps.at(-1)!.round).toMatchObject({
      phase: "playing",
      current: 1,
      total: GAME_RULES.totalRounds
    });
    expect(snaps.at(-1)!.scores).toHaveLength(2);
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

  it("avisa del abandono con un último snapshot y no guarda nada", async () => {
    const trio = [...members, { userId: "u3", role: "hider" as const }];
    service.startGame({ gameId: "g1", players: trio, minPlayers: 3 });
    service.join({ userId: "u1", gameId: "g1" });
    service.join({ userId: "u2", gameId: "g1" });
    service.join({ userId: "u3", gameId: "g1" });

    service.leave({ userId: "u3", gameId: "g1" });
    await jest.advanceTimersByTimeAsync(envs.gameTickMs);

    // El que sigue dentro tiene que enterarse: de ahí el snapshot final.
    expect(snapshots().at(-1)!.round).toMatchObject({
      phase: "finished",
      endReason: "abandoned"
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.score.upsert).not.toHaveBeenCalled();
    expect(service.getGameCount()).toBe(0);
  });

  it("guarda partida, rondas y marcador una sola vez al terminar la tercera ronda", async () => {
    service.startGame({ gameId: "g1", players: members });
    const seeker = service.join({ userId: "u1", gameId: "g1" })!;
    const hider = service.join({ userId: "u2", gameId: "g1" })!;

    service.aim({ userId: "u1", gameId: "g1", aiming: true });
    service.shoot({ userId: "u1", gameId: "g1", targetEntityId: hider.selfEntityId });
    await jest.advanceTimersByTimeAsync(GAME_RULES.intermissionSeconds * 1000 + envs.gameTickMs);

    service.aim({ userId: "u2", gameId: "g1", aiming: true });
    service.shoot({ userId: "u2", gameId: "g1", targetEntityId: seeker.selfEntityId });
    await jest.advanceTimersByTimeAsync(GAME_RULES.intermissionSeconds * 1000 + envs.gameTickMs);

    service.aim({ userId: "u1", gameId: "g1", aiming: true });
    service.shoot({ userId: "u1", gameId: "g1", targetEntityId: hider.selfEntityId });
    await jest.advanceTimersByTimeAsync(envs.gameTickMs);

    expect(prisma.game.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.round.deleteMany).toHaveBeenCalledWith({ where: { gameId: "g1" } });
    const roundCreateArg = (prisma.round.createMany.mock.calls[0] as unknown[])[0] as {
      data: { gameId: string; number: number; status: string }[];
    };
    expect(roundCreateArg.data).toEqual([
      expect.objectContaining({ gameId: "g1", number: 1, status: "ENDED" }),
      expect.objectContaining({ gameId: "g1", number: 2, status: "ENDED" }),
      expect.objectContaining({ gameId: "g1", number: 3, status: "ENDED" })
    ]);
    expect(prisma.score.upsert).toHaveBeenCalledTimes(2);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.$transaction.mock.invocationCallOrder[0]).toBeLessThan(
      publish.mock.invocationCallOrder.at(-1) as number
    );
    expect(service.getGameCount()).toBe(0);
  });

  it("ignora payloads inválidos", () => {
    service.startGame({ gameId: "g1" }); // sin players
    expect(service.getGameCount()).toBe(0);
  });
});
