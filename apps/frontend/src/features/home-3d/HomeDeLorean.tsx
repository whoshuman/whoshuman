import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import type { Group } from "three";

// DeLorean Time Machine (GLB low-poly) sobre la carretera, mirando a la luna (+Z).
// El modelo viene descentrado y con el eje largo en X; lo recolocamos en un grupo.
const DELOREAN_URL = "/models/delorean.glb";

// Offsets derivados del bbox del modelo (centro X/Z y base Y) para apoyarlo en la carretera.
// Compensados por la escala para que el coche siga apoyado y centrado igual al agrandarlo.
const CENTER = [0.4, -0.731, 6.97] as const;

type HomeDeLoreanProps = {
  // X de destino (carril): el coche se desliza bajo la tarjeta del equipo seleccionada.
  targetX?: number;
};

function HomeDeLorean({ targetX = 0 }: HomeDeLoreanProps) {
  const { scene } = useGLTF(DELOREAN_URL);
  const groupRef = useRef<Group>(null);

  // Desliza el coche suavemente hacia el carril objetivo (x) cada frame.
  useFrame(() => {
    const group = groupRef.current;
    if (group) {
      group.position.x += (targetX - group.position.x) * 0.12;
    }
  });

  return (
    // Grupo exterior: lo coloca en la carretera, lo orienta hacia la luna y lo escala.
    // Cerca de la camara cenital para verse en el primer plano, bajo las fichas del equipo.
    <group ref={groupRef} position={[0, -49.5, 138]} rotation={[0, Math.PI / 2, 0]} scale={4.2}>
      <primitive object={scene} position={CENTER} />
    </group>
  );
}

useGLTF.preload(DELOREAN_URL);

export default HomeDeLorean;
