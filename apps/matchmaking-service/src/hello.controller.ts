import { Controller } from "@nestjs/common";
import { MessagePattern } from "@nestjs/microservices";
import { MatchmakingSubjects } from "@whoshuman/shared-events";

@Controller()
export class HelloController {
  @MessagePattern(MatchmakingSubjects.health)
  health() {
    return {
      service: "matchmaking-service",
      message: "Hello from matchmaking-service",
      transport: "nats",
      timestamp: new Date().toISOString()
    };
  }
}
