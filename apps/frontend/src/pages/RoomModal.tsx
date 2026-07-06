import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useLobbyStore } from "../game/store/lobbyStore";
import { generateRoomCode } from "../game/utils/roomCode";
import CornerBrackets from "../shared/CornerBrackets";
import { useHologramSound } from "../shared/useHologramSound";

export type RoomModalMode = "create" | "join";

type RoomModalProps = {
  mode: RoomModalMode;
  // Vuelve al menu de operaciones (no cierra el lobby).
  onBack: () => void;
};

const inputClass =
  "box-border w-full border border-neon-cyan/35 bg-white/5 px-4 py-3 font-display uppercase tracking-wider text-text-main outline-none transition focus:border-neon-cyan focus:ring-2 focus:ring-neon-cyan/20";
const labelClass = "mb-2 block text-xs font-bold uppercase tracking-widest text-text-muted";
const primaryButton =
  "mt-2 w-full border-2 border-neon-magenta bg-neon-magenta py-3.5 font-display font-black uppercase tracking-widest text-bg shadow-[0_0_24px_rgba(255,43,214,0.5)] transition hover:brightness-110 hover:shadow-[0_0_40px_rgba(255,43,214,0.7)] active:translate-y-px";

// Panel de salas (crear / unirse). Se expande en el lugar de las fichas; vuelve al
// menu con el boton de atras. Para el backend un "código" es solo un lobbyId:
// matchmaking crea la sala en memoria con el primer join.
function RoomModal({ mode, onBack }: RoomModalProps) {
  const { t } = useTranslation();
  useHologramSound();
  const join = useLobbyStore((s) => s.join);

  // Código generado una sola vez por montaje (inicializador perezoso de useState).
  const [generatedCode] = useState(() => generateRoomCode());
  const [code, setCode] = useState("");

  const titleKey = mode === "create" ? "room.createTitle" : "room.joinTitle";

  return (
    <div className="animate-unfold-down origin-top relative mx-auto w-full max-w-lg border border-neon-magenta/50 bg-surface shadow-[0_0_48px_rgba(255,43,214,0.2)]">
      <CornerBrackets color="var(--color-neon-cyan)" />

      {/* Cabecera: titulo de la operacion + volver al menu. */}
      <div className="flex items-center justify-between border-b border-neon-magenta/30 bg-neon-magenta/10 px-6 py-4">
        <p className="font-display text-sm font-black uppercase tracking-[0.2em] text-neon-magenta">
          // {t(titleKey)}
        </p>
        <button
          type="button"
          onClick={onBack}
          className="border border-neon-cyan/40 px-4 py-1.5 font-display text-xs font-bold uppercase tracking-wider text-neon-cyan transition hover:bg-neon-cyan/10"
        >
          ← {t("room.back")}
        </button>
      </div>

      <div className="flex flex-col gap-5 p-6">
        {mode === "create" && (
          <>
            <div>
              <p className={labelClass}>{t("room.shareCode")}</p>
              <p className="border border-neon-cyan/35 bg-black/30 py-4 text-center font-display text-3xl font-black tracking-[0.3em] text-neon-cyan [text-shadow:0_0_18px_rgba(36,245,255,0.6)]">
                {generatedCode}
              </p>
            </div>
            <button type="button" onClick={() => join(generatedCode)} className={primaryButton}>
              {t("room.create")} →
            </button>
          </>
        )}

        {mode === "join" && (
          <>
            <div>
              <label className={labelClass} htmlFor="room-code">
                {t("room.roomCode")}
              </label>
              <input
                id="room-code"
                type="text"
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
                placeholder={t("room.roomCodePlaceholder")}
                className={`${inputClass} text-center text-xl tracking-[0.3em]`}
              />
            </div>
            <button
              type="button"
              disabled={!code.trim()}
              onClick={() => join(code.trim())}
              className={`${primaryButton} disabled:cursor-not-allowed disabled:opacity-40`}
            >
              {t("room.join")} →
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default RoomModal;
