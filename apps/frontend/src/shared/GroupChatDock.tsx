import { ServerSocketEvents } from "@whoshuman/shared-events";
import type { ChatMessage, ChatScope } from "@whoshuman/shared-types";
import { MessageSquare } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { connectSocket } from "../game/network/socket";
import ChatWindow from "./ChatWindow";

interface GroupChatDockProps {
  scope: Exclude<ChatScope, "direct">;
  channelId: string;
  game?: boolean;
}

function GroupChatDock({ scope, channelId, game = false }: GroupChatDockProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    const socket = connectSocket();
    const receive = (message: ChatMessage) => {
      if (!open && message.scope === scope && message.channelId === channelId) {
        setUnread((count) => count + 1);
      }
    };
    socket.on(ServerSocketEvents.chatMessage, receive);
    return () => {
      socket.off(ServerSocketEvents.chatMessage, receive);
    };
  }, [channelId, open, scope]);

  function showChat() {
    setUnread(0);
    setOpen(true);
  }

  const position = game ? "right-3 top-20" : "bottom-16 right-4 sm:bottom-20 sm:right-6";

  return (
    <div className={`fixed ${position} z-[45] touch-auto`}>
      {open ? (
        <div className="h-[min(30rem,calc(100dvh-6rem))] w-[min(23rem,calc(100vw-1.5rem))]">
          <ChatWindow
            key={`${scope}:${channelId}`}
            scope={scope}
            channelId={channelId}
            title={t(game ? "chat.operationTitle" : "chat.roomTitle")}
            onClose={() => setOpen(false)}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={showChat}
          title={t("chat.open")}
          aria-label={t("chat.open")}
          className="relative flex h-12 w-12 items-center justify-center border border-neon-cyan/60 bg-bg/85 text-neon-cyan shadow-[0_0_20px_rgba(36,245,255,0.25)] backdrop-blur-sm transition hover:bg-neon-cyan/12"
        >
          <MessageSquare aria-hidden="true" size={21} />
          {unread > 0 && (
            <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center border border-neon-magenta bg-bg px-1 font-display text-[0.6rem] font-black text-neon-magenta">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </button>
      )}
    </div>
  );
}

export default GroupChatDock;
