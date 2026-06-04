import { Controller } from "@nestjs/common";
import { EventPattern, Payload } from "@nestjs/microservices";
import { MatchmakingSubjects } from "@whoshuman/shared-events";
import type {
  MatchmakingJoinQueuePayload,
  MatchmakingLeaveQueuePayload
} from "@whoshuman/shared-types";
import { MatchmakingService } from "./matchmaking.service";

@Controller()
export class MatchmakingController {
  constructor(private readonly matchmaking: MatchmakingService) {}

  @EventPattern(MatchmakingSubjects.joinQueue)
  async handleJoinQueue(@Payload() payload: MatchmakingJoinQueuePayload) {
    await this.matchmaking.joinQueue(payload);
  }

  @EventPattern(MatchmakingSubjects.leaveQueue)
  handleLeaveQueue(@Payload() payload: MatchmakingLeaveQueuePayload) {
    this.matchmaking.leaveQueue(payload);
  }
}
