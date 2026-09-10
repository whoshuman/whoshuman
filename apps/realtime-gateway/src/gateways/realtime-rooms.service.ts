import { Injectable, Logger } from "@nestjs/common";
import { ServerSocketEvents } from "@whoshuman/shared-events";
import type {
  ChatMessage,
  GameStateSnapshotPayload,
  LobbyStatePayload,
  MatchFoundPayload,
  NotificationEnvelope
} from "@whoshuman/shared-types";
import type { RealtimeServer } from "./realtime.types";

const DEFAULT_LOBBY_ID = "main";

@Injectable()
export class RealtimeRoomsService {
  private readonly logger = new Logger(RealtimeRoomsService.name);
  private server?: RealtimeServer;

  setServer(server: RealtimeServer) {
    this.server = server;
  }

  lobbyId(lobbyId?: string) {
    return this.normalizeId(lobbyId, DEFAULT_LOBBY_ID);
  }

  lobbyRoom(lobbyId?: string) {
    return `lobby:${this.lobbyId(lobbyId)}`;
  }

  gameRoom(gameId: string) {
    return `game:${gameId}`;
  }

  broadcastMatchFound(payload: MatchFoundPayload) {
    if (!this.server) {
      this.logger.warn("Cannot broadcast match found: Socket.IO server is not ready");
      return;
    }

    this.server.to(this.lobbyRoom(payload.lobbyId)).emit(ServerSocketEvents.matchFound, payload);
  }

  broadcastLobbyState(payload: LobbyStatePayload) {
    if (!this.server) {
      this.logger.warn("Cannot broadcast lobby state: Socket.IO server is not ready");
      return;
    }

    this.server.to(this.lobbyRoom(payload.lobbyId)).emit(ServerSocketEvents.lobbyState, payload);
  }

  userRoom(userId: string) {
    return `user:${userId}`;
  }

  deliverNotification(payload: NotificationEnvelope) {
    if (!this.server) {
      this.logger.warn("Cannot deliver notification: Socket.IO server is not ready");
      return;
    }
    this.server
      .to(this.userRoom(payload.recipientId))
      .emit(ServerSocketEvents.notification, payload);
  }

  broadcastChatMessage(payload: ChatMessage) {
    if (!this.server) {
      this.logger.warn("Cannot broadcast chat message: Socket.IO server is not ready");
      return;
    }

    if (payload.scope === "direct" && payload.recipientId) {
      this.server
        .to(this.userRoom(payload.sender.id))
        .to(this.userRoom(payload.recipientId))
        .emit(ServerSocketEvents.chatMessage, payload);
      return;
    }

    const room =
      payload.scope === "lobby"
        ? this.lobbyRoom(payload.channelId)
        : this.gameRoom(payload.channelId);
    this.server.to(room).emit(ServerSocketEvents.chatMessage, payload);
  }

  // El snapshot le llega igual a todo el mundo MENOS `hiderRoster`: ese campo dice
  // quién es cada infiltrado (para que se vean el nombre entre ellos) y el cazador
  // JAMÁS debe recibirlo, ni en el payload en bruto — no basta con que el cliente lo
  // ignore, tiene que no llegarle. Por eso aquí no hay un solo broadcast al room, sino
  // dos envíos por id de socket según el rol que tenga cada uno en esta partida.
  async broadcastGameState(payload: GameStateSnapshotPayload) {
    if (!this.server) {
      this.logger.warn("Cannot broadcast game state snapshot: Socket.IO server is not ready");
      return;
    }

    const room = this.gameRoom(payload.gameId);
    const sockets = await this.server.in(room).fetchSockets();
    const hiderSocketIds: string[] = [];
    const otherSocketIds: string[] = [];
    for (const socket of sockets) {
      (socket.data.selfRole === "hider" ? hiderSocketIds : otherSocketIds).push(socket.id);
    }

    if (otherSocketIds.length > 0) {
      const { hiderRoster: _hiderRoster, ...publicPayload } = payload;
      this.server.to(otherSocketIds).emit(ServerSocketEvents.gameState, publicPayload);
    }
    if (hiderSocketIds.length > 0) {
      this.server.to(hiderSocketIds).emit(ServerSocketEvents.gameState, payload);
    }
  }

  private normalizeId(value: string | undefined, fallback: string) {
    return value && value.trim().length > 0 ? value.trim() : fallback;
  }
}
