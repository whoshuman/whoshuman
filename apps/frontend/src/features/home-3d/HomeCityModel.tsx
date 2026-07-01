import { useGLTF } from "@react-three/drei";

// Ruta servida desde public/: public/models/alfa-city.glb -> "/models/alfa-city.glb".
const CITY_MODEL_URL = "/models/alfa-city.glb";

// Ciudad de fondo cargada desde un GLB. Sustituye a la ciudad procedural (HomeCity).
// useGLTF suspende mientras descarga, por eso el padre la envuelve en <Suspense>.
function HomeCityModel() {
  const { scene } = useGLTF(CITY_MODEL_URL);

  return (
    // scale/position/rotation se ajustan a ojo para encajar la ciudad tras el paisaje.
    <primitive object={scene} position={[0, -48, -50]} scale={1.5} rotation={[0, 0, 0]} />
  );
}

// Empieza la descarga antes de montar el componente para que el primer render sea mas fluido.
useGLTF.preload(CITY_MODEL_URL);

export default HomeCityModel;
