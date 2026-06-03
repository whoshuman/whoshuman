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

export interface GameJoinPayload {
  gameId: string;
}

export interface GameLeavePayload {
  gameId?: string;
}

export interface PlayerInputPayload {
  gameId: string;
  sequence?: number;
  position: {
    x: number;
    y: number;
    z: number;
  };
  rotationY: number;
}

export interface GameStateSnapshotPayload {
  gameId: string;
  tick: number;
  players: GamePlayerState[];
}

export interface MatchFoundPayload {
  lobbyId?: string;
  gameId: string;
  playerIds: string[];
}
