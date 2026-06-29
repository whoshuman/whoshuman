import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { BufferAttribute, Color, MeshBasicMaterial, PlaneGeometry } from "three";
import type { Group } from "three";

// Cordilleras neon a ambos lados de la carretera. Mismo aspecto Y balanceo que el anillo del
// fondo (HomeMountains): caras facetadas opacas + rejilla con degradado cyan -> magenta, y las
// cimas suben/bajan con el tiempo. La diferencia es el tapiz: las tiras corren hacia la camara
// al MISMO ritmo que la carretera y se reciclan al fondo. El relieve es PERIODICO en la longitud
// de la tira para que el borde lejano de una case con el cercano de la siguiente: sin salto.

const FLOOR_Y = -49.5;
// Tira de cordillera: larga a lo largo de la carretera (Z), con grosor hacia los lados (X).
const LENGTH = 480;
const THICKNESS = 260;
// Low-poly facetado IGUAL que el anillo del fondo (~70 u/faceta): pocos segmentos = caras
// grandes y angulares. Densidad de HomeMountains: WIDTH 2000/28 y DEPTH 240/6.
// A lo largo (Z) muchos segmentos para resolver muchos picos (con pocos, se promedian y queda
// plano). A lo ancho pocos: facetas grandes. SEG_LEN debe ser >= 2x la frecuencia mas alta.
const SEG_LEN = 32;
const SEG_THICK = 4;
const PEAK_HEIGHT = 150;
// Suelo de relieve bajo (valles hundidos) para que las cimas resalten puntiagudas.
const RIDGE_FLOOR = 0.12;

const STRIPS_PER_SIDE = 3;
const NEAR_Z = 80;
// Camara cenital sobre el coche (carFocus z 86): reciclamos cuando el borde LEJANO de la tira
// (center + L/2) ya paso la camara, asi desaparece fuera de vista y reaparece al fondo sin pop.
const RECYCLE_Z = 86 - LENGTH / 2;
const RANGE = STRIPS_PER_SIDE * LENGTH;
// Velocidad del tapiz IGUAL que la carretera (HomeRoad): SCROLL_SPEED 1.1 * ROAD_LENGTH 1000
// / REPEAT 34 = u/seg que avanza la textura de la carretera. Asi montañas y carretera van juntas.
const SPEED = (1.1 * 1000) / 34;
// Mitad de la carretera (ROAD_WIDTH 66 / 2): el borde interior de la montaña arranca justo en
// el borde de la carretera, sin hueco. Margen 0 = pegadas (su altura ahi es 0, plano al suelo).
const ROAD_HALF = 33;
const SIDE_MARGIN = 0;
// Centro X de la tira: el borde interior queda exactamente en el borde de la carretera.
const SIDE_X = ROAD_HALF + SIDE_MARGIN + THICKNESS / 2;

const COLOR_LOW = new Color("#24f5ff");
const COLOR_HIGH = new Color("#ff2bd6");
const tmpColor = new Color();

// Perfil de cordillera periodico en la longitud (u en [-0.5, 0.5]) y animado en el tiempo:
// frecuencias enteras en u -> periodo 1 (los extremos casan al reciclar), y el tiempo entra
// como fase en dos octavas -> las cimas suben/bajan (balanceo del fondo). Devuelve [0..1]:
// exponente alto = pocas cimas altas y muchos valles (silueta dentada).
function ridgeNorm(u: number, time: number) {
  // Frecuencias altas (3,5,8,12) = muchos picos a lo largo de la tira. El tiempo entra como
  // fase en dos octavas -> las cimas suben/bajan (balanceo del fondo).
  const r =
    0.4 * Math.sin(2 * Math.PI * 3 * u + time * 0.15) +
    0.3 * Math.sin(2 * Math.PI * 5 * u + 1.3) +
    0.2 * Math.sin(2 * Math.PI * 8 * u + 2.1) +
    0.14 * Math.sin(2 * Math.PI * 12 * u + time * 0.3);
  let m = (r + 1) / 2;
  // Exponente alto (mas que el fondo, 2.6) = cimas mas afiladas y valles mas hundidos.
  m = Math.pow(Math.max(0, Math.min(1, m)), 3.8);
  return RIDGE_FLOOR + (1 - RIDGE_FLOOR) * m;
}

