import { GameSubjects } from "@whoshuman/shared-events";
import type { GameStateSnapshotPayload } from "@whoshuman/shared-types";
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

  it("publica game.state.snapshot por tick con los jugadores presentes", async () => {
    service.startGame({ gameId: "g1", players: members });
    service.join({ userId: "u1", gameId: "g1" }); // u2 no hace join
    await jest.advanceTimersByTimeAsync(50); // GAME_TICK_MS default
    const snaps = snapshots();
    expect(snaps.length).toBeGreaterThanOrEqual(1);
    expect(snaps[0].gameId).toBe("g1");
    expect(snaps.at(-1)!.players.map((p) => p.userId)).toEqual(["u1"]);
  });

  it("aplica el input de movimiento", async () => {
    service.startGame({ gameId: "g1", players: members });
    service.join({ userId: "u1", gameId: "g1" });
    await jest.advanceTimersByTimeAsync(50);
    const x0 = snapshots()
      .at(-1)!
      .players.find((p) => p.userId === "u1")!.x;
    service.move({ userId: "u1", gameId: "g1", move: { x: 1, z: 0 } });
    await jest.advanceTimersByTimeAsync(50);
    const x1 = snapshots()
      .at(-1)!
      .players.find((p) => p.userId === "u1")!.x;
    expect(x1).toBeGreaterThan(x0);
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
