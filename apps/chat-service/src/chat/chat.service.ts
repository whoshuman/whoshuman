import { Injectable, Logger } from "@nestjs/common";
import { RpcException } from "@nestjs/microservices";
import type { ChatMessage as DbChatMessage, ChatScope as DbChatScope, User } from "@prisma/client";
import { ChatSubjects, NotificationSubjects } from "@whoshuman/shared-events";
import type {
  ChatFindHistoryPayload,
  ChatHistoryResponse,
  ChatMessage,
  ChatScope,
  ChatSendMessagePayload,
  NotificationEnvelope
} from "@whoshuman/shared-types";
import { MessagingService } from "../common/messaging.service";
import { PrismaService } from "../prisma/prisma.service";

const HISTORY_LIMIT = 100;
const MESSAGE_MAX_LENGTH = 500;

type MessageWithSender = DbChatMessage & { sender: User };

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly messaging: MessagingService
  ) {}

  async send(payload: ChatSendMessagePayload): Promise<ChatMessage> {
    const scope = this.requireScope(payload.scope);
    const content = this.requireContent(payload.content);
    const sender = await this.requireActiveUser(payload.senderId);

    let channelId: string;
    let recipientId: string | null = null;
    if (scope === "direct") {
      recipientId = this.requireId(payload.recipientId, "recipientId");
      await this.requireFriendship(sender.id, recipientId);
      channelId = this.directChannel(sender.id, recipientId);
    } else {
      channelId = this.requireId(payload.channelId, "channelId");
    }

    const stored = await this.prisma.chatMessage.create({
      data: {
        scope: this.toDbScope(scope),
        channelId,
        senderId: sender.id,
        recipientId,
        content
      },
      include: { sender: true }
    });
    const message = this.toMessage(stored);

    await this.publish(ChatSubjects.messageSent, message);
    if (recipientId) {
      await this.notify({
        recipientId,
        type: "chat.message.received",
        from: { id: sender.id, username: sender.username, avatar: sender.avatar },
        data: { messageId: message.id, preview: message.content.slice(0, 120) }
      });
    }

    return message;
  }

  async history(payload: ChatFindHistoryPayload): Promise<ChatHistoryResponse> {
    const scope = this.requireScope(payload.scope);
    let channelId: string;

    if (scope === "direct") {
      const recipientId = this.requireId(payload.recipientId, "recipientId");
      await this.requireFriendship(payload.userId, recipientId);
      channelId = this.directChannel(payload.userId, recipientId);
    } else {
      channelId = this.requireId(payload.channelId, "channelId");
    }

    const rows = await this.prisma.chatMessage.findMany({
      where: { scope: this.toDbScope(scope), channelId },
      include: { sender: true },
      orderBy: { createdAt: "desc" },
      take: HISTORY_LIMIT
    });

    return { messages: rows.reverse().map((row) => this.toMessage(row)) };
  }

  private async requireFriendship(userId: string, otherId: string): Promise<void> {
    if (userId === otherId) this.fail(400, "invalidChatRecipient");
    const users = await this.prisma.user.count({
      where: { id: { in: [userId, otherId] }, deletedAt: null }
    });
    if (users !== 2) this.fail(404, "userNotFound");

    const friendship = await this.prisma.friendship.findFirst({
      where: {
        status: "ACCEPTED",
        OR: [
          { requesterId: userId, addresseeId: otherId },
          { requesterId: otherId, addresseeId: userId }
        ]
      },
      select: { id: true }
    });
    if (!friendship) this.fail(403, "chatFriendsOnly");
  }

  private async requireActiveUser(userId: string): Promise<User> {
    const user = await this.prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
    if (!user) this.fail(404, "userNotFound");
    return user;
  }

  private directChannel(first: string, second: string): string {
    return [first, second].sort().join(":");
  }

  private requireContent(value: string): string {
    const content = typeof value === "string" ? value.trim() : "";
    if (!content || content.length > MESSAGE_MAX_LENGTH) this.fail(400, "invalidChatMessage");
    return content;
  }

  private requireId(value: string | undefined, field: string): string {
    if (!value?.trim()) this.fail(400, `${field}Required`);
    return value.trim();
  }

  private requireScope(scope: ChatScope): ChatScope {
    if (scope !== "direct" && scope !== "lobby" && scope !== "game") {
      this.fail(400, "invalidChatScope");
    }
    return scope;
  }

  private toDbScope(scope: ChatScope): DbChatScope {
    return scope.toUpperCase() as DbChatScope;
  }

  private toMessage(row: MessageWithSender): ChatMessage {
    return {
      id: row.id,
      scope: row.scope.toLowerCase() as ChatScope,
      channelId: row.channelId,
      sender: { id: row.sender.id, username: row.sender.username, avatar: row.sender.avatar },
      recipientId: row.recipientId,
      content: row.content,
      createdAt: row.createdAt.toISOString()
    };
  }

  private async publish(pattern: string, payload: unknown): Promise<void> {
    try {
      await this.messaging.publish(pattern, payload);
    } catch (error) {
      this.logger.warn(`No se pudo publicar ${pattern}: ${this.errorMessage(error)}`);
    }
  }

  private async notify(envelope: NotificationEnvelope): Promise<void> {
    await this.publish(NotificationSubjects.send, envelope);
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private fail(statusCode: number, message: string): never {
    throw new RpcException({ statusCode, message });
  }
}
