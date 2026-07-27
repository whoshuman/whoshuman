import { Crosshair, ScanSearch } from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useTranslation } from "react-i18next";

import { moveTouchSeeker, shootTouchSeeker } from "../input/touchInput";
import { useGameStore } from "../store/gameStore";

const DEAD_ZONE = 0.12;

function MobileJoystick() {
  const { t } = useTranslation();
  const sendInput = useGameStore((state) => state.sendInput);
  const baseRef = useRef<HTMLDivElement>(null);
  const activePointer = useRef<number | null>(null);
  const lastInput = useRef({ forward: 0, turn: 0 });
  const [knob, setKnob] = useState({ x: 0, y: 0 });

  function update(clientX: number, clientY: number) {
    const rect = baseRef.current?.getBoundingClientRect();
    if (!rect) return;

    const radius = rect.width * 0.31;
    const rawX = clientX - (rect.left + rect.width / 2);
    const rawY = clientY - (rect.top + rect.height / 2);
    const distance = Math.hypot(rawX, rawY);
    const scale = distance > radius ? radius / distance : 1;
    const x = rawX * scale;
    const y = rawY * scale;
    const forward = Math.abs(y / radius) < DEAD_ZONE ? 0 : -y / radius;
    const turn = Math.abs(x / radius) < DEAD_ZONE ? 0 : -x / radius;

    setKnob({ x, y });
    if (
      Math.abs(forward - lastInput.current.forward) > 0.02 ||
      Math.abs(turn - lastInput.current.turn) > 0.02
    ) {
      lastInput.current = { forward, turn };
      sendInput(forward, turn);
    }
  }

  function reset() {
    activePointer.current = null;
    setKnob({ x: 0, y: 0 });
    if (lastInput.current.forward !== 0 || lastInput.current.turn !== 0) {
      lastInput.current = { forward: 0, turn: 0 };
      sendInput(0, 0);
    }
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault();
    activePointer.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    update(event.clientX, event.clientY);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (activePointer.current !== event.pointerId) return;
    event.preventDefault();
    update(event.clientX, event.clientY);
  }

  function handlePointerEnd(event: ReactPointerEvent<HTMLDivElement>) {
    if (activePointer.current !== event.pointerId) return;
    reset();
  }

  useEffect(() => () => sendInput(0, 0), [sendInput]);

  return (
    <div
      ref={baseRef}
      role="group"
      aria-label={t("game.move")}
      className="pointer-events-auto absolute z-20 flex h-32 w-32 touch-none select-none items-center justify-center rounded-full border border-neon-cyan/60 bg-bg/45 shadow-[0_0_24px_rgba(36,245,255,0.18)] backdrop-blur-sm"
      style={{
        bottom: "max(1rem, env(safe-area-inset-bottom))",
        left: "max(1rem, env(safe-area-inset-left))"
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
    >
      <span className="pointer-events-none absolute h-px w-20 bg-neon-cyan/20" />
      <span className="pointer-events-none absolute h-20 w-px bg-neon-cyan/20" />
      <span
        className="pointer-events-none h-12 w-12 rounded-full border-2 border-neon-cyan bg-bg/85 shadow-[0_0_18px_rgba(36,245,255,0.55)]"
        style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }}
      />
    </div>
  );
}

function MobileSeekerControls() {
  const { t } = useTranslation();
  const aiming = useGameStore((state) => state.aiming);
  const setAiming = useGameStore((state) => state.setAiming);
  const activePointer = useRef<number | null>(null);
  const lastPosition = useRef({ x: 0, y: 0 });

  function handleLookStart(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault();
    activePointer.current = event.pointerId;
    lastPosition.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleLookMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (activePointer.current !== event.pointerId) return;
    event.preventDefault();
    moveTouchSeeker(event.clientX - lastPosition.current.x, event.clientY - lastPosition.current.y);
    lastPosition.current = { x: event.clientX, y: event.clientY };
  }

  function handleLookEnd(event: ReactPointerEvent<HTMLDivElement>) {
    if (activePointer.current === event.pointerId) activePointer.current = null;
  }

  function handleShoot() {
    if (!aiming) return;
    shootTouchSeeker();
    navigator.vibrate?.(20);
  }

  useEffect(
    () => () => {
      if (useGameStore.getState().aiming) setAiming(false);
    },
    [setAiming]
  );

  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-auto absolute bottom-0 right-0 top-16 z-[6] block w-[58%] touch-none"
        onPointerDown={handleLookStart}
        onPointerMove={handleLookMove}
        onPointerUp={handleLookEnd}
        onPointerCancel={handleLookEnd}
      />

      <div
        className="pointer-events-auto absolute z-20 flex touch-none select-none items-end gap-3"
        style={{
          bottom: "max(1rem, env(safe-area-inset-bottom))",
          right: "max(1rem, env(safe-area-inset-right))"
        }}
      >
        <div className="flex flex-col items-center gap-1">
          <button
            type="button"
            title={t("game.aim")}
            aria-label={t("game.aim")}
            aria-pressed={aiming}
            onClick={() => setAiming(!aiming)}
            className={`flex h-16 w-16 items-center justify-center rounded-full border-2 bg-bg/80 backdrop-blur-sm transition active:scale-95 ${
              aiming
                ? "border-neon-cyan bg-neon-cyan/20 text-neon-cyan shadow-[0_0_24px_rgba(36,245,255,0.5)]"
                : "border-neon-cyan/60 text-neon-cyan/80"
            }`}
          >
            <ScanSearch aria-hidden="true" size={30} strokeWidth={1.8} />
          </button>
          <span className="font-display text-[0.55rem] font-bold uppercase text-neon-cyan">
            {t("game.aim")}
          </span>
        </div>

        <div className="flex flex-col items-center gap-1">
          <button
            type="button"
            title={t("game.shoot")}
            aria-label={t("game.shoot")}
            disabled={!aiming}
            onClick={handleShoot}
            className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-neon-magenta bg-neon-magenta/20 text-neon-magenta shadow-[0_0_28px_rgba(255,43,214,0.35)] transition active:scale-95 disabled:border-text-muted/40 disabled:bg-bg/70 disabled:text-text-muted disabled:shadow-none"
          >
            <Crosshair aria-hidden="true" size={38} strokeWidth={1.8} />
          </button>
          <span
            className={`font-display text-[0.55rem] font-bold uppercase ${
              aiming ? "text-neon-magenta" : "text-text-muted"
            }`}
          >
            {t("game.shoot")}
          </span>
        </div>
      </div>
    </>
  );
}

interface MobileGameControlsProps {
  enabled: boolean;
}

export default function MobileGameControls({ enabled }: MobileGameControlsProps) {
  const selfRole = useGameStore((state) => state.selfRole);
  const [touchAvailable] = useState(
    () => navigator.maxTouchPoints > 0 || window.matchMedia("(any-pointer: coarse)").matches
  );
  if (!enabled || !selfRole || !touchAvailable) return null;
  return selfRole === "seeker" ? <MobileSeekerControls /> : <MobileJoystick />;
}
