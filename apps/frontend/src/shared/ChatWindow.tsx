import { ClientSocketEvents, ServerSocketEvents } from "@whoshuman/shared-events";
import type {
  ChatAuthor,
  ChatClientHistoryPayload,
  ChatClientSendPayload,
  ChatHistoryResponse,
  ChatMessage,
  ChatScope,
  ChatSocketResponse
} from "@whoshuman/shared-types";
import { Send, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { connectSocket } from "../game/network/socket";
import { useAuthStore } from "./authStore";

const MESSAGE_MAX_LENGTH = 500;

function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const byId = new Map(current.map((message) => [message.id, message]));
  for (const message of incoming) byId.set(message.id, message);
  return [...byId.values()].sort(
    (first, second) => Date.parse(first.createdAt) - Date.parse(second.createdAt)
  );
}

function belongsToConversation(
  message: ChatMessage,
  scope: ChatScope,
  selfId: string | undefined,
  channelId?: string,
  peerId?: string
): boolean {
  if (message.scope !== scope) return false;
  if (scope !== "direct") return message.channelId === channelId;
  if (!selfId || !peerId) return false;
  return (
    (message.sender.id === selfId && message.recipientId === peerId) ||
    (message.sender.id === peerId && message.recipientId === selfId)
  );
}

interface ChatWindowProps {
  scope: ChatScope;
  title: string;
  channelId?: string;
  peer?: ChatAuthor;
  onClose?: () => void;
}

