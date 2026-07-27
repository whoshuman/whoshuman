import { Controller } from "@nestjs/common";
import { MessagePattern, Payload } from "@nestjs/microservices";
import { UserSubjects } from "@whoshuman/shared-events";
import type {
  BlockUserPayload,
  FindBlockedUsersPayload,
  FindFriendsPayload,
  FindPendingRequestsPayload,
  RemoveFriendPayload,
  RespondFriendRequestPayload,
  SendFriendRequestPayload,
  UnblockUserPayload
} from "@whoshuman/shared-types";
import { FriendsService } from "./friends.service";

@Controller()
export class FriendsController {
  constructor(private readonly friends: FriendsService) {}

  @MessagePattern(UserSubjects.sendFriendRequest)
  send(@Payload() payload: SendFriendRequestPayload) {
    return this.friends.sendRequest(payload);
  }

  @MessagePattern(UserSubjects.respondFriendRequest)
  respond(@Payload() payload: RespondFriendRequestPayload) {
    return this.friends.respondRequest(payload);
  }

  @MessagePattern(UserSubjects.removeFriend)
  remove(@Payload() payload: RemoveFriendPayload) {
    return this.friends.removeFriend(payload);
  }

  @MessagePattern(UserSubjects.blockUser)
  block(@Payload() payload: BlockUserPayload) {
    return this.friends.block(payload);
  }

  @MessagePattern(UserSubjects.unblockUser)
  unblock(@Payload() payload: UnblockUserPayload) {
    return this.friends.unblock(payload);
  }

  @MessagePattern(UserSubjects.findFriends)
  findFriends(@Payload() payload: FindFriendsPayload) {
    return this.friends.findFriends(payload);
  }

  @MessagePattern(UserSubjects.findPendingRequests)
  findPending(@Payload() payload: FindPendingRequestsPayload) {
    return this.friends.findPendingRequests(payload);
  }

  @MessagePattern(UserSubjects.findBlockedUsers)
  findBlocked(@Payload() payload: FindBlockedUsersPayload) {
    return this.friends.findBlockedUsers(payload);
  }
}
