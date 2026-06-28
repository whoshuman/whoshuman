import { useMemo } from "react";
import { MeshStandardMaterial } from "three";

// DeLorean estilizado (cuña baja de acero, estilo Back to the Future / synthwave) construido
// con primitivas. Va sobre la carretera mirando a la luna (+Z). Detallado pero ligero:
// los materiales se comparten (una sola instancia cada uno) para no gastar recursos de mas.

// Rueda: neumatico oscuro + llanta neon. El eje va en X, por eso el cilindro se gira en Z.
function Wheel({
  position,
  tire,
  hub
}: {
  position: [number, number, number];
  tire: MeshStandardMaterial;
  hub: MeshStandardMaterial;
}) {
  return (
    <group position={position} rotation={[0, 0, Math.PI / 2]}>
      <mesh material={tire}>
        <cylinderGeometry args={[1.7, 1.7, 1.6, 20]} />
      </mesh>
      {/* Llanta neon (disco brillante en la cara exterior). */}
      <mesh position={[0, 0.82, 0]}>
        <cylinderGeometry args={[1.05, 1.05, 0.12, 20]} />
        <meshBasicMaterial color="#24f5ff" />
      </mesh>
      <mesh position={[0, 0.83, 0]} material={hub}>
        <cylinderGeometry args={[0.4, 0.4, 0.16, 12]} />
      </mesh>
    </group>
  );
}

function HomeDeLorean() {
  // Materiales compartidos (una instancia cada uno): acero de carroceria, cristal y trim.
  const steel = useMemo(
    () => new MeshStandardMaterial({ color: "#aeb6c4", metalness: 0.92, roughness: 0.32 }),
    []
  );
  const glass = useMemo(
    () => new MeshStandardMaterial({ color: "#08131f", metalness: 0.5, roughness: 0.15 }),
    []
  );
  const trim = useMemo(
    () => new MeshStandardMaterial({ color: "#23262e", metalness: 0.6, roughness: 0.5 }),
    []
  );
  const tire = useMemo(
    () => new MeshStandardMaterial({ color: "#0d0d12", metalness: 0.3, roughness: 0.8 }),
    []
  );
  const hub = useMemo(() => new MeshStandardMaterial({ color: "#fff7ff" }), []);

  return (
    // Sobre la carretera (y -49.5), algo adelante para verse al girar; mira a la luna (+Z).
    <group position={[0, -49.5, 150]}>
      {/* Bajos neon: plano emisivo bajo el coche que el bloom convierte en resplandor. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.25, 0]}>
        <planeGeometry args={[11, 22]} />
        <meshBasicMaterial color="#ff2bd6" transparent opacity={0.4} />
      </mesh>

      {/* Cuerpo inferior (chasis ancho y plano). */}
      <mesh position={[0, 3.1, 0]} material={steel}>
        <boxGeometry args={[8.6, 2.6, 19]} />
      </mesh>

      {/* Morro mas bajo (cuña delantera). */}
      <mesh position={[0, 2.4, 8.4]} material={steel}>
        <boxGeometry args={[8.2, 1.7, 3.4]} />
      </mesh>
      {/* Cola con piloto trasero. */}
      <mesh position={[0, 3.4, -9.2]} material={steel}>
        <boxGeometry args={[8.4, 2.2, 1.4]} />
      </mesh>
      <mesh position={[0, 3.7, -9.95]}>
        <boxGeometry args={[7, 0.7, 0.3]} />
        <meshBasicMaterial color="#ff3b6b" />
      </mesh>

      {/* Cabina / greenhouse. */}
      <mesh position={[0, 5.3, -1]} material={steel}>
        <boxGeometry args={[7.4, 2.3, 8.5]} />
      </mesh>
      {/* Cristales oscuros (laterales + techo). */}
      <mesh position={[0, 5.45, -1]} material={glass}>
        <boxGeometry args={[7.5, 1.7, 7]} />
      </mesh>
      {/* Parabrisas inclinado. */}
      <mesh position={[0, 5.2, 3.2]} rotation={[-0.6, 0, 0]} material={glass}>
        <boxGeometry args={[7, 0.15, 3.4]} />
      </mesh>

      {/* Faldones laterales (strakes) bajos. */}
      <mesh position={[4.35, 2.4, 0]} material={trim}>
        <boxGeometry args={[0.3, 1.4, 16]} />
      </mesh>
      <mesh position={[-4.35, 2.4, 0]} material={trim}>
        <boxGeometry args={[0.3, 1.4, 16]} />
      </mesh>

      {/* Faros delanteros (miran a la luna). */}
      <mesh position={[2.6, 2.8, 10.05]}>
        <boxGeometry args={[1.8, 0.7, 0.25]} />
        <meshBasicMaterial color="#fff7e0" />
      </mesh>
      <mesh position={[-2.6, 2.8, 10.05]}>
        <boxGeometry args={[1.8, 0.7, 0.25]} />
        <meshBasicMaterial color="#fff7e0" />
      </mesh>

      {/* Ruedas. */}
      <Wheel position={[4.3, 1.7, 6]} tire={tire} hub={hub} />
      <Wheel position={[-4.3, 1.7, 6]} tire={tire} hub={hub} />
      <Wheel position={[4.3, 1.7, -6]} tire={tire} hub={hub} />
      <Wheel position={[-4.3, 1.7, -6]} tire={tire} hub={hub} />
    </group>
  );
}

export default HomeDeLorean;
