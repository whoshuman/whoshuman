import { Controller } from "@nestjs/common";
import { MessagePattern } from "@nestjs/microservices";
import { AuthSubjects } from "@whoshuman/shared-events";

@Controller()
export class HelloController {
  @MessagePattern(AuthSubjects.health)
  health() {
    return {
      service: "auth-service",
      message: "Hello from auth-service",
      transport: "nats",
      timestamp: new Date().toISOString()
    };
  }
}
