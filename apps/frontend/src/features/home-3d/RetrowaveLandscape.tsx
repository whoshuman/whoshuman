import { AdaptiveDpr, PerformanceMonitor } from "@react-three/drei";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { Suspense } from "react";

import HomeCityModel from "./HomeCityModel";
import HomeCityTraffic from "./HomeCityTraffic";
import HomeGrid from "./HomeGrid";
import HomeMoon from "./HomeMoon";
import HomeMountains from "./HomeMountains";
import HomeSun from "./HomeSun";
import { getCssColor } from "./homeSceneUtils";

// Contenido 3D del paisaje retrowave (sol, ciudad, trafico, grid + bloom).
// Se separa del Canvas para reutilizarlo: la home lo monta con camara animada
// y el fondo global (SceneBackground) lo monta con camara estatica.
function RetrowaveLandscape() {
  // Los colores salen de los tokens CSS para mantener la escena alineada con el design system.
  const colorBg = getCssColor("--color-bg");
  const colorSurface = getCssColor("--color-surface");
  const colorNeonCyan = getCssColor("--color-neon-cyan");
  const colorNeonMagenta = getCssColor("--color-neon-magenta");
  const colorNeonViolet = getCssColor("--color-neon-violet");
  const colorSunOrange = getCssColor("--color-sun-orange");
  const colorSuccess = getCssColor("--color-success");

  return (
    <>
      {/* Rendimiento adaptativo: PerformanceMonitor vigila los fps y AdaptiveDpr baja la
          resolucion solo cuando la GPU sufre (la ciudad GLB es pesada, ~27M vertices).
          En reposo y en equipos potentes no cambia nada: calidad completa. */}
      <PerformanceMonitor />
      <AdaptiveDpr pixelated={false} />

      <HomeSun color={colorNeonMagenta} />
      {/* Luna en el lado opuesto al sol: visible al darse la vuelta la camara (sobre el proyecto). */}
      <HomeMoon color={colorNeonViolet} />
      {/* Anillo de montañas alrededor de toda la grid: 4 franjas (N/S/E/O) que rodean el
          perimetro, asi se ven montañas se mire hacia donde se mire (incluida la luna). */}
      <HomeMountains color={colorNeonCyan} fillColor={colorSurface} position={[0, -50, -850]} />
      <HomeMountains
        color={colorNeonCyan}
        fillColor={colorSurface}
        position={[0, -50, 850]}
        rotationY={Math.PI}
      />
      <HomeMountains
        color={colorNeonCyan}
        fillColor={colorSurface}
        position={[-850, -50, 0]}
        rotationY={Math.PI / 2}
      />
      <HomeMountains
        color={colorNeonCyan}
        fillColor={colorSurface}
        position={[850, -50, 0]}
        rotationY={-Math.PI / 2}
      />
      {/* Luces solo para el GLB (PBR): sin ellas la ciudad sale negra y solo brillan
          los neones emisivos. El sol/grid/montañas usan meshBasicMaterial, no les afecta. */}
      <ambientLight intensity={1.4} />
      <directionalLight position={[0, 80, 30]} intensity={2.6} color={colorNeonCyan} />
      <directionalLight position={[0, 40, -60]} intensity={1.4} color={colorNeonMagenta} />

      {/* Suspense hace de red de seguridad mientras el GLB de la ciudad descarga. */}
      <Suspense fallback={null}>
        <HomeCityModel />
      </Suspense>
      <HomeCityTraffic
        colorCyan={colorNeonCyan}
        colorGreen={colorSuccess}
        colorMagenta={colorNeonMagenta}
        colorOrange={colorSunOrange}
      />
      <HomeGrid colorMain={colorNeonCyan} colorSecondary={colorNeonMagenta} colorFloor={colorBg} />

      {/* Bloom hace que los materiales basicos neon respiren sin depender de luces reales. */}
      <EffectComposer>
        <Bloom intensity={1.2} luminanceThreshold={0.15} luminanceSmoothing={0.18} mipmapBlur />
      </EffectComposer>
    </>
  );
}

export default RetrowaveLandscape;
