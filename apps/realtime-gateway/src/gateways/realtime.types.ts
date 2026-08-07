import type { Server, Socket } from "socket.io";
import { ClientSocketEvents, ServerSocketEvents } from "@whoshuman/shared-events";
import type {
  AuthTokenPayload,
  ChatClientHistoryPayload,
  ChatClientSendPayload,
  ChatHistoryResponse,
  ChatMessage,
  ChatSocketResponse,
  GameAimPayload,
  GameJoinPayload,
  GameJoinResponse,
  GameLeavePayload,
  GameShootPayload,
  GameStateSnapshotPayload,
  LobbyJoinPayload,
  LobbyLeavePayload,
  LobbyReadyPayload,
  LobbyStatePayload,
  MatchFoundPayload,
  NotificationEnvelope,
  PlayerInputPayload,
  PlayerRole
} from "@whoshuman/shared-types";

export interface SocketData {
  user?: AuthTokenPayload;
  lobbyId?: string;
  gameId?: string;
  selfEntityId?: string;
  selfRole?: PlayerRole;
}

export interface ServerToClientEvents {
  [ServerSocketEvents.gatewayReady]: (payload: { user: AuthTokenPayload }) => void;
  [ServerSocketEvents.gatewayError]: (payload: { message: string }) => void;
  [ServerSocketEvents.lobbyJoined]: (payload: { lobbyId: string }) => void;
  [ServerSocketEvents.lobbyLeft]: (payload: { lobbyId: string }) => void;
  [ServerSocketEvents.matchFound]: (payload: MatchFoundPayload) => void;
  [ServerSocketEvents.lobbyState]: (payload: LobbyStatePayload) => void;
  [ServerSocketEvents.notification]: (payload: NotificationEnvelope) => void;
  [ServerSocketEvents.gameJoined]: (payload: GameJoinResponse) => void;
  [ServerSocketEvents.gameLeft]: (payload: { gameId: string }) => void;
  [ServerSocketEvents.gameState]: (payload: GameStateSnapshotPayload) => void;
  [ServerSocketEvents.presenceState]: (payload: { userIds: string[] }) => void;
  [ServerSocketEvents.presenceChanged]: (payload: { userId: string; online: boolean }) => void;
  [ServerSocketEvents.chatMessage]: (payload: ChatMessage) => void;
}

export interface ClientToServerEvents {
  [ClientSocketEvents.lobbyJoin]: (payload?: LobbyJoinPayload) => void;
  [ClientSocketEvents.lobbyLeave]: (payload?: LobbyLeavePayload) => void;
  [ClientSocketEvents.lobbyReady]: (payload: LobbyReadyPayload) => void;
  [ClientSocketEvents.gameJoin]: (payload: GameJoinPayload) => void;
  [ClientSocketEvents.gameLeave]: (payload?: GameLeavePayload) => void;
  [ClientSocketEvents.gameAim]: (payload: GameAimPayload) => void;
  [ClientSocketEvents.gameShoot]: (payload: GameShootPayload) => void;
  [ClientSocketEvents.playerInput]: (payload: PlayerInputPayload) => void;
  [ClientSocketEvents.presenceList]: () => void;
  [ClientSocketEvents.chatSend]: (
    payload: ChatClientSendPayload,
    callback: (response: ChatSocketResponse<ChatMessage>) => void
  ) => void;
  [ClientSocketEvents.chatHistory]: (
    payload: ChatClientHistoryPayload,
    callback: (response: ChatSocketResponse<ChatHistoryResponse>) => void
  ) => void;
}

export type RealtimeSocket = Socket<ClientToServerEvents, ServerToClientEvents, object, SocketData>;
export type RealtimeServer = Server<ClientToServerEvents, ServerToClientEvents, object, SocketData>;