// Geometria de una tira mas su metadata base (edgeT a lo ancho, u a lo largo) cacheada para
// reaplicar el relieve cada frame sin recalcular x/y. innerPositive: lado de la carretera
// (borde bajo) -> true izquierda (carretera hacia +X), false derecha (hacia -X).
type RidgeStrip = { geometry: PlaneGeometry; amp: Float32Array; u: Float32Array };

function buildRidgeStrip(innerPositive: boolean): RidgeStrip {
  const geometry = new PlaneGeometry(THICKNESS, LENGTH, SEG_THICK, SEG_LEN);
  const position = geometry.attributes.position;
  const count = position.count;
  const amp = new Float32Array(count);
  const u = new Float32Array(count);

  for (let i = 0; i < count; i += 1) {
    const x = position.getX(i); // a lo ancho [-T/2, T/2]
    const y = position.getY(i); // a lo largo [-L/2, L/2]
    // edgeT: 0 en el borde pegado a la carretera, 1 en el exterior. La amplitud crece hacia fuera.
    const edgeT = innerPositive
      ? (THICKNESS / 2 - x) / THICKNESS
      : (x + THICKNESS / 2) / THICKNESS;
    amp[i] = Math.pow(Math.max(0, Math.min(1, edgeT)), 0.7);
    u[i] = y / LENGTH;
  }

  geometry.setAttribute("color", new BufferAttribute(new Float32Array(count * 3), 3));
  return { geometry, amp, u };
}

// Reaplica el relieve animado (altura + color por altura) a una tira en el frame actual.
function animateStrip(strip: RidgeStrip, time: number) {
  const position = strip.geometry.attributes.position;
  const colors = strip.geometry.attributes.color as BufferAttribute;
  for (let i = 0; i < position.count; i += 1) {
    const norm = ridgeNorm(strip.u[i], time);
    position.setZ(i, norm * strip.amp[i] * PEAK_HEIGHT);
    // Tinte por altura: cimas a magenta, base a cyan (mas brillo arriba = mas bloom).
    tmpColor.copy(COLOR_LOW).lerp(COLOR_HIGH, Math.min(1, norm * 1.15));
    colors.setXYZ(i, tmpColor.r, tmpColor.g, tmpColor.b);
  }
  position.needsUpdate = true;
  colors.needsUpdate = true;
}

type Strip = { key: string; side: number; z: number };

function buildStrips(): Strip[] {
  const list: Strip[] = [];
  for (const side of [-1, 1]) {
    for (let i = 0; i < STRIPS_PER_SIDE; i += 1) {
      list.push({ key: `${side}-${i}`, side, z: NEAR_Z + i * LENGTH });
    }
  }
  return list;
}

function HomeRoadSide() {
  const groupRef = useRef<Group>(null);
  // Una geometria por lado (borde bajo a un lado u otro), compartida por sus tiras: animar una
  // anima todas las del lado (mismas cimas), pero cada tira tiene su propia posicion en Z.
  const left = useMemo(() => buildRidgeStrip(true), []);
  const right = useMemo(() => buildRidgeStrip(false), []);
  const fillMaterial = useMemo(
    () =>
      new MeshBasicMaterial({
        color: "#120a2a",
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1
      }),
    []
  );
  const wireMaterial = useMemo(
    () => new MeshBasicMaterial({ vertexColors: true, wireframe: true }),
    []
  );
  const strips = useMemo(() => buildStrips(), []);

  useFrame((state, delta) => {
    // Balanceo (igual que el fondo): reaplica el relieve animado a las dos geometrias compartidas.
    const time = state.clock.getElapsedTime();
    animateStrip(left, time);
    animateStrip(right, time);

    const group = groupRef.current;
    if (!group) return;
    // Tapiz al ritmo de la carretera. while (no if): tras volver de segundo plano el delta es
    // enorme; el bucle evita que una tira quede en z negativo (se colaria en la vista de la home).
    for (const child of group.children) {
      child.position.z -= delta * SPEED;
      while (child.position.z < RECYCLE_Z) {
        child.position.z += RANGE;
      }
    }
  });

  return (
    <group ref={groupRef}>
      {strips.map((strip) => {
        const geometry = strip.side < 0 ? left.geometry : right.geometry;
        return (
          // Grupo exterior: posiciona la tira y la tumba (relieve hacia arriba, largo en Z).
          <group
            key={strip.key}
            position={[strip.side * SIDE_X, FLOOR_Y, strip.z]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <mesh geometry={geometry} material={fillMaterial} />
            <mesh geometry={geometry} material={wireMaterial} />
          </group>
        );
      })}
    </group>
  );
}

export default HomeRoadSide;
