import { useState } from "react";
import { useTranslation } from "react-i18next";

import CornerBrackets from "../shared/CornerBrackets";
import { useHologramSound } from "../shared/useHologramSound";

export type RoomModalMode = "create" | "join" | "search";

type RoomModalProps = {
  mode: RoomModalMode;
  // Vuelve al menu de operaciones (no cierra el lobby).
  onBack: () => void;
};

// Salas abiertas de ejemplo (mock; el backend de matchmaking aun no existe).
const MOCK_ROOMS = [
  { id: "WH-7X2K", name: "NEON DISTRICT", units: "3/6", status: "waiting" },
  { id: "WH-9QP4", name: "CHROME ALLEY", units: "5/6", status: "waiting" },
  { id: "WH-2M8R", name: "SECTOR ROUGE", units: "1/6", status: "waiting" }
];

const inputClass =
  "box-border w-full border border-neon-cyan/35 bg-white/5 px-4 py-3 font-display uppercase tracking-wider text-text-main outline-none transition focus:border-neon-cyan focus:ring-2 focus:ring-neon-cyan/20";
const labelClass = "mb-2 block text-xs font-bold uppercase tracking-widest text-text-muted";
const primaryButton =
  "mt-2 w-full border-2 border-neon-magenta bg-neon-magenta py-3.5 font-display font-black uppercase tracking-widest text-bg shadow-[0_0_24px_rgba(255,43,214,0.5)] transition hover:brightness-110 hover:shadow-[0_0_40px_rgba(255,43,214,0.7)] active:translate-y-px";

// Panel de salas (crear / unirse / buscar). Se expande en el lugar de las fichas (no es un
// modal por encima); vuelve al menu con el boton de atras. Aparicion holografica.
function RoomModal({ mode, onBack }: RoomModalProps) {
  const { t } = useTranslation();
  useHologramSound();

  const [roomName, setRoomName] = useState("");
  const [maxUnits, setMaxUnits] = useState("6");
  const [code, setCode] = useState("");

  const titleKey =
    mode === "create" ? "room.createTitle" : mode === "join" ? "room.joinTitle" : "room.searchTitle";

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
                <label className={labelClass} htmlFor="room-name">
                  {t("room.roomName")}
                </label>
                <input
                  id="room-name"
                  type="text"
                  value={roomName}
                  onChange={(event) => setRoomName(event.target.value)}
                  placeholder={t("room.roomNamePlaceholder")}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="room-mode">
                  {t("room.mode")}
                </label>
                <select id="room-mode" className={inputClass} defaultValue="energy">
                  <option value="energy">ENERGY CELL GRAB</option>
                </select>
              </div>
              <div>
                <label className={labelClass} htmlFor="room-max">
                  {t("room.maxPlayers")}
                </label>
                <select
                  id="room-max"
                  value={maxUnits}
                  onChange={(event) => setMaxUnits(event.target.value)}
                  className={inputClass}
                >
                  {["4", "6", "8"].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
              <button type="button" className={primaryButton}>
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
              <button type="button" className={primaryButton}>
                {t("room.join")} →
              </button>
            </>
          )}

          {mode === "search" && (
            <>
              <div className="flex flex-col gap-3">
                {MOCK_ROOMS.map((room) => (
                  <div
                    key={room.id}
                    className="flex items-center justify-between border border-neon-cyan/20 bg-white/3 px-4 py-3 transition hover:border-neon-cyan/40 hover:bg-white/5"
                  >
                    <div>
                      <p className="font-display text-sm font-bold text-neon-cyan">{room.name}</p>
                      <p className="text-xs text-text-muted">
                        {room.id} · {room.units} {t("room.units")}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="border border-neon-cyan px-4 py-1.5 font-display text-xs font-bold uppercase tracking-wider text-neon-cyan transition hover:bg-neon-cyan/10"
                    >
                      {t("room.join")}
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="border border-neon-cyan/40 py-2.5 font-display text-xs font-bold uppercase tracking-wider text-neon-cyan transition hover:bg-neon-cyan/10"
              >
                ↻ {t("room.refresh")}
              </button>
            </>
          )}
        </div>
      </div>
  );
}

export default RoomModal;
