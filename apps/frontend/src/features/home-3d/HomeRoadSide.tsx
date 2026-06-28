import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { BufferAttribute, Color, ConeGeometry, MeshBasicMaterial } from "three";
import type { Group } from "three";

// Montañas neon a ambos lados de la carretera que corren hacia la camara (tapiz) y se reciclan
// al fondo. Mismo aspecto que las del anillo del fondo: cara oscura + rejilla con degradado
// vertical cyan -> magenta. Nunca pisan la carretera (la X se calcula a partir del radio).

const FLOOR_Y = -49.5;
const ROWS = 16;
const SPACING = 64;
const RANGE = ROWS * SPACING;
const Z_NEAR = 150;
const RECYCLE_Z = 95;
const SPEED = 150;
// Mitad del ancho de la carretera + margen: el borde interior de cada montaña no lo cruza.
const ROAD_HALF = 20;
const SIDE_MARGIN = 8;

const COLOR_LOW = new Color("#24f5ff");
const COLOR_HIGH = new Color("#ff2bd6");

// Cono unidad (base en y -0.5, cuspide en y 0.5) con color por altura: cyan abajo, magenta
// arriba. Compartido por todas las montañas (se escala por instancia) para no gastar de mas.
function buildConeGeometry() {
  const geometry = new ConeGeometry(0.5, 1, 4);
  const position = geometry.attributes.position;
  const colors = new Float32Array(position.count * 3);
  const tmp = new Color();
  for (let i = 0; i < position.count; i += 1) {
    const t = position.getY(i) + 0.5; // 0 en la base, 1 en la cuspide
    tmp.copy(COLOR_LOW).lerp(COLOR_HIGH, t);
    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  return geometry;
}

type Marker = { key: string; x: number; z: number; height: number; radius: number; spin: number };

function buildMarkers(): Marker[] {
  const list: Marker[] = [];
  for (let i = 0; i < ROWS; i += 1) {
    const z = Z_NEAR + i * SPACING;
    for (const side of [-1, 1]) {
      const height = 22 + ((i * 7 + (side > 0 ? 3 : 0)) % 4) * 11;
      const radius = height * 0.42;
      // X = mitad carretera + margen + radio -> el borde interior queda a ROAD_HALF+margen.
      const x = side * (ROAD_HALF + SIDE_MARGIN + radius + ((i + (side > 0 ? 1 : 0)) % 3) * 8);
      list.push({ key: `${i}-${side}`, x, z, height, radius, spin: (i % 4) * 0.4 });
    }
  }
  return list;
}

function HomeRoadSide() {
  const groupRef = useRef<Group>(null);
  const coneGeometry = useMemo(() => buildConeGeometry(), []);
  const fillMaterial = useMemo(() => new MeshBasicMaterial({ color: "#0c0a1a" }), []);
  const wireMaterial = useMemo(() => new MeshBasicMaterial({ vertexColors: true, wireframe: true }), []);
  const markers = useMemo(() => buildMarkers(), []);

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group) return;
    // while (no if): tras volver de segundo plano, el delta es enorme; el bucle evita que un
    // marcador quede en z negativo (se colaria en la vista de la home).
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
        <group
          key={marker.key}
          position={[marker.x, FLOOR_Y, marker.z]}
          rotation={[0, marker.spin, 0]}
        >
          {/* Cara solida oscura (oclusion) + rejilla neon con degradado, como el anillo. */}
          <mesh
            geometry={coneGeometry}
            material={fillMaterial}
            position={[0, marker.height / 2, 0]}
            scale={[marker.radius, marker.height, marker.radius]}
          />
          <mesh
            geometry={coneGeometry}
            material={wireMaterial}
            position={[0, marker.height / 2, 0]}
            scale={[marker.radius, marker.height, marker.radius]}
          />
        </group>
      ))}
    </group>
  );
}

export default HomeRoadSide;
