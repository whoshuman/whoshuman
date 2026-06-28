import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";

// Montañas/marcadores neon a ambos lados de la carretera que corren hacia la camara (tapiz) y
// se reciclan al fondo. Refuerzan la sensacion de avance sin tener que mover toda la grid:
// el suelo queda fijo y solo estos elementos laterales se desplazan.

const FLOOR_Y = -49.5;
// Cuantas filas a cada lado y cada cuanto (z). Mas juntas = mas marcas pasando = mas velocidad.
const ROWS = 16;
const SPACING = 64;
const RANGE = ROWS * SPACING;
// Desde donde arrancan (algo por delante del coche en z 150) y donde se reciclan (tras la camara).
const Z_NEAR = 150;
const RECYCLE_Z = 95;
// Separacion lateral respecto al centro (la carretera mide 40 de ancho).
const X_OFF = 34;
const SPEED = 150;

type Marker = { key: string; x: number; z: number; height: number; radius: number };

function buildMarkers(): Marker[] {
  const list: Marker[] = [];
  for (let i = 0; i < ROWS; i += 1) {
    const z = Z_NEAR + i * SPACING;
    for (const side of [-1, 1]) {
      // Altura/anchura variadas (deterministas) para que no parezcan clones.
      const height = 22 + ((i * 7 + (side > 0 ? 3 : 0)) % 4) * 11;
      list.push({
        key: `${i}-${side}`,
        x: side * (X_OFF + ((i + (side > 0 ? 1 : 0)) % 3) * 6),
        z,
        height,
        radius: height * 0.42
      });
    }
  }
  return list;
}

function HomeRoadSide() {
  const groupRef = useRef<Group>(null);
  const markers = useMemo(() => buildMarkers(), []);

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group) return;
    // Cada marcador avanza hacia la camara; al pasarla, vuelve al fondo manteniendo el ritmo.
    // while (no if): si la pestaña estuvo en segundo plano, el delta es enorme; el bucle
    // garantiza que el marcador nunca quede en z negativo (no se cuela en la vista de la home).
    for (const child of group.children) {
      child.position.z -= delta * SPEED;
      while (child.position.z < RECYCLE_Z) {
        child.position.z += RANGE;
      }
    }
  });

  return (
    <group ref={groupRef}>
      {markers.map((marker) => (
        <group key={marker.key} position={[marker.x, FLOOR_Y, marker.z]}>
          {/* Cara solida oscura (oclusion) + rejilla neon encima: misma estetica que el anillo. */}
          <mesh position={[0, marker.height / 2, 0]}>
            <coneGeometry args={[marker.radius, marker.height, 4]} />
            <meshBasicMaterial color="#0c0a1a" />
          </mesh>
          <mesh position={[0, marker.height / 2, 0]}>
            <coneGeometry args={[marker.radius, marker.height, 4]} />
            <meshBasicMaterial color="#24f5ff" wireframe />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export default HomeRoadSide;
