import type { CSSProperties } from "react";
import {
  AbsoluteFill,
  interpolate,
  OffthreadVideo,
  Sequence,
  staticFile,
  useCurrentFrame
} from "remotion";

import { sec, SHOT, SHOTS, type Shot } from "../timeline";
import { color, FEED, type Layout } from "../theme";

function Video({ shot, style }: { shot: Shot; style: CSSProperties }) {
  return (
    <OffthreadVideo
      src={staticFile(`clips/${shot.clip}.mp4`)}
      trimBefore={Math.round(shot.clipStart * 30)}
      playbackRate={shot.rate ?? 1}
      muted
      style={{ width: "100%", height: "100%", objectFit: "cover", ...style }}
    />
  );
}

function Clip({ shot, duration, blur }: { shot: Shot; duration: number; blur?: boolean }) {
  const frame = useCurrentFrame();
  if (blur) {
    return (
      <Video
        shot={shot}
        style={{ transform: "scale(1.15)", filter: "blur(34px) brightness(0.32) saturate(1.4)" }}
      />
    );
  }
  // Un empujón lento en cada plano: con la cámara del juego quieta, el corte se siente vivo.
  const scale = interpolate(frame, [0, duration], [1, 1.035]) * (shot.zoom?.scale ?? 1);
  const origin = shot.zoom ? `${shot.zoom.x * 100}% ${shot.zoom.y * 100}%` : "50% 50%";
  const transform = `scale(${scale})`;
  return (
    <AbsoluteFill>
      <Video
        shot={shot}
        style={{ transform, transformOrigin: origin, filter: "saturate(1.12) contrast(1.05)" }}
      />
      {/* Halo de neón: la misma imagen desenfocada y sumada encima. Hace que los neones
          brillen como en una captura con bloom y disimula los dientes de sierra del render. */}
      <AbsoluteFill style={{ mixBlendMode: "screen", opacity: 0.32 }}>
        <Video
          shot={shot}
          style={{
            transform,
            transformOrigin: origin,
            filter: "blur(9px) brightness(1.1) saturate(1.3)"
          }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

function ShotView({ shot, layout }: { shot: Shot; layout: Layout }) {
  const duration = sec(shot.to) - sec(shot.from);
  if (layout === "cinematic" || shot.frame === "full") {
    return (
      <AbsoluteFill>
        <Clip shot={shot} duration={duration} />
      </AbsoluteFill>
    );
  }
  // Ventana 16:9 con el mismo plano, desenfocado y oscuro, llenando las franjas.
  return (
    <AbsoluteFill>
      <AbsoluteFill>
        <Clip shot={shot} duration={duration} blur />
      </AbsoluteFill>
      <div
        style={{
          position: "absolute",
          left: 0,
          top: FEED.windowTop,
          width: FEED.width,
          height: FEED.windowHeight,
          overflow: "hidden",
          boxShadow: `0 0 0 2px ${color.cyan}55, 0 0 60px ${color.magenta}40`
        }}
      >
        <Clip shot={shot} duration={duration} />
      </div>
      {/* Filete neón: cian arriba, magenta abajo, como los paneles del juego. */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: FEED.windowTop - 2,
          width: FEED.width,
          height: 2,
          background: color.cyan
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          top: FEED.windowTop + FEED.windowHeight,
          width: FEED.width,
          height: 2,
          background: color.magenta
        }}
      />
    </AbsoluteFill>
  );
}

/** Golpe del disparo: un fogonazo y un temblor corto sobre todo el cuadro. */
export function useShotKick() {
  const frame = useCurrentFrame();
  const since = frame - sec(SHOT);
  if (since < 0 || since > 10) return { flash: 0, shake: 0 };
  return {
    flash: interpolate(since, [0, 1, 5], [0.85, 0.5, 0], { extrapolateRight: "clamp" }),
    shake:
      interpolate(since, [0, 10], [14, 0], { extrapolateRight: "clamp" }) *
      (since % 2 === 0 ? 1 : -1)
  };
}

export function Footage({ layout }: { layout: Layout }) {
  return (
    <>
      {SHOTS.map((shot) => (
        <Sequence
          key={shot.clip}
          from={sec(shot.from)}
          durationInFrames={sec(shot.to) - sec(shot.from)}
          premountFor={30}
        >
          <ShotView shot={shot} layout={layout} />
        </Sequence>
      ))}
    </>
  );
}
