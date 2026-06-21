import { Bloom, EffectComposer } from "@react-three/postprocessing";

import HomeCity from "./HomeCity";
import HomeCityTraffic from "./HomeCityTraffic";
import HomeGrid from "./HomeGrid";
import HomeSun from "./HomeSun";
import { getCssColor } from "./homeSceneUtils";

// Contenido 3D del paisaje retrowave (sol, ciudad, trafico, grid + bloom).
// Se separa del Canvas para reutilizarlo: la home lo monta con camara animada
// y el fondo global (SceneBackground) lo monta con camara estatica.
function RetrowaveLandscape() {
  // Los colores salen de los tokens CSS para mantener la escena alineada con el design system.
  const colorSurface = getCssColor("--color-surface");
  const colorNeonCyan = getCssColor("--color-neon-cyan");
  const colorNeonMagenta = getCssColor("--color-neon-magenta");
  const colorSunOrange = getCssColor("--color-sun-orange");
  const colorSuccess = getCssColor("--color-success");

  return (
    <>
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
    </>
  );
}

export default RetrowaveLandscape;
