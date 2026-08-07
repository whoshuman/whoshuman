import { Controller, Get, Param, Patch, UseGuards } from "@nestjs/common";
import { NotificationSubjects } from "@whoshuman/shared-events";
import type {
  ActionResponse,
  NotificationRecord,
  NotificationUnreadCount
} from "@whoshuman/shared-types";
import type { AuthUser } from "../auth/auth-user.types";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { MessagingService } from "../common";

@Controller("notifications")
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly messaging: MessagingService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.messaging.request<NotificationRecord[]>(NotificationSubjects.list, {
      userId: user.sub
    });
  }

  @Get("unread-count")
  unreadCount(@CurrentUser() user: AuthUser) {
    return this.messaging.request<NotificationUnreadCount>(NotificationSubjects.unreadCount, {
      userId: user.sub
    });
  }

  @Patch("read-all")
  markAllRead(@CurrentUser() user: AuthUser) {
    return this.messaging.request<ActionResponse>(NotificationSubjects.markAllRead, {
      userId: user.sub
    });
  }

  @Patch(":notificationId/read")
  markRead(@CurrentUser() user: AuthUser, @Param("notificationId") notificationId: string) {
    return this.messaging.request<ActionResponse>(NotificationSubjects.markRead, {
      userId: user.sub,
      notificationId
    });
  }
}
