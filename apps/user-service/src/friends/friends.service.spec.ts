import { Test } from "@nestjs/testing";
import { UserSubjects } from "@whoshuman/shared-events";
import { FriendsService } from "./friends.service";
import { PrismaService } from "../prisma/prisma.service";
import { NATS_SERVICE } from "../config";

interface PrismaMock {
  user: { findUnique: jest.Mock };
  friendship: {
    findFirst: jest.Mock;
    findUnique: jest.Mock;
    findMany: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    deleteMany: jest.Mock;
    upsert: jest.Mock;
  };
}

function dbUser(overrides: Record<string, unknown> = {}) {
  return {
    id: "alice",
    email: "alice@test.com",
    username: "alice",
    avatar: null,
    bio: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides
  };
}

describe("FriendsService", () => {
  let service: FriendsService;
  let prisma: PrismaMock;
  let client: { emit: jest.Mock };

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn() },
      friendship: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
        upsert: jest.fn()
      }
    };
    client = { emit: jest.fn().mockReturnValue({ subscribe: jest.fn() }) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        FriendsService,
        { provide: PrismaService, useValue: prisma },
        { provide: NATS_SERVICE, useValue: client }
      ]
    }).compile();

    service = moduleRef.get(FriendsService);
  });

  describe("sendRequest", () => {
    it("rejects friending yourself", async () => {
      await expect(
        service.sendRequest({ requesterId: "alice", addresseeId: "alice" })
      ).rejects.toThrow("cannotFriendYourself");
      expect(prisma.friendship.create).not.toHaveBeenCalled();
    });

    it("creates a PENDING request and emits friendRequestReceived", async () => {
      prisma.friendship.findFirst.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue(dbUser({ id: "alice" }));
      prisma.friendship.create.mockResolvedValue({ id: "f1", addresseeId: "bob" });

      const result = await service.sendRequest({ requesterId: "alice", addresseeId: "bob" });

      expect(result).toEqual({ success: true });
      expect(prisma.friendship.create).toHaveBeenCalledWith({
        data: { requesterId: "alice", addresseeId: "bob", status: "PENDING" }
      });
      expect(client.emit).toHaveBeenCalledWith(
        UserSubjects.friendRequestReceived,
        expect.objectContaining({ recipientId: "bob", friendshipId: "f1" })
      );
    });

    it("SILENTLY no-ops when blocked in either direction (no row, no event, success)", async () => {
      prisma.friendship.findFirst.mockResolvedValue({ id: "b1", status: "BLOCKED" });

      const result = await service.sendRequest({ requesterId: "alice", addresseeId: "bob" });

      expect(result).toEqual({ success: true });
      expect(prisma.friendship.create).not.toHaveBeenCalled();
      expect(client.emit).not.toHaveBeenCalled();
    });

    it("rejects with alreadyFriends when a non-blocked relationship exists", async () => {
      prisma.friendship.findFirst.mockResolvedValue({ id: "p1", status: "PENDING" });

      await expect(
        service.sendRequest({ requesterId: "alice", addresseeId: "bob" })
      ).rejects.toThrow("alreadyFriends");
      expect(prisma.friendship.create).not.toHaveBeenCalled();
    });
  });

  describe("respondRequest", () => {
    it("accepts: updates to ACCEPTED and emits friendRequestAccepted", async () => {
      prisma.friendship.findUnique.mockResolvedValue({
        id: "f1",
        requesterId: "alice",
        addresseeId: "bob",
        status: "PENDING"
      });
      prisma.user.findUnique.mockResolvedValue(dbUser({ id: "bob", username: "bob" }));
      prisma.friendship.update.mockResolvedValue({});

      const result = await service.respondRequest({
        userId: "bob",
        friendshipId: "f1",
        accept: true
      });

      expect(result).toEqual({ success: true });
      expect(prisma.friendship.update).toHaveBeenCalledWith({
        where: { id: "f1" },
        data: { status: "ACCEPTED" }
      });
      expect(client.emit).toHaveBeenCalledWith(
        UserSubjects.friendRequestAccepted,
        expect.objectContaining({ recipientId: "alice", friendshipId: "f1" })
      );
    });

    it("rejects: deletes the row, no event", async () => {
      prisma.friendship.findUnique.mockResolvedValue({
        id: "f1",
        requesterId: "alice",
        addresseeId: "bob",
        status: "PENDING"
      });
      prisma.friendship.delete.mockResolvedValue({});

      const result = await service.respondRequest({
        userId: "bob",
        friendshipId: "f1",
        accept: false
      });

      expect(result).toEqual({ success: true });
      expect(prisma.friendship.delete).toHaveBeenCalledWith({ where: { id: "f1" } });
      expect(client.emit).not.toHaveBeenCalled();
    });

    it("throws notAllowed when responder is not the addressee", async () => {
      prisma.friendship.findUnique.mockResolvedValue({
        id: "f1",
        requesterId: "alice",
        addresseeId: "bob",
        status: "PENDING"
      });

      await expect(
        service.respondRequest({ userId: "carol", friendshipId: "f1", accept: true })
      ).rejects.toThrow("notAllowed");
    });

    it("throws friendshipNotFound when the request does not exist", async () => {
      prisma.friendship.findUnique.mockResolvedValue(null);

      await expect(
        service.respondRequest({ userId: "bob", friendshipId: "ghost", accept: true })
      ).rejects.toThrow("friendshipNotFound");
    });
  });

  describe("findFriends", () => {
    it("returns ACCEPTED relationships mapped to the OTHER user", async () => {
      prisma.friendship.findMany.mockResolvedValue([
        {
          id: "f1",
          status: "ACCEPTED",
          createdAt: new Date("2026-01-01"),
          requesterId: "alice",
          addresseeId: "bob",
          requester: dbUser({ id: "alice", username: "alice" }),
          addressee: dbUser({ id: "bob", username: "bob" })
        }
      ]);

      const result = await service.findFriends({ userId: "alice" });

      expect(result).toHaveLength(1);
      expect(result[0].user.id).toBe("bob");
      expect(result[0].status).toBe("ACCEPTED");
      expect(result[0].createdAt).toBe("2026-01-01T00:00:00.000Z");
    });
  });

  describe("block", () => {
    it("upserts a BLOCKED relationship", async () => {
      prisma.friendship.deleteMany.mockResolvedValue({ count: 0 });
      prisma.friendship.upsert.mockResolvedValue({});
      const result = await service.block({ blockerId: "alice", targetId: "bob" });
      expect(result).toEqual({ success: true });
      expect(prisma.friendship.upsert).toHaveBeenCalled();
    });
  });
});
