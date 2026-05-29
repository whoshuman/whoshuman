import { Controller } from "@nestjs/common";
import { MessagePattern } from "@nestjs/microservices";
import { RealtimeSubjects } from "@whoshuman/shared-events";

@Controller()
export class HelloController {
  @MessagePattern(RealtimeSubjects.health)
  health() {
    return {
      service: "realtime-gateway",
      message: "Hello from realtime-gateway",
      transport: "nats",
      timestamp: new Date().toISOString()
    };
  }
}
