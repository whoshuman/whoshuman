import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import type { Group, PerspectiveCamera } from "three";

// DeLorean Time Machine (GLB low-poly) sobre la carretera, mirando a la luna (+Z).
// El modelo viene descentrado y con el eje largo en X; lo recolocamos en un grupo.
const DELOREAN_URL = "/models/delorean.glb";

// Offsets derivados del bbox del modelo (centro X/Z y base Y) para apoyarlo en la carretera.
// Compensados por la escala para que el coche siga apoyado y centrado igual al agrandarlo.
const CENTER = [0.4, -0.731, 6.97] as const;

// Fraccion del ancho realmente visible (calculado cada frame segun FOV/aspecto reales de
// la camara) que puede usar como maximo el carril. Deliberadamente conservadora: el coche
// debe leerse como "centrado con un ligero balanceo lateral", no como si recorriera todo
// el ancho de pantalla.
const MAX_VISIBLE_FRACTION = 0.18;

type HomeDeLoreanProps = {
  // X de destino (carril): el coche se desliza bajo la tarjeta del equipo seleccionada.
  targetX?: number;
};

function HomeDeLorean({ targetX = 0 }: HomeDeLoreanProps) {
  const { scene } = useGLTF(DELOREAN_URL);
  const groupRef = useRef<Group>(null);
  const { camera } = useThree();

  // Desliza el coche suavemente hacia el carril objetivo (x) cada frame. Ease bajo a
  // proposito: un cambio de carril de lado a lado debe sentirse como un giro pausado,
  // no un salto. El objetivo se recorta al ancho visible real de la camara en cada
  // momento (el FOV horizontal se estrecha mucho en movil, pantalla vertical), asi el
  // coche nunca sale de cuadro ni queda pegado a un borde en ningun tamaño de pantalla.
  useFrame(() => {
    const group = groupRef.current;
    if (!group) return;

    const perspectiveCamera = camera as PerspectiveCamera;
    const distance = camera.position.distanceTo(group.position);
    const verticalHalfFovRad = (perspectiveCamera.fov * Math.PI) / 360;
    const visibleHalfWidth = distance * Math.tan(verticalHalfFovRad) * perspectiveCamera.aspect;
    const maxOffset = visibleHalfWidth * MAX_VISIBLE_FRACTION;
    const clampedTarget = Math.max(-maxOffset, Math.min(maxOffset, targetX));

    group.position.x += (clampedTarget - group.position.x) * 0.045;
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
