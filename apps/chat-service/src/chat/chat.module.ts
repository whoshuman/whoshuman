import { Module } from "@nestjs/common";
import { MessagingService } from "../common/messaging.service";
import { NatsModule } from "../transports/nats.module";
import { ChatController } from "./chat.controller";
import { ChatService } from "./chat.service";

@Module({
  imports: [NatsModule],
  controllers: [ChatController],
  providers: [MessagingService, ChatService]
})
export class ChatModule {}
