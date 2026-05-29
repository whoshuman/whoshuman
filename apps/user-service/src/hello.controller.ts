import { Controller } from "@nestjs/common";
import { MessagePattern } from "@nestjs/microservices";
import { UserSubjects } from "@whoshuman/shared-events";

@Controller()
export class HelloController {
  @MessagePattern(UserSubjects.health)
  health() {
    return {
      service: "user-service",
      message: "Hello from user-service",
      transport: "nats",
      timestamp: new Date().toISOString()
    };
  }
}
