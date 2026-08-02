import { ChatSubjects, NotificationSubjects } from "@whoshuman/shared-events";
import { MessagingService } from "../common/messaging.service";
import { PrismaService } from "../prisma/prisma.service";
import { ChatService } from "./chat.service";

function dbUser(id: string, username = id) {
  return {
    id,
    email: `${id}@test.com`,
    username,
    passwordHash: "hash",
    avatar: null,
    bio: null,
    language: "es",
    deletedAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z")
  };
}

describe("ChatService", () => {
  const alice = dbUser("alice");
  const bob = dbUser("bob");
  let prisma: {
    user: { findFirst: jest.Mock; count: jest.Mock };
    friendship: { findFirst: jest.Mock };
    chatMessage: { create: jest.Mock; findMany: jest.Mock };
  };
  let messaging: { publish: jest.Mock };
  let service: ChatService;

  beforeEach(() => {
    prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue(alice),
        count: jest.fn().mockResolvedValue(2)
      },
      friendship: {
        findFirst: jest.fn().mockResolvedValue({ id: "friendship-1" })
      },
      chatMessage: {
        create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
          id: "message-1",
          ...data,
          createdAt: new Date("2026-08-02T10:00:00.000Z"),
          sender: alice
        })),
        findMany: jest.fn().mockResolvedValue([])
      }
    };
    messaging = { publish: jest.fn().mockResolvedValue(undefined) };
    service = new ChatService(
      prisma as unknown as PrismaService,
      messaging as unknown as MessagingService
    );
  });

  it("stores and publishes a direct message only between accepted friends", async () => {
    const message = await service.send({
      senderId: "alice",
      recipientId: "bob",
      scope: "direct",
      content: "  Hola Bob  "
    });

    expect(message).toMatchObject({
      scope: "direct",
      channelId: "alice:bob",
      recipientId: "bob",
      content: "Hola Bob"
    });
    const createArg = (prisma.chatMessage.create.mock.calls[0] as unknown[])[0] as {
      data: Record<string, unknown>;
    };
    expect(createArg.data).toMatchObject({
      scope: "DIRECT",
      channelId: "alice:bob",
      senderId: "alice",
      recipientId: "bob"
    });
    expect(messaging.publish).toHaveBeenCalledWith(ChatSubjects.messageSent, message);
    expect(messaging.publish).toHaveBeenCalledWith(
      NotificationSubjects.send,
      expect.objectContaining({ recipientId: "bob", type: "chat.message.received" })
    );
  });

  it("rejects direct messages when the friendship is no longer accepted", async () => {
    prisma.friendship.findFirst.mockResolvedValue(null);

    await expect(
      service.send({
        senderId: "alice",
        recipientId: "bob",
        scope: "direct",
        content: "Hola"
      })
    ).rejects.toThrow("chatFriendsOnly");
    expect(prisma.chatMessage.create).not.toHaveBeenCalled();
  });

  it("stores lobby messages without creating private notifications", async () => {
    const message = await service.send({
      senderId: "alice",
      scope: "lobby",
      channelId: "main",
      content: "Listos"
    });

    expect(message).toMatchObject({ scope: "lobby", channelId: "main", recipientId: null });
    expect(prisma.friendship.findFirst).not.toHaveBeenCalled();
    expect(messaging.publish).toHaveBeenCalledTimes(1);
    expect(messaging.publish).toHaveBeenCalledWith(ChatSubjects.messageSent, message);
  });

  it("returns the latest history in chronological order", async () => {
    prisma.chatMessage.findMany.mockResolvedValue([
      {
        id: "new",
        scope: "DIRECT",
        channelId: "alice:bob",
        senderId: "bob",
        recipientId: "alice",
        content: "Segundo",
        createdAt: new Date("2026-08-02T10:01:00.000Z"),
        sender: bob
      },
      {
        id: "old",
        scope: "DIRECT",
        channelId: "alice:bob",
        senderId: "alice",
        recipientId: "bob",
        content: "Primero",
        createdAt: new Date("2026-08-02T10:00:00.000Z"),
        sender: alice
      }
    ]);

    const history = await service.history({
      userId: "alice",
      recipientId: "bob",
      scope: "direct"
    });

    expect(history.messages.map((message) => message.id)).toEqual(["old", "new"]);
    expect(prisma.chatMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { scope: "DIRECT", channelId: "alice:bob" },
        take: 100
      })
    );
  });
});
