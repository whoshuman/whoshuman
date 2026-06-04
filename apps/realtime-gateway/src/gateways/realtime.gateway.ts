import { Logger } from "@nestjs/common";
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer
} from "@nestjs/websockets";
import {
  ClientSocketEvents,
  GameSubjects,
  MatchmakingSubjects,
  ServerSocketEvents
} from "@whoshuman/shared-events";
import type {
  GameJoinPayload,
  GameLeavePayload,
  LobbyJoinPayload,
  LobbyLeavePayload,
  PlayerInputPayload
} from "@whoshuman/shared-types";
import { MessagingService } from "../common/messaging.service";
import { envs } from "../config";
import { RealtimeAuthService } from "./realtime-auth.service";
import { RealtimeRoomsService } from "./realtime-rooms.service";
import type { RealtimeServer, RealtimeSocket } from "./realtime.types";

@WebSocketGateway({
  cors: {
    origin: envs.corsOrigins,
    credentials: envs.corsCredentials
  }
})
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  private readonly server!: RealtimeServer;

  constructor(
    private readonly auth: RealtimeAuthService,
    private readonly messaging: MessagingService,
    private readonly rooms: RealtimeRoomsService
  ) {}

  afterInit() {
    this.rooms.setServer(this.server);
    this.logger.log("Socket.IO gateway initialized");
  }

  async handleConnection(socket: RealtimeSocket) {
    try {
      const user = await this.auth.verifySocket(socket);
      socket.data.user = user;
      socket.emit(ServerSocketEvents.gatewayReady, { user });
      this.logger.log(`Socket connected: ${socket.id} user=${user.sub}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Socket authentication failed";
      socket.emit(ServerSocketEvents.gatewayError, { message });
      socket.disconnect(true);
    }
  }

  async handleDisconnect(socket: RealtimeSocket) {
    const { user, lobbyId, gameId } = socket.data;

    if (user && lobbyId) {
      await this.publishToNats(MatchmakingSubjects.leaveQueue, {
        userId: user.sub,
        lobbyId,
        socketId: socket.id
      });
    }

    if (user && gameId) {
      await this.publishToNats(GameSubjects.leave, {
        userId: user.sub,
        gameId,
        socketId: socket.id
      });
    }

    this.logger.log(`Socket disconnected: ${socket.id} user=${user?.sub ?? "anonymous"}`);
  }

  @SubscribeMessage(ClientSocketEvents.lobbyJoin)
  async handleLobbyJoin(
    @ConnectedSocket() socket: RealtimeSocket,
    @MessageBody() payload?: LobbyJoinPayload
  ) {
    const user = this.requireUser(socket);
    const lobbyId = this.rooms.lobbyId(payload?.lobbyId);
    const currentLobbyId = socket.data.lobbyId;
    const room = this.rooms.lobbyRoom(lobbyId);

    if (currentLobbyId === lobbyId) {
      socket.emit(ServerSocketEvents.lobbyJoined, { lobbyId });
      return;
    }

    if (currentLobbyId) {
      const leftPreviousLobby = await this.publishToNats(MatchmakingSubjects.leaveQueue, {
        userId: user.sub,
        lobbyId: currentLobbyId,
        socketId: socket.id
      });

      if (!leftPreviousLobby) {
        socket.emit(ServerSocketEvents.gatewayError, {
          message: "Unable to leave current matchmaking queue"
        });
        return;
      }

      await socket.leave(this.rooms.lobbyRoom(currentLobbyId));
      socket.data.lobbyId = undefined;
    }

    await socket.join(room);
    socket.data.lobbyId = lobbyId;

    const published = await this.publishToNats(MatchmakingSubjects.joinQueue, {
      userId: user.sub,
      username: user.username,
      lobbyId,
      socketId: socket.id
    });

    if (!published) {
      await socket.leave(room);
      socket.data.lobbyId = undefined;
      socket.emit(ServerSocketEvents.gatewayError, { message: "Unable to join matchmaking queue" });
      return;
    }

    socket.emit(ServerSocketEvents.lobbyJoined, { lobbyId });
  }

  @SubscribeMessage(ClientSocketEvents.lobbyLeave)
  async handleLobbyLeave(
    @ConnectedSocket() socket: RealtimeSocket,
    @MessageBody() payload?: LobbyLeavePayload
  ) {
    const user = this.requireUser(socket);
    const lobbyId = this.requireId(socket, payload?.lobbyId ?? socket.data.lobbyId, "lobbyId");

    await socket.leave(this.rooms.lobbyRoom(lobbyId));
    socket.data.lobbyId = undefined;

    await this.publishToNats(MatchmakingSubjects.leaveQueue, {
      userId: user.sub,
      lobbyId,
      socketId: socket.id
    });

    socket.emit(ServerSocketEvents.lobbyLeft, { lobbyId });
  }

  @SubscribeMessage(ClientSocketEvents.gameJoin)
  async handleGameJoin(
    @ConnectedSocket() socket: RealtimeSocket,
    @MessageBody() payload: GameJoinPayload
  ) {
    const user = this.requireUser(socket);
    const gameId = this.requireId(socket, payload?.gameId, "gameId");
    const currentGameId = socket.data.gameId;

    if (currentGameId === gameId) {
      socket.emit(ServerSocketEvents.gameJoined, { gameId });
      return;
    }

    if (currentGameId) {
      const leftPreviousGame = await this.publishToNats(GameSubjects.leave, {
        userId: user.sub,
        gameId: currentGameId,
        socketId: socket.id
      });

      if (!leftPreviousGame) {
        socket.emit(ServerSocketEvents.gatewayError, {
          message: "Unable to leave current game"
        });
        return;
      }

      await socket.leave(this.rooms.gameRoom(currentGameId));
      socket.data.gameId = undefined;
    }

    const room = this.rooms.gameRoom(gameId);

    await socket.join(room);
    socket.data.gameId = gameId;

    const published = await this.publishToNats(GameSubjects.join, {
      userId: user.sub,
      username: user.username,
      gameId,
      socketId: socket.id
    });

    if (!published) {
      await socket.leave(room);
      socket.data.gameId = undefined;
      socket.emit(ServerSocketEvents.gatewayError, { message: "Unable to join game" });
      return;
    }

    socket.emit(ServerSocketEvents.gameJoined, { gameId });
  }

  @SubscribeMessage(ClientSocketEvents.gameLeave)
  async handleGameLeave(
    @ConnectedSocket() socket: RealtimeSocket,
    @MessageBody() payload?: GameLeavePayload
  ) {
    const user = this.requireUser(socket);
    const gameId = this.requireId(socket, payload?.gameId ?? socket.data.gameId, "gameId");

    await socket.leave(this.rooms.gameRoom(gameId));
    socket.data.gameId = undefined;

    await this.publishToNats(GameSubjects.leave, {
      userId: user.sub,
      gameId,
      socketId: socket.id
    });

    socket.emit(ServerSocketEvents.gameLeft, { gameId });
  }

  @SubscribeMessage(ClientSocketEvents.playerInput)
  async handlePlayerInput(
    @ConnectedSocket() socket: RealtimeSocket,
    @MessageBody() payload: PlayerInputPayload
  ) {
    const user = this.requireUser(socket);
    const gameId = this.requireId(socket, payload?.gameId, "gameId");

    if (socket.data.gameId !== gameId) {
      socket.emit(ServerSocketEvents.gatewayError, {
        message: "Socket is not joined to this game"
      });
      return;
    }

    await this.publishToNats(GameSubjects.playerMoved, {
      userId: user.sub,
      gameId,
      sequence: payload.sequence,
      position: payload.position,
      rotationY: payload.rotationY,
      socketId: socket.id
    });
  }

  private requireUser(socket: RealtimeSocket) {
    if (!socket.data.user) {
      throw new Error("Socket is not authenticated");
    }

    return socket.data.user;
  }

  private requireId(socket: RealtimeSocket, value: string | undefined, field: string) {
    if (!value || value.trim().length === 0) {
      socket.emit(ServerSocketEvents.gatewayError, { message: `${field} is required` });
      throw new Error(`${field} is required`);
    }

    return value.trim();
  }

  private async publishToNats(pattern: string, payload: unknown) {
    try {
      await this.messaging.publish(pattern, payload);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Failed to publish ${pattern}: ${message}`);
      return false;
    }
  }
}
