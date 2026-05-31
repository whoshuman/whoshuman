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

export interface GamePlayerState {
  userId: string;
  x: number;
  y: number;
  z: number;
  rotationY: number;
}
