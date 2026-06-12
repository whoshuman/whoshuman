import { Body, Controller, Delete, Get, Param, Put, Query, UseGuards } from "@nestjs/common";
import { UserSubjects } from "@whoshuman/shared-events";
import type { ActionResponse, Paginated, PublicUser, UserProfile } from "@whoshuman/shared-types";
import { MessagingService } from "../common";
import type { AuthUser } from "../auth/auth-user.types";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { SearchUsersDto } from "./dto/search-users.dto";
import { UpdateProfileDto } from "./dto/update-profile.dto";

@Controller("users")
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly messaging: MessagingService) {}

  @Get("me")
  me(@CurrentUser() user: AuthUser) {
    return this.messaging.request<PublicUser>(UserSubjects.findMe, { userId: user.sub });
  }

  @Put("me")
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.messaging.request<PublicUser>(UserSubjects.updateProfile, {
      userId: user.sub,
      username: dto.username,
      avatar: dto.avatar ?? null,
      bio: dto.bio ?? null
    });
  }

  @Delete("me")
  remove(@CurrentUser() user: AuthUser) {
    return this.messaging.request<ActionResponse>(UserSubjects.deleteAccount, {
      userId: user.sub
    });
  }

  @Get()
  search(@CurrentUser() user: AuthUser, @Query() dto: SearchUsersDto) {
    return this.messaging.request<Paginated<UserProfile>>(UserSubjects.searchUsers, {
      userId: user.sub,
      query: dto.search,
      page: dto.page,
      limit: dto.limit
    });
  }

  @Get(":id")
  profile(@Param("id") id: string) {
    return this.messaging.request<UserProfile>(UserSubjects.findProfile, { userId: id });
  }
}
