import type { CSSProperties } from "react";
import { interpolate, random, spring, useCurrentFrame } from "remotion";

import { color } from "../theme";

/** Palabra a palabra, subiendo y enfocándose, con un tirón de aberración cromática al entrar. */
export function Words({
  text,
  style,
  delay = 0,
  stagger = 3,
  glitch = true
}: {
  text: string;
  style?: CSSProperties;
  delay?: number;
  stagger?: number;
  glitch?: boolean;
}) {
  const frame = useCurrentFrame();
  return (
    <span style={style}>
      {text.split(" ").map((word, index) => {
        const local = frame - delay - index * stagger;
        const progress = spring({
          frame: local,
          fps: 30,
          config: { damping: 200 },
          durationInFrames: 14
        });
        const split = glitch
          ? interpolate(local, [0, 10], [7, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp"
            }) * (local < 5 ? random(`${text}-${index}-${local}`) * 2 - 0.4 : 1)
          : 0;
        return (
          <span
            key={`${word}-${index}`}
            style={{
              display: "inline-block",
              whiteSpace: "pre",
              opacity: progress,
              transform: `translateY(${(1 - progress) * 34}px)`,
              filter: `blur(${(1 - progress) * 8}px)`,
              textShadow:
                split > 0.1
                  ? `${split}px 0 ${color.magenta}, ${-split}px 0 ${color.cyan}`
                  : style?.textShadow
            }}
          >
            {word}
            {index < text.split(" ").length - 1 ? " " : ""}
          </span>
        );
      })}
    </span>
  );
}

/** Opacidad de salida: se apaga en los últimos fotogramas del tramo. */
export function useExit(duration: number, frames = 6) {
  const frame = useCurrentFrame();
  return interpolate(frame, [duration - frames, duration], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp"
  });
}
