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
import { ArrowDown, Send, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { connectSocket } from "../game/network/socket";
import { useAuthStore } from "./authStore";

const MESSAGE_MAX_LENGTH = 500;
// El contador solo aparece cuando queda poco: verlo siempre no informa de nada y mete
// ruido bajo el campo de escritura.
const COUNTER_VISIBLE_FROM = MESSAGE_MAX_LENGTH - 100;
// Alto máximo del campo al crecer. Cuatro líneas largas; a partir de ahí hace scroll y
// no se come la conversación, que es lo que se está leyendo.
const INPUT_MAX_HEIGHT = 120;
// Dos mensajes seguidos del mismo autor dentro de este margen se agrupan bajo una sola
// cabecera. Más allá, la pausa es lo bastante larga como para volver a fechar.
const GROUP_WINDOW_MS = 5 * 60 * 1000;
// Margen para considerar que estás "abajo del todo". No es 0: al escribir, el campo
// crece y desplaza la lista unos píxeles sin que el usuario haya tocado el scroll.
const STUCK_TO_BOTTOM_PX = 48;

// Fila ya resuelta para pintar: quién la manda, si continúa al mensaje anterior y si
// abre un día nuevo. Se calcula una vez por lista y no dentro del map del render.
interface MessageRow {
  message: ChatMessage;
  own: boolean;
  // Continúa un bloque del mismo autor: se pinta sin cabecera y más pegada.
  grouped: boolean;
  daySeparator: Date | null;
}

function buildRows(messages: ChatMessage[], selfId: string | undefined): MessageRow[] {
  return messages.map((message, index) => {
    const previous = index > 0 ? messages[index - 1] : null;
    const date = new Date(message.createdAt);
    const previousDate = previous ? new Date(previous.createdAt) : null;
    const newDay = !previousDate || previousDate.toDateString() !== date.toDateString();
    return {
      message,
      own: message.sender.id === selfId,
      grouped:
        !newDay &&
        !!previous &&
        previous.sender.id === message.sender.id &&
        date.getTime() - (previousDate?.getTime() ?? 0) < GROUP_WINDOW_MS,
      daySeparator: newDay ? date : null
    };
  });
}

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
  // Han llegado mensajes mientras leías más arriba: se avisa en vez de arrastrarte abajo.
  const [pendingBelow, setPendingBelow] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // Arranca en true: al abrir la ventana se entra por el final de la conversación.
  const stuckToBottom = useRef(true);

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

  const scrollToEnd = useCallback((behavior: ScrollBehavior = "auto") => {
    stuckToBottom.current = true;
    setPendingBelow(false);
    endRef.current?.scrollIntoView({ block: "end", behavior });
  }, []);

  // Antes se bajaba a la fuerza con cada mensaje: si estabas leyendo hacia arriba, te
  // sacaba de donde estabas. Ahora solo sigue la conversación a quien ya estaba al final.
  useEffect(() => {
    if (stuckToBottom.current) endRef.current?.scrollIntoView({ block: "end" });
    else if (messages.length > 0) setPendingBelow(true);
  }, [messages]);

  // El campo crece con lo escrito hasta su tope. Se pone a "auto" primero porque
  // scrollHeight no encoge por sí solo al borrar texto.
  useEffect(() => {
    const node = inputRef.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${Math.min(node.scrollHeight, INPUT_MAX_HEIGHT)}px`;
  }, [content]);

  const rows = useMemo(() => buildRows(messages, selfId), [messages, selfId]);
  const timeFormat = useMemo(
    () => new Intl.DateTimeFormat(i18n.language, { hour: "2-digit", minute: "2-digit" }),
    [i18n.language]
  );
  const dayFormat = useMemo(
    () => new Intl.DateTimeFormat(i18n.language, { day: "numeric", month: "short" }),
    [i18n.language]
  );

  // Etiqueta del separador de día: hoy y ayer por su nombre, el resto por su fecha.
  function dayLabel(date: Date): string {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return t("chat.today");
    if (date.toDateString() === yesterday.toDateString()) return t("chat.yesterday");
    return dayFormat.format(date);
  }

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
          // Mandar es querer ver lo que mandas: aunque estuvieras leyendo más arriba, la
          // vista vuelve al final en vez de avisarte de tu propio mensaje.
          scrollToEnd();
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

      {/* El aviso de mensajes nuevos flota sobre la lista, por eso el envoltorio: si
          fuese un hermano en el flujo, aparecer y desaparecer movería el panel. */}
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div
          onScroll={(event) => {
            const node = event.currentTarget;
            stuckToBottom.current =
              node.scrollHeight - node.scrollTop - node.clientHeight < STUCK_TO_BOTTOM_PX;
            if (stuckToBottom.current) setPendingBelow(false);
          }}
          className="min-h-0 flex-1 overflow-y-auto px-4 py-3"
          aria-live="polite"
        >
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
          <div className="flex flex-col">
            {rows.map(({ message, own, grouped, daySeparator }) => (
              <div key={message.id} className="flex flex-col">
                {daySeparator && (
                  <div className="my-3 flex items-center gap-3">
                    <span className="h-px flex-1 bg-neon-cyan/15" />
                    <span className="font-display text-[0.6rem] font-bold uppercase tracking-[0.2em] text-text-muted/80">
                      {dayLabel(daySeparator)}
                    </span>
                    <span className="h-px flex-1 bg-neon-cyan/15" />
                  </div>
                )}
                {/* Los mensajes seguidos de un mismo autor se pegan entre sí y pierden la
                  cabecera: antes cada uno repetía nombre y hora, y una ráfaga de tres
                  frases ocupaba el triple de alto del que le corresponde. */}
                <article
                  className={`max-w-[88%] border px-3 py-2 ${grouped ? "mt-0.5" : "mt-2"} ${
                    own
                      ? "ml-auto border-neon-magenta/45 bg-neon-magenta/8"
                      : "mr-auto border-neon-cyan/30 bg-neon-cyan/6"
                  }`}
                >
                  {!grouped && (
                    <div className="mb-1 flex items-center justify-between gap-4">
                      <span
                        className={`font-display text-[0.65rem] font-bold uppercase ${own ? "text-neon-magenta" : "text-neon-cyan"}`}
                      >
                        {own ? t("chat.you") : message.sender.username}
                      </span>
                      <time
                        dateTime={message.createdAt}
                        className="text-[0.65rem] text-text-muted/80"
                      >
                        {timeFormat.format(new Date(message.createdAt))}
                      </time>
                    </div>
                  )}
                  <p className="whitespace-pre-wrap break-words text-sm text-text-main">
                    {message.content}
                  </p>
                </article>
              </div>
            ))}
          </div>
          <div ref={endRef} />
        </div>

        {/* Contrapartida de no arrastrar el scroll: si llega algo mientras lees más
            arriba, hay que decirlo, o el mensaje pasa desapercibido. */}
        {pendingBelow && (
          <button
            type="button"
            onClick={() => scrollToEnd("smooth")}
            className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2 border border-neon-cyan/60 bg-bg/92 px-3 py-1.5 font-display text-[0.65rem] font-bold uppercase tracking-widest text-neon-cyan shadow-[0_0_16px_rgba(36,245,255,0.25)] backdrop-blur-sm transition hover:bg-neon-cyan/12"
          >
            <ArrowDown aria-hidden="true" size={13} />
            {t("chat.newMessages")}
          </button>
        )}
      </div>

      {error && (
        <p className="shrink-0 border-t border-error/40 px-4 py-2 text-xs text-error">// {error}</p>
      )}

      <div className="shrink-0 border-t border-neon-cyan/25 p-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={content}
            maxLength={MESSAGE_MAX_LENGTH}
            rows={1}
            onChange={(event) => setContent(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                sendMessage();
              }
            }}
            placeholder={t("chat.placeholder")}
            aria-label={t("chat.placeholder")}
            className="min-h-12 min-w-0 flex-1 resize-none overflow-y-auto border border-neon-cyan/30 bg-black/25 px-3 py-3 text-sm leading-snug text-text-main outline-none transition focus:border-neon-cyan"
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
        {/* Solo cuando queda poco margen: el resto del tiempo no aporta nada. */}
        {content.length >= COUNTER_VISIBLE_FROM && (
          <p
            className={`mt-1 text-right text-[0.65rem] tabular-nums ${
              content.length >= MESSAGE_MAX_LENGTH ? "text-sun-orange" : "text-text-muted/80"
            }`}
          >
            {content.length}/{MESSAGE_MAX_LENGTH}
          </p>
        )}
      </div>
    </section>
  );
}

export default ChatWindow;
