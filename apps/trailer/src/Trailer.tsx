import { AbsoluteFill, Audio, interpolate, Sequence, useCurrentFrame } from "remotion";

import music from "../../frontend/public/sounds/cold-fire-neozoic-main-version-37473-02-16.mp3";
import playSfx from "../../frontend/public/sounds/digital-ui-access-granted-alert-vadi-sound-2-2-00-01.mp3";
import orbSfx from "../../frontend/public/sounds/collect_Cell.mp3";
import shotSfx from "../../frontend/public/sounds/disparo_2.mp3";
import { Cards } from "./parts/Cards";
import { Captions } from "./parts/Captions";
import { Footage, useShotKick } from "./parts/Footage";
import { color, type Layout } from "./theme";
import { CUT, END, FPS, HIT, MUSIC_AT, MUSIC_FROM, ORB_GRAB, sec, SHOT } from "./timeline";

export type TrailerProps = {
  layout: Layout;
  /** URL de la demo para el cierre. Mientras no la haya, dice "Enlace en el post". */
  demoUrl: string | null;
};

/** Fogonazo blanco en los golpes de la música: el título y el logo final. */
function Flash({ at }: { at: number }) {
  const frame = useCurrentFrame() - sec(at);
  const opacity = interpolate(frame, [0, 2, 8], [0.9, 0.55, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp"
  });
  return (
    <AbsoluteFill
      style={{ background: color.text, opacity: frame < 0 ? 0 : opacity, mixBlendMode: "screen" }}
    />
  );
}

function Music() {
  // Una sola pista y desde el principio: entra con el sonido del botón JUGAR y se apaga con
  // el cierre. Sin fundido de entrada, que la canción ya empieza en silencio.
  const duration = sec(END) - sec(MUSIC_AT);
  return (
    <>
      <Sequence from={sec(MUSIC_AT)}>
        <Audio
          src={music}
          trimBefore={Math.round(MUSIC_FROM * FPS)}
          volume={(f) =>
            interpolate(f, [0, 2, duration - 55, duration], [0, 0.9, 0.9, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp"
            })
          }
        />
      </Sequence>
      {/* El sonido del botón JUGAR abre el tráiler. */}
      <Sequence from={sec(MUSIC_AT)} durationInFrames={FPS * 3}>
        <Audio src={playSfx} volume={0.95} />
      </Sequence>
      {/* Los efectos del juego: la captura no trae audio, así que se ponen aquí. */}
      <Sequence from={sec(ORB_GRAB) - 1} durationInFrames={FPS * 2}>
        <Audio src={orbSfx} volume={0.9} />
      </Sequence>
      <Sequence from={sec(SHOT) - 1} durationInFrames={FPS * 2}>
        <Audio src={shotSfx} volume={1} />
      </Sequence>
    </>
  );
}

export function Trailer({ layout, demoUrl }: TrailerProps) {
  const frame = useCurrentFrame();
  const { flash, shake } = useShotKick();
  const fadeOut = interpolate(frame, [sec(END) - 30, sec(END)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp"
  });
  const fadeIn = interpolate(frame, [0, 8], [1, 0], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: color.bg }}>
      <AbsoluteFill style={{ transform: `translate(${shake}px, ${shake * 0.4}px)` }}>
        <Footage layout={layout} />
      </AbsoluteFill>
      {/* Viñeta y líneas de barrido muy suaves: el mismo acabado CRT de la interfaz del juego. */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at center, transparent 55%, ${color.bg}b0 100%)`
        }}
      />
      <AbsoluteFill
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(0,0,0,0.13) 0px, rgba(0,0,0,0.13) 1px, transparent 1px, transparent 3px)"
        }}
      />
      {layout === "feed" && <Captions />}
      <Cards layout={layout} demoUrl={demoUrl} />
      <AbsoluteFill style={{ background: color.text, opacity: flash, mixBlendMode: "screen" }} />
      <Flash at={CUT} />
      <Flash at={HIT} />
      <AbsoluteFill style={{ background: "#000", opacity: Math.max(fadeIn, fadeOut) }} />
      <Music />
    </AbsoluteFill>
  );
}
