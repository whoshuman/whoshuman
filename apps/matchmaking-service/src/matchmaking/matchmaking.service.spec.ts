import { MatchmakingSubjects } from "@whoshuman/shared-events";
import type { MatchFoundPayload } from "@whoshuman/shared-types";
import { MatchmakingService } from "./matchmaking.service";

describe("MatchmakingService", () => {
  let publish: jest.Mock;
  let service: MatchmakingService;

  beforeEach(() => {
    publish = jest.fn().mockResolvedValue(undefined);
    service = new MatchmakingService({ publish } as never);
  });

  it("queues a player without creating a match before the minimum size", async () => {
    await service.joinQueue({
      userId: "user-1",
      username: "alice",
      lobbyId: "main",
      socketId: "socket-1"
    });

    expect(service.getQueueSize("main")).toBe(1);
    expect(publish).not.toHaveBeenCalled();
  });

  it("publishes matchFound and clears matched players when the queue is ready", async () => {
    await service.joinQueue({
      userId: "user-1",
      username: "alice",
      lobbyId: "main",
      socketId: "socket-1"
    });
    await service.joinQueue({
      userId: "user-2",
      username: "bob",
      lobbyId: "main",
      socketId: "socket-2"
    });

    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledWith(
      MatchmakingSubjects.matchFound,
      expect.objectContaining<Partial<MatchFoundPayload>>({
        lobbyId: "main",
        playerIds: ["user-1", "user-2"]
      })
    );
    expect(service.getQueueSize("main")).toBe(0);
  });

  it("does not duplicate a player that joins the queue twice", async () => {
    await service.joinQueue({
      userId: "user-1",
      username: "alice",
      lobbyId: "main",
      socketId: "socket-1"
    });
    await service.joinQueue({
      userId: "user-1",
      username: "alice",
      lobbyId: "main",
      socketId: "socket-1"
    });

    expect(service.getQueueSize("main")).toBe(1);
    expect(publish).not.toHaveBeenCalled();
  });

  it("removes a player from the queue", async () => {
    await service.joinQueue({
      userId: "user-1",
      username: "alice",
      lobbyId: "main",
      socketId: "socket-1"
    });

    service.leaveQueue({
      userId: "user-1",
      lobbyId: "main",
      socketId: "socket-1"
    });

    expect(service.getQueueSize("main")).toBe(0);
  });

  it("ignores invalid joinQueue payloads", async () => {
    await service.joinQueue({ lobbyId: "main" });

    expect(service.getQueueSize("main")).toBe(0);
    expect(publish).not.toHaveBeenCalled();
  });

  it("ignores invalid leaveQueue payloads", () => {
    service.leaveQueue({ lobbyId: "main" });

    expect(service.getQueueSize("main")).toBe(0);
  });

  it("restores players to the queue when matchFound publishing fails", async () => {
    publish.mockRejectedValueOnce(new Error("nats unavailable"));

    await service.joinQueue({
      userId: "user-1",
      username: "alice",
      lobbyId: "main",
      socketId: "socket-1"
    });
    await service.joinQueue({
      userId: "user-2",
      username: "bob",
      lobbyId: "main",
      socketId: "socket-2"
    });

    expect(service.getQueueSize("main")).toBe(2);
  });
});
