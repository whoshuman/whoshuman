import { useGLTF } from "@react-three/drei";

// DeLorean Time Machine (GLB low-poly) sobre la carretera, mirando a la luna (+Z).
// El modelo viene descentrado y con el eje largo en X; lo recolocamos en un grupo.
const DELOREAN_URL = "/models/delorean.glb";

// Offsets derivados del bbox del modelo (centro X/Z y base Y) para apoyarlo en la carretera.
const CENTER = [0.7, -1.28, 12.2] as const;

function HomeDeLorean() {
  const { scene } = useGLTF(DELOREAN_URL);

  return (
    // Grupo exterior: lo coloca en la carretera, lo orienta hacia la luna y lo escala.
    <group position={[0, -49.5, 150]} rotation={[0, Math.PI / 2, 0]} scale={2.4}>
      <primitive object={scene} position={CENTER} />
    </group>
  );
}

useGLTF.preload(DELOREAN_URL);

export default HomeDeLorean;
