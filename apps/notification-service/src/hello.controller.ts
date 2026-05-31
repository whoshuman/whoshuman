import { Controller } from "@nestjs/common";
import { MessagePattern } from "@nestjs/microservices";
import { NotificationSubjects } from "@whoshuman/shared-events";

@Controller()
export class HelloController {
  @MessagePattern(NotificationSubjects.health)
  health() {
    return {
      service: "notification-service",
      message: "Hello from notification-service",
      transport: "nats",
      timestamp: new Date().toISOString()
    };
  }
}
