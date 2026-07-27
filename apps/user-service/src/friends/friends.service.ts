import { Injectable, Logger } from "@nestjs/common";
import { RpcException } from "@nestjs/microservices";
import type { User } from "@prisma/client";
import { NotificationSubjects } from "@whoshuman/shared-events";
import type {
  BlockUserPayload,
  FindBlockedUsersPayload,
  FindFriendsPayload,
  FindPendingRequestsPayload,
  FriendActionResponse,
  Friendship,
  NotificationEnvelope,
  RemoveFriendPayload,
  RespondFriendRequestPayload,
  SendFriendRequestPayload,
  UnblockUserPayload
} from "@whoshuman/shared-types";
import { MessagingService, toActor, toUserProfile } from "../common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class FriendsService {
  private readonly logger = new Logger(FriendsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly messaging: MessagingService
  ) {}

  /** Emite una notificación sin que un fallo de entrega rompa la operación principal. */
  private async notify(envelope: NotificationEnvelope): Promise<void> {
    try {
      await this.messaging.publish(NotificationSubjects.send, envelope);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`No se pudo publicar la notificación: ${message}`);
    }
  }

  private fail(statusCode: number, message: string): never {
    throw new RpcException({ statusCode, message });
  }

  /** Find any relationship between two users, in EITHER direction. */
  private relationBetween(a: string, b: string) {
    return this.prisma.friendship.findFirst({
      where: {
        OR: [
          { requesterId: a, addresseeId: b },
          { requesterId: b, addresseeId: a }
        ]
      }
    });
  }

  private async requireActiveUsers(...userIds: string[]): Promise<User[]> {
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds }, deletedAt: null }
    });
    if (users.length !== new Set(userIds).size) this.fail(404, "userNotFound");
    return userIds.map((id) => users.find((user) => user.id === id) as User);
  }

  async sendRequest(payload: SendFriendRequestPayload): Promise<FriendActionResponse> {
    const { requesterId, addresseeId } = payload;

    if (requesterId === addresseeId) this.fail(400, "cannotFriendYourself");
    const [requester] = await this.requireActiveUsers(requesterId, addresseeId);

    const existing = await this.relationBetween(requesterId, addresseeId);
    if (existing) {
      // Silent block: looks exactly like a successful send, but does nothing.
      if (existing.status === "BLOCKED") return { success: true };
      this.fail(409, "alreadyFriends");
    }

    const friendship = await this.prisma.friendship.create({
      data: { requesterId, addresseeId, status: "PENDING" }
    });

    await this.notify({
      recipientId: addresseeId,
      type: "friend.request.received",
      from: toActor(requester),
      data: { friendshipId: friendship.id }
    });

    return { success: true };
  }

  async respondRequest(payload: RespondFriendRequestPayload): Promise<FriendActionResponse> {
    const { userId, friendshipId, accept } = payload;

    const friendship = await this.prisma.friendship.findUnique({
      where: { id: friendshipId }
    });
    if (!friendship || friendship.status !== "PENDING") this.fail(404, "friendshipNotFound");
    if (friendship.addresseeId !== userId) this.fail(403, "notAllowed");

    if (!accept) {
      await this.prisma.friendship.delete({ where: { id: friendshipId } });
      return { success: true };
    }

    await this.prisma.friendship.update({
      where: { id: friendshipId },
      data: { status: "ACCEPTED" }
    });

    const accepter = await this.prisma.user.findUnique({
      where: { id: userId }
    });
    if (accepter) {
      await this.notify({
        recipientId: friendship.requesterId,
        type: "friend.request.accepted",
        from: toActor(accepter),
        data: { friendshipId }
      });
    }

    return { success: true };
  }

  async removeFriend(payload: RemoveFriendPayload): Promise<FriendActionResponse> {
    const { userId, friendshipId } = payload;
    const friendship = await this.prisma.friendship.findUnique({ where: { id: friendshipId } });
    if (!friendship || friendship.status !== "ACCEPTED") this.fail(404, "friendshipNotFound");
    if (friendship.requesterId !== userId && friendship.addresseeId !== userId) {
      this.fail(403, "notAllowed");
    }
    await this.prisma.friendship.delete({ where: { id: friendshipId } });
    return { success: true };
  }

  async block(payload: BlockUserPayload): Promise<FriendActionResponse> {
    const { blockerId, targetId } = payload;
    if (blockerId === targetId) this.fail(400, "cannotFriendYourself");
    await this.requireActiveUsers(blockerId, targetId);

    // Remove any reverse relationship so the block is the single source of truth.
    await this.prisma.friendship.deleteMany({
      where: { requesterId: targetId, addresseeId: blockerId }
    });

    await this.prisma.friendship.upsert({
      where: { requesterId_addresseeId: { requesterId: blockerId, addresseeId: targetId } },
      update: { status: "BLOCKED" },
      create: { requesterId: blockerId, addresseeId: targetId, status: "BLOCKED" }
    });
    return { success: true };
  }

  async unblock(payload: UnblockUserPayload): Promise<FriendActionResponse> {
    const { blockerId, targetId } = payload;
    await this.prisma.friendship.deleteMany({
      where: { requesterId: blockerId, addresseeId: targetId, status: "BLOCKED" }
    });
    return { success: true };
  }

  async findFriends(payload: FindFriendsPayload): Promise<Friendship[]> {
    const rows = await this.prisma.friendship.findMany({
      where: {
        status: "ACCEPTED",
        OR: [{ requesterId: payload.userId }, { addresseeId: payload.userId }]
      },
      include: { requester: true, addressee: true }
    });
    return rows.map((row) => this.mapToOther(row, payload.userId));
  }

  async findPendingRequests(payload: FindPendingRequestsPayload): Promise<Friendship[]> {
    const rows = await this.prisma.friendship.findMany({
      where: { status: "PENDING", addresseeId: payload.userId },
      include: { requester: true, addressee: true }
    });
    return rows.map((row) => this.mapToOther(row, payload.userId));
  }

  async findBlockedUsers(payload: FindBlockedUsersPayload): Promise<Friendship[]> {
    const rows = await this.prisma.friendship.findMany({
      where: { status: "BLOCKED", requesterId: payload.userId },
      include: { requester: true, addressee: true }
    });
    return rows.map((row) => this.mapToOther(row, payload.userId));
  }

  private mapToOther(
    row: {
      id: string;
      status: "PENDING" | "ACCEPTED" | "BLOCKED";
      createdAt: Date;
      requesterId: string;
      requester: User;
      addressee: User;
    },
    userId: string
  ): Friendship {
    const other = row.requesterId === userId ? row.addressee : row.requester;
    return {
      id: row.id,
      status: row.status,
      user: toUserProfile(other),
      createdAt: row.createdAt.toISOString()
    };
  }
}
