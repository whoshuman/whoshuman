import { Controller, GatewayTimeoutException, Get, Inject } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";
import {
  AuthSubjects,
  ChatSubjects,
  GameSubjects,
  MatchmakingSubjects,
  NotificationSubjects,
  RealtimeSubjects,
  UserSubjects
} from "@whoshuman/shared-events";
import { firstValueFrom, TimeoutError, timeout } from "rxjs";
import { NATS_SERVICE } from "./config";

const REQUEST_TIMEOUT_MS = 3000;

interface HelloResponse {
  service: string;
  message: string;
  transport: string;
  timestamp: string;
}

interface HelloRequest {
  requester: "api-gateway";
}

@Controller("hello")
export class HelloController {
  constructor(@Inject(NATS_SERVICE) private readonly natsClient: ClientProxy) {}

  @Get()
  findAll() {
    return {
      service: "api-gateway",
      message: "Hello from api-gateway",
      transport: "http",
      endpoints: {
        auth: "/hello/auth",
        users: "/hello/users",
        game: "/hello/game",
        matchmaking: "/hello/matchmaking",
        chat: "/hello/chat",
        notifications: "/hello/notifications",
        realtime: "/hello/realtime"
      },
      timestamp: new Date().toISOString()
    };
  }

  @Get("auth")
  auth() {
    return this.send(AuthSubjects.health);
  }

  @Get("users")
  users() {
    return this.send(UserSubjects.health);
  }

  @Get("game")
  game() {
    return this.send(GameSubjects.health);
  }

  @Get("matchmaking")
  matchmaking() {
    return this.send(MatchmakingSubjects.health);
  }

  @Get("chat")
  chat() {
    return this.send(ChatSubjects.health);
  }

  @Get("notifications")
  notifications() {
    return this.send(NotificationSubjects.health);
  }

  @Get("realtime")
  realtime() {
    return this.send(RealtimeSubjects.health);
  }

  private async send(pattern: string): Promise<HelloResponse> {
    try {
      return await firstValueFrom(
        this.natsClient
          .send<HelloResponse, HelloRequest>(pattern, {
            requester: "api-gateway"
          })
          .pipe(timeout(REQUEST_TIMEOUT_MS))
      );
    } catch (error) {
      if (error instanceof TimeoutError) {
        throw new GatewayTimeoutException(`Microservice did not respond for pattern: ${pattern}`);
      }

      throw error;
    }
  }
}
