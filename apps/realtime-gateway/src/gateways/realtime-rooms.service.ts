import { Injectable, Logger } from "@nestjs/common";
import { ServerSocketEvents } from "@whoshuman/shared-events";
import type { GameStateSnapshotPayload, MatchFoundPayload } from "@whoshuman/shared-types";
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

  broadcastGameState(payload: GameStateSnapshotPayload) {
    if (!this.server) {
      this.logger.warn("Cannot broadcast game state snapshot: Socket.IO server is not ready");
      return;
    }

    this.server.to(this.gameRoom(payload.gameId)).emit(ServerSocketEvents.gameState, payload);
  }

  private normalizeId(value: string | undefined, fallback: string) {
    return value && value.trim().length > 0 ? value.trim() : fallback;
  }
}
