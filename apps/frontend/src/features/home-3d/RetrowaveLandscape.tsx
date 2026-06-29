import { AdaptiveDpr, PerformanceMonitor } from "@react-three/drei";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { Suspense } from "react";

import HomeCityModel from "./HomeCityModel";
import HomeCityTraffic from "./HomeCityTraffic";
import HomeDeLorean from "./HomeDeLorean";
import HomeGrid from "./HomeGrid";
import HomeMoon from "./HomeMoon";
import HomeRoad from "./HomeRoad";
import HomeRoadSide from "./HomeRoadSide";
import HomeMountains from "./HomeMountains";
import HomeSun from "./HomeSun";
import { getCssColor } from "./homeSceneUtils";

type RetrowaveLandscapeProps = {
  // Escena del lado de la luna (carretera + DeLorean + montañas laterales + luna). Solo es
  // visible cuando la camara gira (la home). En los fondos estaticos (SceneBackground) nunca
  // se ve, asi que se omite para no cargar el GLB del coche ni animarla en esas paginas.
  showRoadScene?: boolean;
  // Carril del coche: x bajo la tarjeta del equipo seleccionada.
  carX?: number;
};

// Contenido 3D del paisaje retrowave (sol, ciudad, trafico, grid + bloom).
// Se separa del Canvas para reutilizarlo: la home lo monta con camara animada
// y el fondo global (SceneBackground) lo monta con camara estatica.
function RetrowaveLandscape({ showRoadScene = false, carX = 0 }: RetrowaveLandscapeProps) {
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

      {/* Lado de la luna (carretera + DeLorean + montañas laterales + luna): solo en la home,
          donde la camara puede girar para verlo. En fondos estaticos se omite por completo. */}
      {showRoadScene && (
        <>
          <HomeMoon color={colorNeonViolet} />
          <HomeRoad />
          <HomeRoadSide />
          <Suspense fallback={null}>
            <HomeDeLorean targetX={carX} />
          </Suspense>
        </>
      )}
      {/* Anillo de montañas alrededor de toda la grid: 4 franjas (N/S/E/O) que rodean el
          perimetro, asi se ven montañas se mire hacia donde se mire (incluida la luna). */}
      <HomeMountains fillColor={colorSurface} position={[0, -50, -850]} />
      <HomeMountains fillColor={colorSurface} position={[0, -50, 850]} rotationY={Math.PI} />
      <HomeMountains fillColor={colorSurface} position={[-850, -50, 0]} rotationY={Math.PI / 2} />
      <HomeMountains fillColor={colorSurface} position={[850, -50, 0]} rotationY={-Math.PI / 2} />
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
      {/* La rejilla del mapa no se ve en "sobre el proyecto" (camara hacia la luna): se omite. */}
      {!showRoadScene && (
        <HomeGrid colorMain={colorNeonCyan} colorSecondary={colorNeonMagenta} colorFloor={colorBg} />
      )}

      {/* Bloom hace que los materiales basicos neon respiren sin depender de luces reales. */}
      <EffectComposer>
        <Bloom intensity={1.2} luminanceThreshold={0.15} luminanceSmoothing={0.18} mipmapBlur />
      </EffectComposer>
    </>
  );
}

export default RetrowaveLandscape;
