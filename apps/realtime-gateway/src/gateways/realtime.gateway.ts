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
  ChatSubjects,
  ClientSocketEvents,
  GameSubjects,
  MatchmakingSubjects,
  ServerSocketEvents
} from "@whoshuman/shared-events";
import type {
  ChatClientHistoryPayload,
  ChatClientSendPayload,
  ChatFindHistoryPayload,
  ChatHistoryResponse,
  ChatMessage,
  ChatScope,
  ChatSendMessagePayload,
  ChatSocketResponse,
  GameAimPayload,
  GameJoinPayload,
  GameJoinResponse,
  GameLeavePayload,
  GamePracticeSwitchRolePayload,
  GameShootPayload,
  LobbyJoinPayload,
  LobbyLeavePayload,
  PlayerInputPayload,
  SeekerPose
} from "@whoshuman/shared-types";
import { MessagingService } from "../common/messaging.service";
import { envs } from "../config";
import { PresenceService } from "./presence.service";
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
    private readonly rooms: RealtimeRoomsService,
    private readonly presence: PresenceService
  ) {}

  afterInit() {
    this.rooms.setServer(this.server);
    this.logger.log("Socket.IO gateway initialized");
  }

  async handleConnection(socket: RealtimeSocket) {
    try {
      const user = await this.auth.verifySocket(socket);
      socket.data.user = user;
      await socket.join(this.rooms.userRoom(user.sub));
      socket.emit(ServerSocketEvents.gatewayReady, { user });
      if (this.presence.add(user.sub)) {
        // Primer socket de este usuario: avisamos a todos los clientes conectados.
        this.server.emit(ServerSocketEvents.presenceChanged, { userId: user.sub, online: true });
      }
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
      await this.publishToNats(GameSubjects.disconnected, {
        userId: user.sub,
        gameId,
        socketId: socket.id
      });
    }

    if (user && this.presence.remove(user.sub)) {
      // Se ha cerrado su último socket: pasa a offline.
      this.server.emit(ServerSocketEvents.presenceChanged, { userId: user.sub, online: false });
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

  @SubscribeMessage(ClientSocketEvents.lobbyReady)
  async handleLobbyReady(
    @ConnectedSocket() socket: RealtimeSocket,
    @MessageBody() payload: unknown
  ) {
    const user = this.requireUser(socket);
    const lobbyId = socket.data.lobbyId;
    if (!lobbyId) {
      socket.emit(ServerSocketEvents.gatewayError, { message: "Not in a lobby" });
      return;
    }

    const ready = this.isRecord(payload) && payload.ready === true;
    await this.publishToNats(MatchmakingSubjects.setReady, {
      userId: user.sub,
      lobbyId,
      ready
    });
  }

  @SubscribeMessage(ClientSocketEvents.gameJoin)
  async handleGameJoin(
    @ConnectedSocket() socket: RealtimeSocket,
    @MessageBody() payload: GameJoinPayload
  ) {
    const user = this.requireUser(socket);
    const gameId = this.requireId(socket, payload?.gameId, "gameId");
    const currentGameId = socket.data.gameId;

    if (currentGameId === gameId && socket.data.selfEntityId && socket.data.selfRole) {
      socket.emit(ServerSocketEvents.gameJoined, {
        gameId,
        selfUserId: user.sub,
        selfEntityId: socket.data.selfEntityId,
        role: socket.data.selfRole
      });
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
      socket.data.selfEntityId = undefined;
      socket.data.selfRole = undefined;
    }

    const room = this.rooms.gameRoom(gameId);

    await socket.join(room);
    socket.data.gameId = gameId;

    let joined: GameJoinResponse | null = null;
    try {
      joined = await this.messaging.request<GameJoinResponse | null>(GameSubjects.join, {
        userId: user.sub,
        username: user.username,
        gameId,
        socketId: socket.id
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Failed to request ${GameSubjects.join}: ${message}`);
    }

    if (!joined) {
      await socket.leave(room);
      socket.data.gameId = undefined;
      socket.data.selfEntityId = undefined;
      socket.data.selfRole = undefined;
      socket.emit(ServerSocketEvents.gatewayError, { message: "Unable to join game" });
      return;
    }

    socket.data.selfEntityId = joined.selfEntityId;
    socket.data.selfRole = joined.role;
    socket.emit(ServerSocketEvents.gameJoined, joined);
  }

  @SubscribeMessage(ClientSocketEvents.gameLeave)
  async handleGameLeave(
    @ConnectedSocket() socket: RealtimeSocket,
    @MessageBody() payload?: GameLeavePayload
  ) {
    const user = this.requireUser(socket);
    const gameId = this.requireId(socket, payload?.gameId ?? socket.data.gameId, "gameId");
    const lobbyId = socket.data.lobbyId;

    await socket.leave(this.rooms.gameRoom(gameId));
    socket.data.gameId = undefined;
    socket.data.selfEntityId = undefined;
    socket.data.selfRole = undefined;

    await this.publishToNats(GameSubjects.leave, {
      userId: user.sub,
      gameId,
      socketId: socket.id
    });

    if (lobbyId) {
      const rejoinedLobby = await this.publishToNats(MatchmakingSubjects.joinQueue, {
        userId: user.sub,
        username: user.username,
        lobbyId,
        socketId: socket.id
      });

      if (rejoinedLobby) {
        socket.emit(ServerSocketEvents.lobbyJoined, { lobbyId });
      } else {
        socket.emit(ServerSocketEvents.gatewayError, {
          message: "Unable to rejoin matchmaking queue"
        });
      }
    }

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
      forward: payload.forward,
      turn: payload.turn,
      socketId: socket.id
    });
  }

  @SubscribeMessage(ClientSocketEvents.gameShoot)
  async handleGameShoot(
    @ConnectedSocket() socket: RealtimeSocket,
    @MessageBody() payload: GameShootPayload
  ) {
    const user = this.requireUser(socket);
    const gameId = this.requireId(socket, payload?.gameId, "gameId");
    const targetEntityId = this.requireId(socket, payload?.targetEntityId, "targetEntityId");

    if (socket.data.gameId !== gameId) {
      socket.emit(ServerSocketEvents.gatewayError, {
        message: "Socket is not joined to this game"
      });
      return;
    }

    await this.publishToNats(GameSubjects.shoot, {
      userId: user.sub,
      gameId,
      targetEntityId,
      socketId: socket.id
    });
  }

  // MODO DEBUG: retirar junto con GameSubjects.switchRole, ClientSocketEvents.gamePracticeSwitchRole
  // y GameSession.practiceSwitchRole. El game-service ignora el evento si la partida no es "practice".
  @SubscribeMessage(ClientSocketEvents.gamePracticeSwitchRole)
  async handleGamePracticeSwitchRole(
    @ConnectedSocket() socket: RealtimeSocket,
    @MessageBody() payload: GamePracticeSwitchRolePayload
  ) {
    const user = this.requireUser(socket);
    const gameId = this.requireId(socket, payload?.gameId, "gameId");

    if (socket.data.gameId !== gameId) {
      socket.emit(ServerSocketEvents.gatewayError, {
        message: "Socket is not joined to this game"
      });
      return;
    }

    await this.publishToNats(GameSubjects.switchRole, {
      userId: user.sub,
      gameId,
      socketId: socket.id
    });
  }

  @SubscribeMessage(ClientSocketEvents.gameAim)
  async handleGameAim(
    @ConnectedSocket() socket: RealtimeSocket,
    @MessageBody() payload: GameAimPayload
  ) {
    const user = this.requireUser(socket);
    const gameId = this.requireId(socket, payload?.gameId, "gameId");
    if (socket.data.gameId !== gameId) {
      socket.emit(ServerSocketEvents.gatewayError, {
        message: "Socket is not joined to this game"
      });
      return;
    }
    if (typeof payload?.aiming !== "boolean") {
      socket.emit(ServerSocketEvents.gatewayError, { message: "Invalid aiming state" });
      return;
    }
    // La pose es opcional, pero si viene tiene que ser numérica: el game-service la
    // reenvía a todos en el snapshot, así que un NaN les rompería el render.
    const pose = this.readSeekerPose(payload.pose);
    if (payload.pose !== undefined && !pose) {
      socket.emit(ServerSocketEvents.gatewayError, { message: "Invalid seeker pose" });
      return;
    }

    await this.publishToNats(GameSubjects.aim, {
      userId: user.sub,
      gameId,
      aiming: payload.aiming,
      ...(pose ? { pose } : {}),
      socketId: socket.id
    });
  }

  private readSeekerPose(value: unknown): SeekerPose | null {
    if (typeof value !== "object" || value === null) return null;
    const pose = value as Record<string, unknown>;
    const keys = ["x", "y", "z", "dirX", "dirY", "dirZ", "aimX", "aimY", "aimZ"] as const;
    if (!keys.every((key) => typeof pose[key] === "number" && Number.isFinite(pose[key]))) {
      return null;
    }
    return {
      x: pose.x as number,
      y: pose.y as number,
      z: pose.z as number,
      dirX: pose.dirX as number,
      dirY: pose.dirY as number,
      dirZ: pose.dirZ as number,
      aimX: pose.aimX as number,
      aimY: pose.aimY as number,
      aimZ: pose.aimZ as number
    };
  }

  @SubscribeMessage(ClientSocketEvents.presenceList)
  handlePresenceList(@ConnectedSocket() socket: RealtimeSocket) {
    this.requireUser(socket); // ignora sockets no autenticados, igual que el resto
    socket.emit(ServerSocketEvents.presenceState, { userIds: this.presence.list() });
  }

  @SubscribeMessage(ClientSocketEvents.chatSend)
  async handleChatSend(
    @ConnectedSocket() socket: RealtimeSocket,
    @MessageBody() payload: ChatClientSendPayload
  ): Promise<ChatSocketResponse<ChatMessage>> {
    try {
      const user = this.requireUser(socket);
      const request: ChatSendMessagePayload = {
        senderId: user.sub,
        scope: this.requireChatScope(payload?.scope),
        content: typeof payload?.content === "string" ? payload.content : "",
        ...this.chatDestination(socket, payload?.scope, payload?.recipientId)
      };
      const data = await this.messaging.request<ChatMessage>(ChatSubjects.sendMessage, request);
      return { ok: true, data };
    } catch (error) {
      return { ok: false, error: this.errorMessage(error) };
    }
  }

  @SubscribeMessage(ClientSocketEvents.chatHistory)
  async handleChatHistory(
    @ConnectedSocket() socket: RealtimeSocket,
    @MessageBody() payload: ChatClientHistoryPayload
  ): Promise<ChatSocketResponse<ChatHistoryResponse>> {
    try {
      const user = this.requireUser(socket);
      const request: ChatFindHistoryPayload = {
        userId: user.sub,
        scope: this.requireChatScope(payload?.scope),
        ...this.chatDestination(socket, payload?.scope, payload?.recipientId)
      };
      const data = await this.messaging.request<ChatHistoryResponse>(
        ChatSubjects.findHistory,
        request
      );
      return { ok: true, data };
    } catch (error) {
      return { ok: false, error: this.errorMessage(error) };
    }
  }

  private chatDestination(
    socket: RealtimeSocket,
    scope: ChatScope,
    recipientId?: string
  ): Pick<ChatSendMessagePayload, "channelId" | "recipientId"> {
    if (scope === "direct") {
      return { recipientId: this.requireId(socket, recipientId, "recipientId") };
    }
    if (scope === "lobby") {
      return { channelId: this.requireId(socket, socket.data.lobbyId, "lobbyId") };
    }
    return { channelId: this.requireId(socket, socket.data.gameId, "gameId") };
  }

  private requireChatScope(value: unknown): ChatScope {
    if (value !== "direct" && value !== "lobby" && value !== "game") {
      throw new Error("Invalid chat scope");
    }
    return value;
  }

  private errorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (this.isRecord(error) && typeof error.message === "string") return error.message;
    return "Chat service unavailable";
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

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
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
