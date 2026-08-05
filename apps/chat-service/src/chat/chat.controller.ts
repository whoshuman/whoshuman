import { Controller } from "@nestjs/common";
import { MessagePattern, Payload } from "@nestjs/microservices";
import { ChatSubjects } from "@whoshuman/shared-events";
import type { ChatFindHistoryPayload, ChatSendMessagePayload } from "@whoshuman/shared-types";
import { ChatService } from "./chat.service";

@Controller()
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @MessagePattern(ChatSubjects.sendMessage)
  send(@Payload() payload: ChatSendMessagePayload) {
    return this.chat.send(payload);
  }

  @MessagePattern(ChatSubjects.findHistory)
  history(@Payload() payload: ChatFindHistoryPayload) {
    return this.chat.history(payload);
  }
}
