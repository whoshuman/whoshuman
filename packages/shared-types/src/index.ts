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
  language: string;
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
  language: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export type OAuthProvider = "google" | "42";

export interface OAuthStartPayload {
  provider: OAuthProvider;
  state: string;
}

export interface OAuthStartResponse {
  authorizationUrl: string;
}

export interface OAuthCallbackPayload {
  provider: OAuthProvider;
  code: string;
}

export interface OAuthCallbackResponse {
  ticket: string;
  requiresDesignation: boolean;
  suggestedDesignation?: string;
}

export interface OAuthCompletePayload {
  ticket: string;
  username?: string;
  language?: string;
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

export interface GameEntityState {
  entityId: string;
  skinId: number;
  x: number;
  y: number;
  z: number;
  rotationY: number;
}

export interface GameJoinResponse {
  gameId: string;
  selfUserId: string;
  selfEntityId: string;
  role: PlayerRole;
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
  forward: number; // -1..1  (W = +1, S = -1)
  turn: number; // -1..1  (A = +1 izquierda, D = -1 derecha)
}

export interface GameShootPayload {
  gameId: string;
  targetEntityId: string;
}

/** Dónde vuela la nave del cazador y hacia dónde mira. La dirección es unitaria. */
export interface SeekerPose {
  x: number;
  y: number;
  z: number;
  dirX: number;
  dirY: number;
  dirZ: number;
  // Punto al que apunta la mira. Va explícito y no se deriva de la dirección: el haz
  // sale del cañón, que está desplazado respecto a la cámara, así que solo el cazador
  // sabe dónde convergen los dos. Mandarlo garantiza que todos vean el mismo rayo.
  aimX: number;
  aimY: number;
  aimZ: number;
}

/** Lo que el resto de jugadores sabe del cazador: su nave y si está apuntando. */
export interface SeekerState extends SeekerPose {
  aiming: boolean;
}

export interface GameAimPayload {
  gameId: string;
  aiming: boolean;
  // La nave la mueve el cliente (orbita con su cámara), así que su pose solo puede
  // venir de él. Si falta, el servidor conserva la última conocida.
  pose?: SeekerPose;
}

export interface GameStateSnapshotPayload {
  gameId: string;
  tick: number;
  entities: GameEntityState[];
  collectibles: GameCollectibleState[];
  round: GameRoundState;
  scores: GameScoreState[];
  // Aparte de `entities` a propósito: esa lista es deliberadamente uniforme para que
  // no se distinga humano de NPC, y el cazador no juega a esconderse.
  seeker: SeekerState | null;
}

export type PlayerRole = "hider" | "seeker";
export type GameRoundPhase = "playing" | "intermission" | "finished";
export type GameRoundEndReason = "time" | "all-hiders-found" | null;

export interface GameCollectibleState {
  collectibleId: string;
  x: number;
  y: number;
  z: number;
}

export interface GameRoundState {
  phase: GameRoundPhase;
  current: number;
  total: number;
  remainingSeconds: number;
  endReason: GameRoundEndReason;
}

export interface GameScoreState {
  userId: string;
  username: string;
  score: number;
  role: PlayerRole;
  alive: boolean;
}

export interface CombatMatchSummary {
  gameId: string;
  points: number;
  placement: number;
  playerCount: number;
  playedAt: string;
}

export interface UserCombatStats {
  totalGames: number;
  wins: number;
  totalPoints: number;
  bestScore: number;
  averagePoints: number;
  recentMatches: CombatMatchSummary[];
}

export interface MatchFoundPayload {
  lobbyId?: string;
  gameId: string;
  players: { userId: string; username: string; role: PlayerRole }[];
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
  user: UserProfile; // the "other" user, relative to whoever asked
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
export type FindBlockedUsersPayload = UserScopedPayload;

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

export interface NotificationRecord extends NotificationEnvelope {
  id: string;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationUnreadCount {
  count: number;
}

export interface MarkNotificationReadPayload extends UserScopedPayload {
  notificationId: string;
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
  language: string;
}
/** El userId es quien busca (del JWT): se usa para excluirle de sus propios resultados. */
export interface SearchUsersPayload extends UserScopedPayload, PageQuery {
  query?: string;
}
