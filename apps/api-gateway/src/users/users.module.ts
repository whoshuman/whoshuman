import { Module } from "@nestjs/common";
import { MessagingService } from "../common";
import { NatsModule } from "../transports/nats.module";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { UsersController } from "./users.controller";

@Module({
  imports: [NatsModule],
  controllers: [UsersController],
  providers: [MessagingService, JwtAuthGuard]
})
export class UsersModule {}