function ChatWindow({ scope, title, channelId, peer, onClose }: ChatWindowProps) {
  const { t, i18n } = useTranslation();
  const selfId = useAuthStore((state) => state.user?.id);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const loadHistory = useCallback(() => {
    const socket = connectSocket();
    if (!socket.connected) return;
    const payload: ChatClientHistoryPayload = {
      scope,
      ...(peer ? { recipientId: peer.id } : {})
    };
    socket
      .timeout(5000)
      .emit(
        ClientSocketEvents.chatHistory,
        payload,
        (timeoutError: Error | null, response: ChatSocketResponse<ChatHistoryResponse>) => {
          setLoading(false);
          if (timeoutError || !response?.ok || !response.data) {
            setError(t("chat.loadError"));
            return;
          }
          setError(null);
          setMessages((current) => mergeMessages(current, response.data?.messages ?? []));
        }
      );
  }, [peer, scope, t]);

  // El estado de la conversacion se resetea remontando: cada sitio que renderiza
  // ChatWindow le pasa una `key` propia de la conversacion.
  useEffect(() => {
    const socket = connectSocket();
    const receive = (message: ChatMessage) => {
      if (belongsToConversation(message, scope, selfId, channelId, peer?.id)) {
        setMessages((current) => mergeMessages(current, [message]));
      }
    };
    // Al reconectar el gateway se vuelve a pedir el historial mostrando el spinner;
    // en el montaje `loading` ya arranca en true.
    const reload = () => {
      setLoading(true);
      loadHistory();
    };
    socket.on(ServerSocketEvents.chatMessage, receive);
    socket.on(ServerSocketEvents.gatewayReady, reload);
    loadHistory();
    return () => {
      socket.off(ServerSocketEvents.chatMessage, receive);
      socket.off(ServerSocketEvents.gatewayReady, reload);
    };
  }, [channelId, loadHistory, peer?.id, scope, selfId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  function sendMessage() {
    const trimmed = content.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setError(null);
    const payload: ChatClientSendPayload = {
      scope,
      content: trimmed,
      ...(peer ? { recipientId: peer.id } : {})
    };
    connectSocket()
      .timeout(5000)
      .emit(
        ClientSocketEvents.chatSend,
        payload,
        (timeoutError: Error | null, response: ChatSocketResponse<ChatMessage>) => {
          setSending(false);
          if (timeoutError || !response?.ok || !response.data) {
            setError(t("chat.sendError"));
            return;
          }
          setContent("");
          setMessages((current) => mergeMessages(current, [response.data as ChatMessage]));
        }
      );
  }

  return (
    <section className="flex h-full min-h-0 flex-col border border-neon-cyan/55 bg-surface/98 shadow-[0_0_40px_rgba(36,245,255,0.2)]">
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-neon-cyan/25 bg-neon-cyan/8 px-4">
        <div className="min-w-0">
          <p className="font-display truncate text-xs font-black uppercase tracking-[0.2em] text-neon-cyan">
            // {title}
          </p>
          <p className="mt-0.5 text-xs text-text-muted">
            {scope === "direct" ? t("chat.directChannel") : t("chat.squadChannel")}
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            title={t("chat.close")}
            aria-label={t("chat.close")}
            className="flex h-9 w-9 shrink-0 items-center justify-center border border-neon-cyan/35 text-neon-cyan transition hover:bg-neon-cyan/10"
          >
            <X aria-hidden="true" size={17} />
          </button>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3" aria-live="polite">
        {loading && messages.length === 0 && (
          <p className="animate-pulse py-8 text-center font-display text-xs font-bold uppercase tracking-widest text-neon-cyan">
            {t("chat.loading")}
          </p>
        )}
        {!loading && messages.length === 0 && !error && (
          <p className="py-8 text-center font-display text-xs font-bold uppercase tracking-widest text-text-muted/70">
            // {t("chat.empty")}
          </p>
        )}
        <div className="flex flex-col gap-2">
          {messages.map((message) => {
            const own = message.sender.id === selfId;
            const time = new Intl.DateTimeFormat(i18n.language, {
              hour: "2-digit",
              minute: "2-digit"
            }).format(new Date(message.createdAt));
            return (
              <article
                key={message.id}
                className={`max-w-[88%] border px-3 py-2 ${
                  own
                    ? "ml-auto border-neon-magenta/45 bg-neon-magenta/8"
                    : "mr-auto border-neon-cyan/30 bg-neon-cyan/6"
                }`}
              >
                <div className="mb-1 flex items-center justify-between gap-4">
                  <span
                    className={`font-display text-[0.65rem] font-bold uppercase ${own ? "text-neon-magenta" : "text-neon-cyan"}`}
                  >
                    {own ? t("chat.you") : message.sender.username}
                  </span>
                  <time className="text-[0.65rem] text-text-muted/65">{time}</time>
                </div>
                <p className="whitespace-pre-wrap break-words text-sm text-text-main">
                  {message.content}
                </p>
              </article>
            );
          })}
        </div>
        <div ref={endRef} />
      </div>

      {error && (
        <p className="shrink-0 border-t border-error/40 px-4 py-2 text-xs text-error">// {error}</p>
      )}

      <div className="shrink-0 border-t border-neon-cyan/25 p-3">
        <div className="flex items-end gap-2">
          <textarea
            value={content}
            maxLength={MESSAGE_MAX_LENGTH}
            rows={2}
            onChange={(event) => setContent(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                sendMessage();
              }
            }}
            placeholder={t("chat.placeholder")}
            aria-label={t("chat.placeholder")}
            className="min-h-12 min-w-0 flex-1 resize-none border border-neon-cyan/30 bg-black/25 px-3 py-2 text-sm text-text-main outline-none transition focus:border-neon-cyan"
          />
          <button
            type="button"
            onClick={sendMessage}
            disabled={!content.trim() || sending}
            title={t("chat.send")}
            aria-label={t("chat.send")}
            className="flex h-12 w-12 shrink-0 items-center justify-center border border-neon-magenta bg-neon-magenta/12 text-neon-magenta transition hover:bg-neon-magenta/22 disabled:cursor-not-allowed disabled:opacity-35"
          >
            <Send aria-hidden="true" size={19} />
          </button>
        </div>
        <p className="mt-1 text-right text-[0.65rem] tabular-nums text-text-muted/60">
          {content.length}/{MESSAGE_MAX_LENGTH}
        </p>
      </div>
    </section>
  );
}

export default ChatWindow;
