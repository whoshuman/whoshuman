import { Crosshair, ScanSearch } from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useTranslation } from "react-i18next";

import { normalizeJoystick, setTouchCamera, shootTouchSeeker } from "../input/touchInput";
import { useGameStore } from "../store/gameStore";

const DEAD_ZONE = 0.12;
const BASE_RADIUS = 56;
const KNOB_RADIUS = 40;

interface VirtualJoystickProps {
  label: string;
  side: "left" | "right";
  onChange: (x: number, y: number) => void;
}

function VirtualJoystick({ label, side, onChange }: VirtualJoystickProps) {
  const zoneRef = useRef<HTMLDivElement>(null);
  const activePointer = useRef<number | null>(null);
  const origin = useRef({ x: 0, y: 0 });
  const onChangeRef = useRef(onChange);
  const lastVector = useRef({ x: 0, y: 0 });
  const [base, setBase] = useState<{ x: number; y: number } | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  onChangeRef.current = onChange;

  function update(clientX: number, clientY: number) {
    const rawX = clientX - origin.current.x;
    const rawY = clientY - origin.current.y;
    const { knobX, knobY, x, y } = normalizeJoystick(rawX, rawY, KNOB_RADIUS, DEAD_ZONE);

    setKnob({ x: knobX, y: knobY });
    if (Math.abs(x - lastVector.current.x) > 0.02 || Math.abs(y - lastVector.current.y) > 0.02) {
      lastVector.current = { x, y };
      onChangeRef.current(x, y);
    }
  }

  function reset() {
    if (activePointer.current === null) return;
    activePointer.current = null;
    setBase(null);
    setKnob({ x: 0, y: 0 });
    if (lastVector.current.x !== 0 || lastVector.current.y !== 0) {
      lastVector.current = { x: 0, y: 0 };
      onChangeRef.current(0, 0);
    }
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (activePointer.current !== null) return;
    event.preventDefault();
    const rect = zoneRef.current?.getBoundingClientRect();
    if (!rect) return;
    const padding = BASE_RADIUS + 8;
    const minY = padding;
    const maxY = Math.max(minY, rect.height - padding);
    const centerX = Math.min(Math.max(event.clientX - rect.left, padding), rect.width - padding);
    const centerY = Math.min(Math.max(event.clientY - rect.top, minY), maxY);

    activePointer.current = event.pointerId;
    origin.current = { x: rect.left + centerX, y: rect.top + centerY };
    setBase({ x: centerX, y: centerY });
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

  useEffect(() => {
    const stop = () => {
      if (activePointer.current !== null) reset();
    };
    const stopWhenHidden = () => {
      if (document.hidden) stop();
    };
    window.addEventListener("blur", stop);
    window.addEventListener("pagehide", stop);
    document.addEventListener("visibilitychange", stopWhenHidden);
    return () => {
      window.removeEventListener("blur", stop);
      window.removeEventListener("pagehide", stop);
      document.removeEventListener("visibilitychange", stopWhenHidden);
      if (activePointer.current !== null) {
        activePointer.current = null;
        onChangeRef.current(0, 0);
      }
    };
  }, []);

  return (
    <div
      ref={zoneRef}
      role="group"
      aria-label={label}
      className={`pointer-events-auto absolute bottom-0 top-20 z-[15] w-1/2 touch-none select-none ${side === "left" ? "left-0" : "right-0"}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
    >
      {!base && (
        <span
          className={`pointer-events-none absolute bottom-[max(0.75rem,env(safe-area-inset-bottom))] font-display text-[0.5rem] font-bold uppercase tracking-[0.18em] text-neon-cyan/55 ${side === "left" ? "left-[max(1rem,env(safe-area-inset-left))]" : "right-[max(1rem,env(safe-area-inset-right))]"}`}
        >
          {label}
        </span>
      )}
      {base && (
        <div
          className="pointer-events-none absolute flex h-28 w-28 items-center justify-center rounded-full border-2 border-neon-cyan/70 bg-bg/55 shadow-[0_0_28px_rgba(36,245,255,0.24)] backdrop-blur-sm"
          style={{ left: base.x - BASE_RADIUS, top: base.y - BASE_RADIUS }}
        >
          <span className="absolute h-px w-20 bg-neon-cyan/20" />
          <span className="absolute h-20 w-px bg-neon-cyan/20" />
          <span
            className="h-12 w-12 rounded-full border-2 border-neon-cyan bg-bg/90 shadow-[0_0_20px_rgba(36,245,255,0.65)]"
            style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }}
          />
        </div>
      )}
    </div>
  );
}

function MobileHiderControls() {
  const { t } = useTranslation();
  const sendInput = useGameStore((state) => state.sendInput);
  return (
    <>
      <VirtualJoystick label={t("game.move")} side="left" onChange={(x, y) => sendInput(-y, -x)} />
      <VirtualJoystick label={t("game.camera")} side="right" onChange={setTouchCamera} />
    </>
  );
}

function MobileSeekerControls() {
  const { t } = useTranslation();
  const aiming = useGameStore((state) => state.aiming);
  const setAiming = useGameStore((state) => state.setAiming);

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
      <VirtualJoystick label={t("game.camera")} side="left" onChange={setTouchCamera} />

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
  return selfRole === "seeker" ? <MobileSeekerControls /> : <MobileHiderControls />;
}
