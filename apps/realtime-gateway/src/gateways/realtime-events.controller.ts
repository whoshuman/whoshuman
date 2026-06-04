import { Controller, Logger } from "@nestjs/common";
import { EventPattern, Payload } from "@nestjs/microservices";
import { GameSubjects, MatchmakingSubjects, UserSubjects } from "@whoshuman/shared-events";
import type {
  FriendNotificationPayload,
  GameStateSnapshotPayload,
  MatchFoundPayload
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

  @EventPattern(UserSubjects.friendRequestReceived)
  handleFriendRequestReceived(@Payload() payload: FriendNotificationPayload) {
    if (!payload.recipientId) {
      this.logger.warn("Ignoring friend request event without recipientId");
      return;
    }
    this.rooms.notifyFriendRequestReceived(payload);
  }

  @EventPattern(UserSubjects.friendRequestAccepted)
  handleFriendRequestAccepted(@Payload() payload: FriendNotificationPayload) {
    if (!payload.recipientId) {
      this.logger.warn("Ignoring friend accept event without recipientId");
      return;
    }
    this.rooms.notifyFriendRequestAccepted(payload);
  }
}
