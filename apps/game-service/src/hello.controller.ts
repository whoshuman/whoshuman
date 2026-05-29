import { Controller } from "@nestjs/common";
import { MessagePattern } from "@nestjs/microservices";
import { GameSubjects } from "@whoshuman/shared-events";

@Controller()
export class HelloController {
  @MessagePattern(GameSubjects.health)
  health() {
    return {
      service: "game-service",
      message: "Hello from game-service",
      transport: "nats",
      timestamp: new Date().toISOString()
    };
  }
}
