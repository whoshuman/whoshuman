import { Controller } from "@nestjs/common";
import { MessagePattern, Payload } from "@nestjs/microservices";
import { UserSubjects } from "@whoshuman/shared-events";
import type {
  SearchUsersPayload,
  UpdateProfilePayload,
  UserScopedPayload
} from "@whoshuman/shared-types";
import { UsersService } from "./users.service";

@Controller()
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @MessagePattern(UserSubjects.findMe)
  findMe(@Payload() payload: UserScopedPayload) {
    return this.users.findMe(payload);
  }

  @MessagePattern(UserSubjects.combatStats)
  combatStats(@Payload() payload: UserScopedPayload) {
    return this.users.combatStats(payload);
  }

  @MessagePattern(UserSubjects.findProfile)
  findProfile(@Payload() payload: UserScopedPayload) {
    return this.users.findProfile(payload);
  }

  @MessagePattern(UserSubjects.updateProfile)
  updateProfile(@Payload() payload: UpdateProfilePayload) {
    return this.users.updateProfile(payload);
  }

  @MessagePattern(UserSubjects.deleteAccount)
  deleteAccount(@Payload() payload: UserScopedPayload) {
    return this.users.deleteAccount(payload);
  }

  @MessagePattern(UserSubjects.searchUsers)
  searchUsers(@Payload() payload: SearchUsersPayload) {
    return this.users.searchUsers(payload);
  }
}
