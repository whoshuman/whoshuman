import { Canvas } from "@react-three/fiber";

import HomeCameraRig from "./HomeCameraRig";
import RetrowaveLandscape from "./RetrowaveLandscape";
import type { HomeSceneProps } from "./homeSceneTypes";

// Orquesta la escena 3D de la home. La imagen del cielo vive en Home.tsx como capa HTML,
// y este canvas dibuja encima el paisaje con profundidad, con camara animada por el zoom.
function HomeScene({ isZoomed, lookRight, lookBack, carFocus }: HomeSceneProps) {
  return (
    <div className="absolute inset-0">
      {/* La camara inicial esta lejos del horizonte para que el zoom tenga recorrido visual. */}
      <Canvas dpr={[1, 1.5]} camera={{ position: [0, -18, 56], rotation: [-0.22, 0, 0], fov: 58 }}>
        <HomeCameraRig
          isZoomed={isZoomed}
          lookRight={lookRight}
          lookBack={lookBack}
          carFocus={carFocus}
        />
        {/* La home es la unica vista que puede girar a ver la carretera/coche/luna. */}
        <RetrowaveLandscape showRoadScene />
      </Canvas>
    </div>
  );
}

export default HomeScene;
