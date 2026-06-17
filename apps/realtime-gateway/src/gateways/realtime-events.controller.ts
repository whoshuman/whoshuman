import { Controller, Logger } from "@nestjs/common";
import { EventPattern, Payload } from "@nestjs/microservices";
import { GameSubjects, MatchmakingSubjects, NotificationSubjects } from "@whoshuman/shared-events";
import type {
  GameStateSnapshotPayload,
  LobbyStatePayload,
  MatchFoundPayload,
  NotificationEnvelope
} from "@whoshuman/shared-types";
import { RealtimeRoomsService } from "./realtime-rooms.service";

@Controller()
export class RealtimeEventsController {
  private readonly logger = new Logger(RealtimeEventsController.name);

  constructor(private readonly rooms: RealtimeRoomsService) {}

  @EventPattern(GameSubjects.stateSnapshot)
  handleGameStateSnapshot(@Payload() payload: GameStateSnapshotPayload) {
    if (!payload.gameId) {
      this.logger.warn("Ignoring game state snapshot without gameId");
      return;
    }

    this.rooms.broadcastGameState(payload);
  }

  @EventPattern(MatchmakingSubjects.matchFound)
  handleMatchFound(@Payload() payload: MatchFoundPayload) {
    if (!payload.gameId) {
      this.logger.warn("Ignoring matchmaking event without gameId");
      return;
    }

    this.rooms.broadcastMatchFound(payload);
  }

  @EventPattern(MatchmakingSubjects.lobbyUpdated)
  handleLobbyUpdated(@Payload() payload: LobbyStatePayload) {
    if (!payload?.lobbyId) {
      this.logger.warn("Ignoring lobby update without lobbyId");
      return;
    }

    this.rooms.broadcastLobbyState(payload);
  }

  @EventPattern(NotificationSubjects.deliver)
  handleNotificationDeliver(@Payload() payload: NotificationEnvelope) {
    if (!payload?.recipientId) {
      this.logger.warn("Ignoring notification deliver without recipientId");
      return;
    }
    this.rooms.deliverNotification(payload);
  }
}
