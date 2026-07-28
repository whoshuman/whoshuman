import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import CornerBrackets from "./CornerBrackets";

// Diálogo de confirmación genérico (título + mensaje + cancelar/confirmar).
// `danger` lo tiñe de naranja para acciones destructivas o irreversibles.
// `pending` bloquea el diálogo mientras la acción está en curso (evita doble envío).
function ConfirmDialog({
  title,
  message,
  confirmLabel,
  danger = false,
  pending = false,
  onConfirm,
  onCancel
}: {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) onCancel();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onCancel, pending]);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div
        aria-hidden="true"
        onClick={pending ? undefined : onCancel}
        className="absolute inset-0 cursor-default bg-bg/90 backdrop-blur-sm"
      />
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
        className={`animate-unfold-down relative w-full max-w-md origin-top border bg-surface shadow-[0_0_48px_rgba(0,0,0,0.6)] ${
          danger ? "border-sun-orange/70" : "border-neon-cyan/70"
        }`}
      >
        <CornerBrackets color={danger ? "var(--color-sun-orange)" : "var(--color-neon-cyan)"} />
        <div
          className={`border-b px-6 py-3 ${
            danger ? "border-sun-orange/30 bg-sun-orange/8" : "border-neon-cyan/30 bg-neon-cyan/8"
          }`}
        >
          <p
            className={`font-display text-xs font-bold uppercase tracking-[0.3em] ${
              danger ? "text-sun-orange" : "text-neon-cyan"
            }`}
          >
            // {t("common.confirmationRequired")}
          </p>
        </div>

        <div className="px-6 py-7">
          <h2
            id="confirm-dialog-title"
            className="font-display text-xl font-black uppercase text-text-main"
          >
            {title}
          </h2>
          <p id="confirm-dialog-message" className="mt-3 text-sm leading-relaxed text-text-muted">
            {message}
          </p>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              autoFocus
              disabled={pending}
              onClick={onCancel}
              className="border border-neon-cyan/50 px-5 py-2.5 font-display text-xs font-bold uppercase tracking-wider text-neon-cyan transition hover:bg-neon-cyan/10 disabled:opacity-50"
            >
              {t("common.cancel")}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={onConfirm}
              className={`border-2 px-5 py-2.5 font-display text-xs font-black uppercase tracking-wider text-bg transition hover:brightness-110 disabled:opacity-50 ${
                danger ? "border-sun-orange bg-sun-orange" : "border-neon-cyan bg-neon-cyan"
              }`}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

export default ConfirmDialog;
