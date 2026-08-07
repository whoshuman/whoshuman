import { MatchmakingSubjects } from "@whoshuman/shared-events";
import type { LobbyStatePayload, MatchFoundPayload } from "@whoshuman/shared-types";
import { MatchmakingService } from "./matchmaking.service";

describe("MatchmakingService", () => {
  let publish: jest.Mock<Promise<void>, [string, unknown]>;
  let service: MatchmakingService;

  const join = (n: number) =>
    service.joinQueue({
      userId: `user-${n}`,
      username: `u${n}`,
      lobbyId: "main",
      socketId: `socket-${n}`
    });
  const ready = (n: number, value: boolean) =>
    service.setReady({ userId: `user-${n}`, lobbyId: "main", ready: value });

  const calls = (subject: string) => publish.mock.calls.filter(([s]) => s === subject);
  const matchFound = () =>
    calls(MatchmakingSubjects.matchFound).map(([, p]) => p as MatchFoundPayload);
  const lastLobbyState = () => {
    const c = calls(MatchmakingSubjects.lobbyUpdated);
    return c.at(-1)?.[1] as LobbyStatePayload | undefined;
  };

  beforeEach(() => {
    publish = jest.fn<Promise<void>, [string, unknown]>().mockResolvedValue(undefined);
    service = new MatchmakingService({ publish } as never);
  });

  it("un jugador entra con ready=false y no arranca", async () => {
    await join(1);
    expect(matchFound()).toHaveLength(0);
    expect(lastLobbyState()?.players).toEqual([{ userId: "user-1", username: "u1", ready: false }]);
  });

  it("con el mínimo pero no todos ready, no arranca", async () => {
    await join(1);
    await join(2);
    await ready(1, true);
    expect(matchFound()).toHaveLength(0);
  });

  it("arranca cuando hay >= min y todos ready", async () => {
    await join(1);
    await join(2);
    await ready(1, true);
    await ready(2, true);
    expect(matchFound()).toHaveLength(1);
    expect(
      matchFound()[0]
        .players.map((p) => p.userId)
        .sort()
    ).toEqual(["user-1", "user-2"]);
    expect(
      matchFound()[0]
        .players.map(({ userId, username }) => ({ userId, username }))
        .sort((a, b) => a.userId.localeCompare(b.userId))
    ).toEqual([
      { userId: "user-1", username: "u1" },
      { userId: "user-2", username: "u2" }
    ]);
    expect(service.getQueueSize("main")).toBe(0);
  });

  it("asigna exactamente un seeker", async () => {
    await join(1);
    await join(2);
    await ready(1, true);
    await ready(2, true);
    const seekers = matchFound()[0].players.filter((p) => p.role === "seeker");
    expect(seekers).toHaveLength(1);
  });

  it("entrar un tercero (no-ready) antes de arrancar bloquea hasta que da ready", async () => {
    await join(1);
    await join(2);
    await ready(1, true);
    await join(3);
    await ready(2, true);
    expect(matchFound()).toHaveLength(0);
    await ready(3, true);
    expect(matchFound()).toHaveLength(1);
    expect(matchFound()[0].players).toHaveLength(3);
  });

  it("toggle off cancela el arranque", async () => {
    await join(1);
    await join(2);
    await ready(1, true);
    await ready(1, false);
    await ready(2, true);
    expect(matchFound()).toHaveLength(0);
  });

  it("leave que deja a los restantes todos-ready arranca", async () => {
    await join(1);
    await join(2);
    await join(3);
    await ready(1, true);
    await ready(2, true);
    await service.leaveQueue({ userId: "user-3", lobbyId: "main", socketId: "socket-3" });
    expect(matchFound()).toHaveLength(1);
    expect(matchFound()[0].players).toHaveLength(2);
  });

  it("setReady de un jugador que no está en la sala se ignora", async () => {
    await ready(1, true);
    expect(matchFound()).toHaveLength(0);
    expect(lastLobbyState()).toBeUndefined();
  });

  it("no duplica un jugador que entra dos veces", async () => {
    await join(1);
    await join(1);
    expect(service.getQueueSize("main")).toBe(1);
  });

  it("restaura los jugadores si la publicación de match.found falla", async () => {
    publish.mockImplementation((subject: string) =>
      subject === MatchmakingSubjects.matchFound
        ? Promise.reject(new Error("nats"))
        : Promise.resolve(undefined)
    );
    await join(1);
    await join(2);
    await ready(1, true);
    await ready(2, true);
    expect(service.getQueueSize("main")).toBe(2);
  });
});
