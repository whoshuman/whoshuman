import { Inject, Injectable } from "@nestjs/common";
import { ClientProxy, RpcException } from "@nestjs/microservices";
import type { User } from "@prisma/client";
import { UserSubjects } from "@whoshuman/shared-events";
import type {
  BlockUserPayload,
  FindFriendsPayload,
  FindPendingRequestsPayload,
  FriendActionResponse,
  Friendship,
  PublicUser,
  RemoveFriendPayload,
  RespondFriendRequestPayload,
  SendFriendRequestPayload,
  UnblockUserPayload
} from "@whoshuman/shared-types";
import { NATS_SERVICE } from "../config";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class FriendsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(NATS_SERVICE) private readonly client: ClientProxy
  ) {}

  private fail(statusCode: number, message: string): never {
    throw new RpcException({ statusCode, message });
  }

  private toPublicUser(u: User): PublicUser {
    return {
      id: u.id,
      email: u.email,
      username: u.username,
      avatar: u.avatar,
      bio: u.bio,
      createdAt: u.createdAt.toISOString(),
      updatedAt: u.updatedAt.toISOString()
    };
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

  async sendRequest(payload: SendFriendRequestPayload): Promise<FriendActionResponse> {
    const { requesterId, addresseeId } = payload;

    if (requesterId === addresseeId) this.fail(400, "cannotFriendYourself");

    const existing = await this.relationBetween(requesterId, addresseeId);
    if (existing) {
      // Silent block: looks exactly like a successful send, but does nothing.
      if (existing.status === "BLOCKED") return { success: true };
      this.fail(409, "alreadyFriends");
    }

    const friendship = await this.prisma.friendship.create({
      data: { requesterId, addresseeId, status: "PENDING" }
    });

    const requester = await this.prisma.user.findUnique({
      where: { id: requesterId }
    });
    if (requester) {
      this.client.emit(UserSubjects.friendRequestReceived, {
        recipientId: addresseeId,
        friendshipId: friendship.id,
        from: this.toPublicUser(requester)
      });
    }

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
      this.client.emit(UserSubjects.friendRequestAccepted, {
        recipientId: friendship.requesterId,
        friendshipId,
        from: this.toPublicUser(accepter)
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
      user: this.toPublicUser(other),
      createdAt: row.createdAt.toISOString()
    };
  }
}
