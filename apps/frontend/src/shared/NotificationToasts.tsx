import { useTranslation } from "react-i18next";

import { useNotificationStore } from "./notificationStore";

// Stack de avisos del sistema, arriba a la derecha, visible en cualquier pantalla.
// Click = descartar; se autodescartan a los 6s (TTL en el store).
function NotificationToasts() {
  const { t } = useTranslation();
  const toasts = useNotificationStore((s) => s.toasts);
  const dismiss = useNotificationStore((s) => s.dismiss);

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed right-4 top-20 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2"
    >
      {toasts.map(({ id, envelope }) => {
        const accepted = envelope.type === "friend.request.accepted";
        return (
          <button
            key={id}
            type="button"
            onClick={() => dismiss(id)}
            className={
              accepted
                ? "animate-unfold-down origin-top border border-success bg-surface px-4 py-3 text-left shadow-[0_0_24px_rgba(57,255,136,0.2)]"
                : "animate-unfold-down origin-top border border-neon-magenta bg-surface px-4 py-3 text-left shadow-[0_0_24px_rgba(255,43,214,0.2)]"
            }
          >
            <p
              className={
                accepted
                  ? "font-display text-[0.65rem] font-bold uppercase tracking-[0.25em] text-success"
                  : "font-display text-[0.65rem] font-bold uppercase tracking-[0.25em] text-neon-magenta"
              }
            >
              //{" "}
              {accepted ? t("notifications.requestAccepted") : t("notifications.requestReceived")}
            </p>
            <p className="font-display mt-1 truncate text-sm font-black text-text-main">
              {envelope.from.username}
            </p>
          </button>
        );
      })}
    </div>
  );
}

export default NotificationToasts;
