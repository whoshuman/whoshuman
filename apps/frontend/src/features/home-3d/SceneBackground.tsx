import { Canvas } from "@react-three/fiber";

import skyHome3d from "../../assets/sky-home-3d.png";
import RetrowaveLandscape from "./RetrowaveLandscape";

// Fondo 3D unificado para las pantallas que no son la home (login, register, lobby, 404).
// Reutiliza el paisaje retrowave con camara estatica (sin el zoom de la home).
// Se monta detras del contenido en AppLayout y no captura clicks.
function SceneBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0">
      {/* Cielo 2D como capa HTML para no cargar una textura 3D innecesaria. */}
      <img
        src={skyHome3d}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover object-top opacity-80"
      />
      {/* Oscurece el cielo y ayuda a integrar el fondo con el grid y la ciudad. */}
      <div className="absolute inset-0 bg-linear-to-b from-bg/40 via-bg/55 to-bg/85" />

      {/* Misma vista que la home en reposo, pero fija: sin rig de camara. */}
      <Canvas dpr={[1, 1.5]} camera={{ position: [0, -18, 56], rotation: [-0.22, 0, 0], fov: 58 }}>
        <RetrowaveLandscape />
      </Canvas>
    </div>
  );
}

export default SceneBackground;
