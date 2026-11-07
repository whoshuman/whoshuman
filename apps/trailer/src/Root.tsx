import { Composition } from "remotion";

import { CINEMATIC, FEED } from "./theme";
import { END, FPS, sec } from "./timeline";
import { Trailer, type TrailerProps } from "./Trailer";

// Dos cortes del mismo montaje:
// - TrailerFeed: 4:5 para publicar en LinkedIn, con textos arriba y abajo.
// - TrailerCinematic: 16:9 en crudo, solo imagen, música y logo.
export function RemotionRoot() {
  return (
    <>
      <Composition
        id="TrailerFeed"
        component={Trailer}
        width={FEED.width}
        height={FEED.height}
        fps={FPS}
        durationInFrames={sec(END)}
        defaultProps={{ layout: "feed", demoUrl: null } satisfies TrailerProps}
      />
      <Composition
        id="TrailerCinematic"
        component={Trailer}
        width={CINEMATIC.width}
        height={CINEMATIC.height}
        fps={FPS}
        durationInFrames={sec(END)}
        defaultProps={{ layout: "cinematic", demoUrl: null } satisfies TrailerProps}
      />
    </>
  );
}
