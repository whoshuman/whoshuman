import { Img, interpolate, random, spring, useCurrentFrame } from "remotion";

import iconUrl from "../assets/whoshuman-icon.svg";
import { color, display } from "../theme";

// El icono del juego (src/assets). Remotion declara los .svg sin tipo: es una URL.
const icon = iconUrl as string;

/** "WHO'S HUMAN" como en la portada del juego, entrando de golpe con un tirón de glitch. */
export function Logo({
  size,
  delay = 0,
  withIcon = true
}: {
  size: number;
  delay?: number;
  withIcon?: boolean;
}) {
  const frame = useCurrentFrame() - delay;
  const pop = spring({ frame, fps: 30, config: { damping: 14, stiffness: 180, mass: 0.7 } });
  const scale = interpolate(pop, [0, 1], [1.35, 1]);
  const jitter = frame >= 0 && frame < 8 ? (random(`logo-${frame}`) - 0.5) * 22 : 0;
  const split = interpolate(frame, [0, 12], [12, 1.5], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp"
  });

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: size * 0.22,
        opacity: frame < 0 ? 0 : Math.min(1, pop * 1.6),
        transform: `scale(${scale}) translateX(${jitter}px)`
      }}
    >
      {withIcon && (
        <Img
          src={icon}
          style={{
            width: size * 1.25,
            height: size * 1.25,
            filter: `drop-shadow(0 0 ${size * 0.2}px ${color.magenta}88)`
          }}
        />
      )}
      <div
        style={{
          fontFamily: display,
          fontWeight: 900,
          fontSize: size,
          lineHeight: 0.92,
          letterSpacing: "0.02em",
          textAlign: "center",
          color: color.text,
          textShadow: `${split}px 0 ${color.magenta}, ${-split}px 0 ${color.cyan}, 0 0 ${size * 0.35}px ${color.violet}cc`
        }}
      >
        WHO&apos;S
        <br />
        HUMAN
      </div>
    </div>
  );
}

// Encendido de un tubo de neón, fotograma a fotograma: 1 encendido, 0 apagado y lo de en medio
// es el zumbido de cuando todavía no ha cogido. Luego se queda en 1.
const POWER_ON = [0, 0, 1, 0, 0, 0.35, 1, 1, 0, 0, 0, 0.6, 1, 0.15, 1, 1, 1, 0.5, 1];

// La M de HUMAN está tocada: vuelve a fallar mientras el cierre sigue en pantalla.
const DEFECTIVE = "HUMAN-2";
const RELAPSES: [number, number[]][] = [
  [26, [0, 1, 0, 0, 1, 1, 0, 0, 0, 0.4, 1, 0, 1]],
  [104, [0, 1, 0, 0.3, 1]],
  [178, [0, 0.4, 1]]
];

function tube(frame: number, key: string) {
  // Cada letra coge la corriente con un pequeño retraso propio.
  const f = frame - 2 - Math.floor(random(`delay-${key}`) * 6);
  if (f < 0) return 0;
  let level = 1;
  if (f < POWER_ON.length) {
    level = POWER_ON[f];
    // Y no todas parpadean igual.
    if (random(`flip-${key}-${f}`) < 0.22) level = 1 - level * 0.7;
  }
  if (key === DEFECTIVE) {
    for (const [at, pattern] of RELAPSES) {
      if (f >= at && f < at + pattern.length) level = pattern[f - at];
    }
  }
  // Zumbido: incluso encendido, el brillo tiembla un pelo.
  return level * (0.93 + random(`hum-${key}-${frame}`) * 0.07);
}

function NeonWord({ word, glow, size }: { word: string; glow: string; size: number }) {
  const frame = useCurrentFrame();
  return (
    <div style={{ whiteSpace: "nowrap" }}>
      {[...word].map((letter, index) => {
        const level = tube(frame, `${word}-${index}`);
        const alpha = (value: number) =>
          Math.round(Math.max(0, Math.min(1, value)) * 255)
            .toString(16)
            .padStart(2, "0");
        return (
          <span
            key={`${letter}-${index}`}
            style={{
              // Apagado se ve el tubo de cristal: un contorno tenue del color del gas.
              color: level > 0.05 ? `${color.text}${alpha(0.25 + level * 0.75)}` : "transparent",
              WebkitTextStroke: `${size * 0.012}px ${glow}${alpha(0.28 + level * 0.5)}`,
              textShadow: [
                `0 0 ${size * 0.04}px #ffffff${alpha(level * 0.9)}`,
                `0 0 ${size * 0.12}px ${glow}${alpha(level)}`,
                `0 0 ${size * 0.3}px ${glow}${alpha(level * 0.85)}`,
                `0 0 ${size * 0.6}px ${glow}${alpha(level * 0.55)}`
              ].join(", ")
            }}
          >
            {letter}
          </span>
        );
      })}
    </div>
  );
}

/** El título del cierre, encendiéndose como un neón con un tubo defectuoso. */
export function NeonLogo({ size }: { size: number }) {
  const frame = useCurrentFrame();
  // El icono y el halo de detrás siguen al rótulo: aparecen cuando el neón coge.
  const lit = interpolate(frame, [8, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp"
  });
  const iconPop = spring({ frame: frame - 14, fps: 30, config: { damping: 16, stiffness: 160 } });
  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: size * 0.22
      }}
    >
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "62%",
          width: size * 5,
          height: size * 3,
          transform: "translate(-50%, -50%)",
          background: `radial-gradient(ellipse at center, ${color.magenta}40 0%, ${color.violet}22 35%, transparent 70%)`,
          opacity: lit * (0.85 + random(`halo-${frame}`) * 0.15)
        }}
      />
      <Img
        src={icon}
        style={{
          position: "relative",
          width: size * 1.25,
          height: size * 1.25,
          opacity: iconPop,
          transform: `scale(${interpolate(iconPop, [0, 1], [0.7, 1])})`,
          filter: `drop-shadow(0 0 ${size * 0.2}px ${color.magenta}88)`
        }}
      />
      <div
        style={{
          position: "relative",
          fontFamily: display,
          fontWeight: 900,
          fontSize: size,
          lineHeight: 0.98,
          letterSpacing: "0.03em",
          textAlign: "center"
        }}
      >
        <NeonWord word="WHO'S" glow={color.magenta} size={size} />
        <NeonWord word="HUMAN" glow={color.cyan} size={size} />
      </div>
    </div>
  );
}
