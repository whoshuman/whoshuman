import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards
} from "@nestjs/common";
import { UserSubjects } from "@whoshuman/shared-events";
import type { FriendActionResponse, Friendship } from "@whoshuman/shared-types";
import { MessagingService } from "../common";
import type { AuthUser } from "../auth/auth-user.types";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RespondFriendRequestDto } from "./dto/respond-friend-request.dto";
import { SendFriendRequestDto } from "./dto/send-friend-request.dto";
import { TargetUserDto } from "./dto/target-user.dto";

@Controller("friends")
@UseGuards(JwtAuthGuard)
export class FriendsController {
  constructor(private readonly messaging: MessagingService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.messaging.request<Friendship[]>(UserSubjects.findFriends, { userId: user.sub });
  }

  @Get("requests")
  pending(@CurrentUser() user: AuthUser) {
    return this.messaging.request<Friendship[]>(UserSubjects.findPendingRequests, {
      userId: user.sub
    });
  }

  @Post("requests")
  @HttpCode(HttpStatus.OK)
  send(@CurrentUser() user: AuthUser, @Body() dto: SendFriendRequestDto) {
    return this.messaging.request<FriendActionResponse>(UserSubjects.sendFriendRequest, {
      requesterId: user.sub,
      addresseeId: dto.addresseeId
    });
  }

  @Post("requests/respond")
  @HttpCode(HttpStatus.OK)
  respond(@CurrentUser() user: AuthUser, @Body() dto: RespondFriendRequestDto) {
    return this.messaging.request<FriendActionResponse>(UserSubjects.respondFriendRequest, {
      userId: user.sub,
      friendshipId: dto.friendshipId,
      accept: dto.accept
    });
  }

  @Delete(":friendshipId")
  remove(@CurrentUser() user: AuthUser, @Param("friendshipId") friendshipId: string) {
    return this.messaging.request<FriendActionResponse>(UserSubjects.removeFriend, {
      userId: user.sub,
      friendshipId
    });
  }

  @Post("block")
  @HttpCode(HttpStatus.OK)
  block(@CurrentUser() user: AuthUser, @Body() dto: TargetUserDto) {
    return this.messaging.request<FriendActionResponse>(UserSubjects.blockUser, {
      blockerId: user.sub,
      targetId: dto.targetId
    });
  }

  @Post("unblock")
  @HttpCode(HttpStatus.OK)
  unblock(@CurrentUser() user: AuthUser, @Body() dto: TargetUserDto) {
    return this.messaging.request<FriendActionResponse>(UserSubjects.unblockUser, {
      blockerId: user.sub,
      targetId: dto.targetId
    });
  }
}
