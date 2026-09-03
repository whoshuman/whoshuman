import { useTranslation } from "react-i18next";

import type { PlayerRole } from "@whoshuman/shared-types";

import { useGameStore } from "../store/gameStore";

// Aviso de controles del pie de la partida. Antes era una frase larga ("A/D o flechas
// para orbitar · manten clic derecho..."): se leia como un parrafo de manual y con el
// ojo en la partida no se leia en absoluto. Ahora es lo que se espera en un juego: la
// tecla dibujada y al lado el verbo, para reconocerlo de un vistazo sin leerlo.
//
// El cazador ve lo que puede hacer AHORA, no la lista entera. El raton solo gira la
// vista con la mira puesta (ver moveAim en GameScene), asi que anunciar "mirar" en la
// vista general prometia algo que no funciona: sin apuntar solo se orbita con A/D.

/** Boton del raton, con el que toca encendido. `move` es el raton entero moviendose. */
function MouseGlyph({ side }: { side: "left" | "right" | "move" }) {
  return (
    <svg
      width="13"
      height="17"
      viewBox="0 0 13 17"
      aria-hidden="true"
      className="text-neon-cyan"
      fill="none"
    >
      <defs>
        <clipPath id="control-hints-mouse">
          <rect x="0" y="0" width="13" height="17" rx="6.5" />
        </clipPath>
      </defs>
      <g clipPath="url(#control-hints-mouse)">
        {side === "left" && <rect x="0" y="0" width="6.5" height="7.4" fill="currentColor" />}
        {side === "right" && <rect x="6.5" y="0" width="6.5" height="7.4" fill="currentColor" />}
      </g>
      <rect
        x="0.6"
        y="0.6"
        width="11.8"
        height="15.8"
        rx="5.9"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <path d="M6.5 0.6 V7.4 M0.6 7.4 H12.4" stroke="currentColor" strokeWidth="1" />
      {side === "move" && (
        <path
          d="M2.6 11.4 H10.4 M2.6 11.4 L4.1 9.9 M2.6 11.4 L4.1 12.9 M10.4 11.4 L8.9 9.9 M10.4 11.4 L8.9 12.9"
          stroke="currentColor"
          strokeWidth="1"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}

/** Tecla dibujada: o un texto corto (A/D, F) o el raton. */
function Cap({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="flex h-[1.35rem] min-w-[1.35rem] items-center justify-center gap-0.5 rounded-[3px] border border-neon-cyan/60 bg-neon-cyan/10 px-1 font-display text-[0.6rem] font-black not-italic leading-none text-neon-cyan shadow-[0_0_10px_rgba(36,245,255,0.2)]">
      {children}
    </kbd>
  );
}

function Hint({ caps, label }: { caps: React.ReactNode; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="flex items-center gap-1">{caps}</span>
      <span className="font-display text-[0.6rem] font-bold uppercase tracking-[0.16em] text-text-muted">
        {label}
      </span>
    </span>
  );
}

function Divider() {
  return <span aria-hidden="true" className="h-3 w-px shrink-0 bg-neon-cyan/20" />;
}

export default function ControlHints({ role }: { role: PlayerRole }) {
  const { t } = useTranslation();
  const aiming = useGameStore((state) => state.aiming);

  const vistaGeneral = [
    { caps: <Cap>A/D</Cap>, label: t("game.hintOrbit") },
    {
      caps: (
        <>
          <Cap>
            <MouseGlyph side="right" />
          </Cap>
          <Cap>F</Cap>
        </>
      ),
      label: t("game.hintAim")
    }
  ];

  const conLaMira = [
    {
      caps: (
        <Cap>
          <MouseGlyph side="move" />
        </Cap>
      ),
      label: t("game.hintLook")
    },
    {
      caps: (
        <Cap>
          <MouseGlyph side="left" />
        </Cap>
      ),
      label: t("game.hintShoot")
    },
    {
      // Se sale SOLTANDO el derecho, no pulsandolo otra vez. F tambien la baja, pero es
      // la via secundaria y aqui manda lo que el jugador tiene en la mano.
      caps: (
        <Cap>
          <MouseGlyph side="right" />
        </Cap>
      ),
      label: t("game.hintRelease")
    }
  ];

  const hints =
    role === "seeker"
      ? aiming
        ? conLaMira
        : vistaGeneral
      : [
          { caps: <Cap>W/S</Cap>, label: t("game.hintMove") },
          { caps: <Cap>A/D</Cap>, label: t("game.hintTurn") }
        ];

  return (
    <div className="pointer-events-none absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2.5 border border-neon-cyan/25 bg-bg/70 px-3 py-1.5 backdrop-blur-sm [@media(pointer:coarse)]:hidden">
      {hints.map((hint, index) => (
        <span key={hint.label} className="flex items-center gap-2.5">
          {index > 0 && <Divider />}
          <Hint caps={hint.caps} label={hint.label} />
        </span>
      ))}
    </div>
  );
}
