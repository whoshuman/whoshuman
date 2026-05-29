import { Controller } from "@nestjs/common";
import { MessagePattern } from "@nestjs/microservices";
import { ChatSubjects } from "@whoshuman/shared-events";

@Controller()
export class HelloController {
  @MessagePattern(ChatSubjects.health)
  health() {
    return {
      service: "chat-service",
      message: "Hello from chat-service",
      transport: "nats",
      timestamp: new Date().toISOString()
    };
  }
}
