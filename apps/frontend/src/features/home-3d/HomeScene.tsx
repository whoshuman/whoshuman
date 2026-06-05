import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { Canvas } from "@react-three/fiber";

import HomeCameraRig from "./HomeCameraRig";
import HomeCity from "./HomeCity";
import HomeCityTraffic from "./HomeCityTraffic";
import HomeGrid from "./HomeGrid";
import HomeSun from "./HomeSun";
import { getCssColor } from "./homeSceneUtils";
import type { HomeSceneProps } from "./homeSceneTypes";

// Orquesta la escena 3D de la home. La imagen del cielo vive en Home.tsx como capa HTML,
// y este canvas dibuja encima los elementos con profundidad: sol, ciudad, trafico y grid.
function HomeScene({ isZoomed }: HomeSceneProps) {
  // Los colores salen de los tokens CSS para mantener la escena alineada con el design system.
  const colorSurface = getCssColor("--color-surface");
  const colorNeonCyan = getCssColor("--color-neon-cyan");
  const colorNeonMagenta = getCssColor("--color-neon-magenta");
  const colorSunOrange = getCssColor("--color-sun-orange");
  const colorSuccess = getCssColor("--color-success");

  return (
    <div className="absolute inset-0">
      {/* La camara inicial esta lejos del horizonte para que el zoom tenga recorrido visual. */}
      <Canvas camera={{ position: [0, -18, 56], rotation: [-0.22, 0, 0], fov: 58 }}>
        <HomeCameraRig isZoomed={isZoomed} />

        {/* Capas principales del paisaje retrowave. */}
        <HomeSun color={colorNeonMagenta} />
        <HomeCity
          colorBase={colorSurface}
          colorCyan={colorNeonCyan}
          colorGreen={colorSuccess}
          colorMagenta={colorNeonMagenta}
          colorOrange={colorSunOrange}
        />
        <HomeCityTraffic
          colorCyan={colorNeonCyan}
          colorGreen={colorSuccess}
          colorMagenta={colorNeonMagenta}
          colorOrange={colorSunOrange}
        />
        <HomeGrid colorMain={colorNeonCyan} colorSecondary={colorNeonMagenta} />

        {/* Bloom hace que los materiales basicos neon respiren sin depender de luces reales. */}
        <EffectComposer>
          <Bloom intensity={1.2} luminanceThreshold={0.15} luminanceSmoothing={0.18} mipmapBlur />
        </EffectComposer>
      </Canvas>
    </div>
  );
}

export default HomeScene;
