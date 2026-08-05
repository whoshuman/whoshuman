import { useTranslation } from "react-i18next";
import ChatWindow from "./ChatWindow";
import { useChatDialogStore } from "./chatStore";

function DirectChatDialog() {
  const { t } = useTranslation();
  const peers = useChatDialogStore((state) => state.peers);
  const close = useChatDialogStore((state) => state.closeDirect);

  if (peers.length === 0) return null;

  return (
    <div className="fixed bottom-3 left-3 z-[90] flex w-max max-w-[calc(100vw-1.5rem)] touch-pan-x items-end gap-3 overflow-x-auto">
      {peers.map((peer) => (
        <div
          key={peer.id}
          className="h-[min(28rem,calc(100dvh-5rem))] w-[min(22rem,calc(100vw-1.5rem))] shrink-0"
        >
          <ChatWindow
            scope="direct"
            title={t("chat.with", { username: peer.username })}
            peer={peer}
            onClose={() => close(peer.id)}
          />
        </div>
      ))}
    </div>
  );
}

export default DirectChatDialog;
