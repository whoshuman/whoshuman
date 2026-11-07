import { AbsoluteFill, interpolate, Sequence, useCurrentFrame } from "remotion";

import { barB, CAMPUS, CUT, END, HIT, PRE, sec, TEAM } from "../timeline";
import { body, color, display, type Layout } from "../theme";
import { Logo, NeonLogo } from "./Logo";
import { useExit, Words } from "./Text";

const kicker = {
  fontFamily: body,
  fontWeight: 700,
  letterSpacing: "0.34em",
  textTransform: "uppercase" as const,
  color: color.cyan
};

/** Apertura: el nombre se enciende sobre negro con el sonido del botón JUGAR, y al acabar
 *  arranca la música con el primer plano. */
function ColdOpen({ layout }: { layout: Layout }) {
  const frame = useCurrentFrame();
  const duration = sec(PRE);
  return (
    <AbsoluteFill
      style={{
        background: color.bg,
        alignItems: "center",
        justifyContent: "center",
        opacity: interpolate(frame, [duration - 5, duration], [1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp"
        })
      }}
    >
      <Sequence from={sec(0.34)}>
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
          <NeonLogo size={layout === "feed" ? 108 : 124} />
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
}

/** El título, justo en el corte a la parte fuerte de la música. */
function TitleCard({ layout }: { layout: Layout }) {
  const duration = sec(barB(2)) - sec(CUT);
  const opacity = useExit(duration, 5);
  const feed = layout === "feed";
  return (
    <AbsoluteFill style={{ opacity, alignItems: "center", justifyContent: "center" }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at center, ${color.bg}cc 0%, ${color.bg}55 45%, transparent 75%)`
        }}
      />
      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 34
        }}
      >
        {feed && (
          <Words
            text="// Sistema cazador · v.42"
            style={{ ...kicker, fontSize: 30 }}
            glitch={false}
            stagger={1}
          />
        )}
        <Logo size={feed ? 150 : 170} withIcon={false} />
        {feed && (
          <Words
            text="Multijugador en el navegador"
            delay={10}
            stagger={2}
            glitch={false}
            style={{ fontFamily: body, fontWeight: 600, fontSize: 40, color: color.muted }}
          />
        )}
      </div>
    </AbsoluteFill>
  );
}

/** Cierre sobre el golpe final: logo y, en la versión de publicación, dónde jugar y créditos. */
function EndCard({ layout, demoUrl }: { layout: Layout; demoUrl: string | null }) {
  const frame = useCurrentFrame();
  const feed = layout === "feed";
  // Se oscurece deprisa: el neón luce más cuanto más negro hay detrás.
  const dim = interpolate(frame, [0, 8], [0.3, 0.82], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: feed ? "flex-start" : "center" }}>
      <AbsoluteFill style={{ background: color.bg, opacity: dim }} />
      <div
        style={{
          // Posicionado: si no, la capa oscura (absoluta) se pinta encima de lo que no lleva transform.
          position: "relative",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          marginTop: feed ? 110 : 0,
          gap: feed ? 40 : 0
        }}
      >
        <NeonLogo size={feed ? 132 : 150} />
        {feed && (
          <>
            <Words
              text="¿Sabrás quién es humano?"
              delay={30}
              stagger={2}
              style={{
                fontFamily: display,
                fontWeight: 800,
                fontSize: 40,
                color: color.text,
                textTransform: "uppercase"
              }}
            />
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 8,
                padding: "18px 38px",
                border: `2px solid ${color.magenta}`,
                background: `${color.magenta}1f`,
                boxShadow: `0 0 34px ${color.magenta}55`,
                opacity: interpolate(frame, [38, 46], [0, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp"
                })
              }}
            >
              <span style={{ ...kicker, fontSize: 26, color: color.magenta }}>
                Juega gratis en el navegador
              </span>
              <span
                style={{ fontFamily: display, fontWeight: 800, fontSize: 36, color: color.text }}
              >
                {demoUrl ?? "Enlace en el post"}
              </span>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 14,
                marginTop: 10
              }}
            >
              <Words
                text={`Un proyecto de ${CAMPUS}`}
                delay={52}
                stagger={2}
                glitch={false}
                style={{ ...kicker, fontSize: 26 }}
              />
              {TEAM.map((member, index) => (
                <div
                  key={member.name}
                  style={{
                    display: "flex",
                    gap: 16,
                    alignItems: "baseline",
                    opacity: interpolate(frame, [58 + index * 4, 66 + index * 4], [0, 1], {
                      extrapolateLeft: "clamp",
                      extrapolateRight: "clamp"
                    })
                  }}
                >
                  <span
                    style={{
                      fontFamily: display,
                      fontWeight: 700,
                      fontSize: 31,
                      color: color.text
                    }}
                  >
                    {member.name}
                  </span>
                  <span
                    style={{ fontFamily: body, fontWeight: 600, fontSize: 29, color: color.muted }}
                  >
                    {member.role}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </AbsoluteFill>
  );
}

export function Cards({ layout, demoUrl }: { layout: Layout; demoUrl: string | null }) {
  return (
    <>
      <Sequence durationInFrames={sec(PRE)}>
        <ColdOpen layout={layout} />
      </Sequence>
      <Sequence from={sec(CUT)} durationInFrames={sec(barB(2)) - sec(CUT)}>
        <TitleCard layout={layout} />
      </Sequence>
      <Sequence from={sec(HIT)} durationInFrames={sec(END) - sec(HIT)}>
        <EndCard layout={layout} demoUrl={demoUrl} />
      </Sequence>
    </>
  );
}
