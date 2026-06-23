export type ServiceName =
  | "api-gateway"
  | "realtime-gateway"
  | "auth-service"
  | "user-service"
  | "game-service"
  | "matchmaking-service"
  | "chat-service"
  | "notification-service";

export interface UserIdentity {
  id: string;
  username: string;
}

export interface PublicUser {
  id: string;
  email: string;
  username: string;
  avatar: string | null;
  bio: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuthTokenPayload {
  sub: string;
  email: string;
  username: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface RegisterPayload {
  email: string;
  username: string;
  password: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RefreshPayload {
  refreshToken: string;
}

export interface VerifyPayload {
  token: string;
}

export interface AuthSessionResponse {
  user: PublicUser;
  tokens: AuthTokens;
}

export interface AuthRefreshResponse {
  tokens: AuthTokens;
}

export interface AuthLogoutResponse {
  success: boolean;
}

export interface AuthVerifyResponse {
  valid: boolean;
  payload?: AuthTokenPayload;
}

export interface GamePlayerState {
  userId: string;
  x: number;
  y: number;
  z: number;
  rotationY: number;
}

export interface LobbyJoinPayload {
  lobbyId?: string;
}

export interface LobbyLeavePayload {
  lobbyId?: string;
}

export interface LobbyReadyPayload {
  ready: boolean;
}

export interface GameJoinPayload {
  gameId: string;
}

export interface GameLeavePayload {
  gameId?: string;
}

export interface PlayerInputPayload {
  gameId: string;
  move: { x: number; z: number }; // dirección, |move| <= 1, {0,0} = quieto
}

export interface GameStateSnapshotPayload {
  gameId: string;
  tick: number;
  players: GamePlayerState[];
}

export type PlayerRole = "hider" | "seeker";

export interface MatchFoundPayload {
  lobbyId?: string;
  gameId: string;
  players: { userId: string; role: PlayerRole }[];
}

export interface LobbyStatePayload {
  lobbyId: string;
  players: { userId: string; username: string; ready: boolean }[]; // sin socketId
  count: number;
  min: number;
  max: number;
}

export interface MatchmakingJoinQueuePayload {
  userId: string;
  username: string;
  lobbyId: string;
  socketId: string;
}

export interface MatchmakingLeaveQueuePayload {
  userId: string;
  lobbyId: string;
  socketId: string;
}

export interface MatchmakingSetReadyPayload {
  userId: string;
  lobbyId: string;
  ready: boolean;
}

export type FriendshipStatus = "PENDING" | "ACCEPTED" | "BLOCKED";

export interface Friendship {
  id: string;
  status: FriendshipStatus;
  user: PublicUser; // the "other" user, relative to whoever asked
  createdAt: string;
}

/** Generic success envelope for action endpoints (delete, block, respond…). */
export interface ActionResponse {
  success: boolean;
}

export type FriendActionResponse = ActionResponse;

// NATS request payloads (userId/requester is injected by the gateway from the JWT)

/** Carries the user performing the action (injected from the JWT by the gateway). */
export interface UserScopedPayload {
  userId: string;
}

/** A user acting on a specific friendship. */
export interface FriendshipScopedPayload extends UserScopedPayload {
  friendshipId: string;
}

export interface SendFriendRequestPayload {
  requesterId: string;
  addresseeId: string;
}

export interface RespondFriendRequestPayload extends FriendshipScopedPayload {
  accept: boolean;
}

export type RemoveFriendPayload = FriendshipScopedPayload;

/** A user (blocker) acting on another user (target). */
export interface BlockScopedPayload {
  blockerId: string;
  targetId: string;
}

export type BlockUserPayload = BlockScopedPayload;
export type UnblockUserPayload = BlockScopedPayload;

export type FindFriendsPayload = UserScopedPayload;

export type FindPendingRequestsPayload = UserScopedPayload;

// Notification envelope — generic notification contract
export interface NotificationActor {
  id: string;
  username: string;
  avatar: string | null;
}

export type NotificationType = "friend.request.received" | "friend.request.accepted";

export interface NotificationEnvelope {
  recipientId: string; // who should receive it
  type: NotificationType;
  from: NotificationActor; // who triggered it (minimal — no email)
  data?: Record<string, unknown>; // type-specific extra, e.g. { friendshipId }
}

export interface UserProfile {
  id: string;
  username: string;
  avatar: string | null;
  bio: string | null;
  createdAt: string;
}

export interface PageQuery {
  page?: number;
  limit?: number;
}
export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
export interface Paginated<T> {
  data: T[];
  meta: PageMeta;
}

export interface UpdateProfilePayload extends UserScopedPayload {
  username: string;
  avatar: string | null;
  bio: string | null;
}
/** El userId es quien busca (del JWT): se usa para excluirle de sus propios resultados. */
export interface SearchUsersPayload extends UserScopedPayload, PageQuery {
  query?: string;
}
