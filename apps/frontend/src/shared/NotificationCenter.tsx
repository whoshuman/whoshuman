import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Bell, CheckCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead
} from "./api/notifications";
import { useChatDialogStore } from "./chatStore";

function NotificationCenter() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const unreadQuery = useQuery({
    queryKey: ["notificationUnreadCount"],
    queryFn: getUnreadNotificationCount
  });
  const notificationsQuery = useQuery({
    queryKey: ["notifications"],
    queryFn: getNotifications,
    enabled: open
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    void queryClient.invalidateQueries({ queryKey: ["notificationUnreadCount"] });
  };

  const markOne = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: refresh
  });
  const markAll = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: refresh
  });

  useEffect(() => {
    if (!open) return;

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const unreadCount = unreadQuery.data?.count ?? 0;
  const notifications = notificationsQuery.data ?? [];

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label={t("notifications.ariaLabel", { count: unreadCount })}
        aria-expanded={open}
        title={t("notifications.title")}
        onClick={() => setOpen((current) => !current)}
        className="group relative flex h-10 w-10 items-center justify-center border border-neon-cyan/45 bg-bg/55 text-neon-cyan transition hover:border-neon-cyan hover:bg-neon-cyan/10"
      >
        <Bell
          aria-hidden="true"
          size={19}
          strokeWidth={1.8}
          className="origin-top group-hover:animate-bell-ring"
        />
        {unreadCount > 0 && (
          <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center border border-neon-magenta bg-bg px-1 font-display text-[0.6rem] font-black text-neon-magenta shadow-[0_0_12px_rgba(255,43,214,0.6)]">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <section className="animate-unfold-down fixed right-3 top-16 z-[80] w-[calc(100vw-1.5rem)] max-w-sm origin-top border border-neon-cyan/55 bg-surface/98 shadow-[0_0_40px_rgba(36,245,255,0.2)] sm:right-8">
          <header className="flex items-center justify-between gap-3 border-b border-neon-cyan/25 bg-neon-cyan/8 px-4 py-3">
            <div>
              <p className="font-display text-xs font-black uppercase tracking-[0.2em] text-neon-cyan">
                // {t("notifications.title")}
              </p>
              <p className="mt-1 text-xs text-text-muted">
                {t("notifications.unread", { count: unreadCount })}
              </p>
            </div>
            <button
              type="button"
              title={t("notifications.markAllRead")}
              aria-label={t("notifications.markAllRead")}
              disabled={unreadCount === 0 || markAll.isPending}
              onClick={() => markAll.mutate()}
              className="flex h-9 w-9 items-center justify-center border border-neon-cyan/35 text-neon-cyan transition hover:bg-neon-cyan/10 disabled:cursor-not-allowed disabled:opacity-35"
            >
              <CheckCheck aria-hidden="true" size={18} />
            </button>
          </header>

          <div className="max-h-[min(28rem,calc(100vh-8rem))] overflow-y-auto">
            {notificationsQuery.isLoading && (
              <p className="animate-pulse px-4 py-8 text-center font-display text-xs font-bold uppercase tracking-widest text-neon-cyan">
                {t("notifications.loading")}
              </p>
            )}
            {notificationsQuery.isError && (
              <p className="px-4 py-8 text-center text-sm text-danger">
                {t("notifications.loadError")}
              </p>
            )}
            {!notificationsQuery.isLoading &&
              !notificationsQuery.isError &&
              notifications.length === 0 && (
                <p className="px-4 py-10 text-center font-display text-xs font-bold uppercase tracking-[0.2em] text-text-muted/70">
                  // {t("notifications.empty")}
                </p>
              )}
            {notifications.map((notification) => {
              const accepted = notification.type === "friend.request.accepted";
              const chatMessage = notification.type === "chat.message.received";
              const date = new Intl.DateTimeFormat(i18n.language, {
                day: "2-digit",
                month: "short",
                hour: "2-digit",
                minute: "2-digit"
              }).format(new Date(notification.createdAt));

              return (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => {
                    if (!notification.readAt) markOne.mutate(notification.id);
                    setOpen(false);
                    if (chatMessage) {
                      useChatDialogStore.getState().openDirect(notification.from);
                      return;
                    }
                    void navigate({ to: "/friends" });
                  }}
                  className={`flex w-full gap-3 border-b border-neon-cyan/15 px-4 py-3 text-left transition hover:bg-neon-cyan/7 ${
                    notification.readAt ? "opacity-65" : "bg-neon-magenta/5"
                  }`}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center border border-neon-cyan/35 bg-neon-cyan/8 font-display text-xs font-black uppercase text-neon-cyan">
                    {notification.from.username.slice(0, 2)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={`font-display block text-[0.65rem] font-bold uppercase tracking-wider ${
                        accepted
                          ? "text-success"
                          : chatMessage
                            ? "text-neon-cyan"
                            : "text-neon-magenta"
                      }`}
                    >
                      {chatMessage
                        ? t("notifications.chatMessage")
                        : accepted
                          ? t("notifications.requestAccepted")
                          : t("notifications.requestReceived")}
                    </span>
                    <span className="mt-1 block truncate text-sm font-bold text-text-main">
                      {notification.from.username}
                    </span>
                    <span className="mt-1 block text-xs text-text-muted">{date}</span>
                  </span>
                  {!notification.readAt && (
                    <span
                      aria-label={t("notifications.new")}
                      className="mt-2 h-2 w-2 shrink-0 bg-neon-magenta shadow-[0_0_8px_rgba(255,43,214,0.8)]"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

export default NotificationCenter;
