import { useTranslation } from "react-i18next";
import ChatWindow from "./ChatWindow";
import { useChatDialogStore } from "./chatStore";

function DirectChatDialog() {
  const { t } = useTranslation();
  const peer = useChatDialogStore((state) => state.peer);
  const close = useChatDialogStore((state) => state.closeDirect);

  if (!peer) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-bg/80 p-3 backdrop-blur-sm sm:p-6">
      <div className="h-[min(38rem,calc(100dvh-2rem))] w-full max-w-lg">
        <ChatWindow
          scope="direct"
          title={t("chat.with", { username: peer.username })}
          peer={peer}
          onClose={close}
        />
      </div>
    </div>
  );
}

export default DirectChatDialog;
