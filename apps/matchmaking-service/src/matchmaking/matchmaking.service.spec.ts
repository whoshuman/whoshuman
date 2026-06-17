import { MatchmakingSubjects } from "@whoshuman/shared-events";
import type { LobbyStatePayload, MatchFoundPayload } from "@whoshuman/shared-types";
import { MatchmakingService } from "./matchmaking.service";

// Defaults de envs.ts cuando no hay process.env: min=2, max=8, countdown=10000ms.
const COUNTDOWN_MS = 10000;

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

  const calls = (subject: string) => publish.mock.calls.filter(([s]) => s === subject);
  const matchFound = () =>
    calls(MatchmakingSubjects.matchFound).map(([, p]) => p as MatchFoundPayload);
  const lastLobbyState = () => {
    const lobbyCalls = calls(MatchmakingSubjects.lobbyUpdated);
    return lobbyCalls.at(-1)?.[1] as LobbyStatePayload | undefined;
  };

  beforeEach(() => {
    jest.useFakeTimers();
    publish = jest.fn<Promise<void>, [string, unknown]>().mockResolvedValue(undefined);
    service = new MatchmakingService({ publish } as never);
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it("emits lobby state (waiting) below the minimum, without starting", async () => {
    await join(1);

    expect(matchFound()).toHaveLength(0);
    expect(lastLobbyState()).toMatchObject({ count: 1, status: "waiting", startsAt: null });
    expect(jest.getTimerCount()).toBe(0);
  });

  it("starts the countdown when reaching the minimum, without matching yet", async () => {
    await join(1);
    await join(2);

    expect(matchFound()).toHaveLength(0);
    const state = lastLobbyState();
    expect(state?.status).toBe("starting");
    expect(typeof state?.startsAt).toBe("number");
    expect(jest.getTimerCount()).toBe(1);
  });

  it("matches when the countdown expires", async () => {
    await join(1);
    await join(2);
    await jest.advanceTimersByTimeAsync(COUNTDOWN_MS);

    expect(matchFound()).toHaveLength(1);
    expect(matchFound()[0].players.map((p) => p.userId)).toEqual(["user-1", "user-2"]);
    expect(service.getQueueSize("main")).toBe(0);
  });

  it("starts immediately when the lobby fills to the maximum", async () => {
    for (let n = 1; n <= 8; n += 1) await join(n);

    expect(matchFound()).toHaveLength(1);
    expect(matchFound()[0].players).toHaveLength(8);
    expect(service.getQueueSize("main")).toBe(0);
  });

  it("assigns exactly one seeker and the rest hiders", async () => {
    await join(1);
    await join(2);
    await jest.advanceTimersByTimeAsync(COUNTDOWN_MS);

    const { players } = matchFound()[0];
    const seekers = players.filter((p) => p.role === "seeker");
    const hiders = players.filter((p) => p.role === "hider");
    expect(seekers).toHaveLength(1);
    expect(hiders).toHaveLength(1);
    expect(new Set(players.map((p) => p.userId)).size).toBe(players.length);
  });

  it("cancels the countdown when a leave drops the lobby below the minimum", async () => {
    await join(1);
    await join(2);
    expect(jest.getTimerCount()).toBe(1);

    await service.leaveQueue({ userId: "user-2", lobbyId: "main", socketId: "socket-2" });

    expect(jest.getTimerCount()).toBe(0);
    expect(lastLobbyState()).toMatchObject({ count: 1, status: "waiting", startsAt: null });
    expect(matchFound()).toHaveLength(0);
  });

  it("does not duplicate a player that joins twice", async () => {
    await join(1);
    await join(1);

    expect(service.getQueueSize("main")).toBe(1);
    expect(matchFound()).toHaveLength(0);
  });

  it("removes a player from the queue", async () => {
    await join(1);
    await service.leaveQueue({ userId: "user-1", lobbyId: "main", socketId: "socket-1" });

    expect(service.getQueueSize("main")).toBe(0);
  });

  it("ignores invalid joinQueue payloads", async () => {
    await service.joinQueue({ lobbyId: "main" });

    expect(service.getQueueSize("main")).toBe(0);
    expect(publish).not.toHaveBeenCalled();
  });

  it("ignores invalid leaveQueue payloads", async () => {
    await service.leaveQueue({ lobbyId: "main" });

    expect(service.getQueueSize("main")).toBe(0);
  });

  it("restores players to the lobby when matchFound publishing fails", async () => {
    publish.mockImplementation((subject: string) =>
      subject === MatchmakingSubjects.matchFound
        ? Promise.reject(new Error("nats unavailable"))
        : Promise.resolve(undefined)
    );

    await join(1);
    await join(2);
    await jest.advanceTimersByTimeAsync(COUNTDOWN_MS);

    expect(service.getQueueSize("main")).toBe(2);
  });
});
