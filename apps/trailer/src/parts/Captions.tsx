import { AbsoluteFill, Sequence } from "remotion";

import { CAPTIONS, sec, TECH, type Caption } from "../timeline";
import { body, color, display, FEED } from "../theme";
import { useExit, Words } from "./Text";

const kickerStyle = {
  fontFamily: body,
  fontWeight: 700,
  fontSize: 30,
  letterSpacing: "0.32em",
  textTransform: "uppercase" as const,
  color: color.cyan
};

function mainStyle(accent: Caption["accent"]) {
  return {
    fontFamily: display,
    fontWeight: 800,
    fontSize: 62,
    lineHeight: 1.12,
    textTransform: "uppercase" as const,
    color: accent === "magenta" ? color.magenta : color.text,
    textShadow: `0 0 22px ${accent === "magenta" ? color.magenta : color.violet}aa`
  };
}

const subStyle = {
  fontFamily: body,
  fontWeight: 600,
  fontSize: 40,
  lineHeight: 1.2,
  color: color.muted
};

function CaptionView({ caption }: { caption: Caption }) {
  const duration = sec(caption.to) - sec(caption.from);
  const opacity = useExit(duration);

  if (caption.place === "overlay") {
    return (
      <AbsoluteFill style={{ opacity }}>
        {/* Sombra para que el texto se lea sobre un plano claro. */}
        <AbsoluteFill
          style={{
            background: `linear-gradient(0deg, ${color.bg}ee 0%, ${color.bg}88 30%, transparent 55%)`
          }}
        />
        <div
          style={{ position: "absolute", left: 70, right: 70, bottom: 190, textAlign: "center" }}
        >
          <Words text={caption.text} style={{ ...mainStyle(caption.accent), fontSize: 70 }} />
        </div>
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill style={{ opacity }}>
      {/* Franja de arriba: el titular, apoyado sobre la ventana. */}
      <div
        style={{
          position: "absolute",
          left: 70,
          right: 70,
          bottom: FEED.height - FEED.windowTop + 44,
          display: "flex",
          flexDirection: "column",
          gap: 18
        }}
      >
        {caption.kicker && (
          <Words text={caption.kicker} style={kickerStyle} glitch={false} stagger={2} />
        )}
        <Words
          text={caption.text}
          style={mainStyle(caption.accent)}
          delay={caption.kicker ? 4 : 0}
        />
      </div>
      {/* Franja de abajo: la explicación. */}
      {caption.sub && (
        <div
          style={{
            position: "absolute",
            left: 70,
            right: 70,
            top: FEED.windowTop + FEED.windowHeight + 48
          }}
        >
          <Words text={caption.sub} style={subStyle} delay={8} stagger={2} glitch={false} />
        </div>
      )}
    </AbsoluteFill>
  );
}

function TechCard() {
  const duration = sec(TECH.to) - sec(TECH.from);
  const opacity = useExit(duration, 4);
  return (
    <AbsoluteFill style={{ opacity }}>
      <div
        style={{
          position: "absolute",
          left: 70,
          right: 70,
          bottom: FEED.height - FEED.windowTop + 44,
          display: "flex",
          flexDirection: "column",
          gap: 18
        }}
      >
        <Words text={TECH.kicker} style={kickerStyle} glitch={false} stagger={2} />
        <Words text={TECH.text} style={mainStyle(undefined)} delay={4} />
      </div>
      <div
        style={{
          position: "absolute",
          left: 60,
          right: 60,
          top: FEED.windowTop + FEED.windowHeight + 44,
          display: "flex",
          flexWrap: "wrap",
          gap: 14
        }}
      >
        {TECH.chips.map((chip, index) => (
          <Words
            key={chip}
            text={chip}
            delay={8 + index * 3}
            stagger={0}
            glitch={false}
            style={{
              fontFamily: body,
              fontWeight: 700,
              fontSize: 32,
              letterSpacing: "0.06em",
              color: index < 2 ? color.bg : color.cyan,
              background: index < 2 ? color.cyan : `${color.cyan}14`,
              border: `2px solid ${color.cyan}99`,
              padding: "8px 18px"
            }}
          />
        ))}
      </div>
    </AbsoluteFill>
  );
}

/** Los textos de la versión de publicación. */
export function Captions() {
  return (
    <>
      {CAPTIONS.map((caption) => (
        <Sequence
          key={caption.text}
          from={sec(caption.from)}
          durationInFrames={sec(caption.to) - sec(caption.from)}
        >
          <CaptionView caption={caption} />
        </Sequence>
      ))}
      <Sequence from={sec(TECH.from)} durationInFrames={sec(TECH.to) - sec(TECH.from)}>
        <TechCard />
      </Sequence>
    </>
  );
}
