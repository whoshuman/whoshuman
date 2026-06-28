import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { BufferAttribute, Color } from "three";
import type { Mesh } from "three";

type HomeMountainsProps = {
  fillColor: string;
  // Posicion del lado y giro en Y para colocar varias franjas formando un anillo.
  position?: [number, number, number];
  rotationY?: number;
};

// Dimensiones del terreno wireframe. Mas segmentos = malla mas detallada (y mas coste).
const WIDTH = 2000;
const DEPTH = 240;
const SEGMENTS_X = 64;
const SEGMENTS_Z = 12;
const PEAK_HEIGHT = 88;
// Suelo de relieve: evita grandes zonas planas pegadas a la grid (salvo el borde frontal).
const RIDGE_FLOOR = 0.28;

// Colores del degradado vertical de la rejilla: cyan en la base -> magenta en las cimas.
const COLOR_LOW = new Color("#24f5ff");
const COLOR_HIGH = new Color("#ff2bd6");
const tmpColor = new Color();

// Altura del relieve (siempre >= 0). El borde frontal queda a 0 (anclado a la grid) y el
// interior sube con crestas fractales; devuelve [0..1] normalizado para teñir la rejilla.
function reliefAt(x: number, depth: number, time: number) {
  // Varias octavas de seno = perfil de cordillera mas rico y dentado.
  const r =
    0.5 * Math.sin(x * 0.018 + time * 0.15) +
    0.3 * Math.sin(x * 0.045 + depth * 0.05) +
    0.2 * Math.sin(x * 0.09 + 2.1) +
    0.12 * Math.sin(x * 0.17 + time * 0.3);

  let m = (r + 1) / 2; // 0..1
  m = Math.pow(Math.max(0, Math.min(1, m)), 1.25); // afila los valles
  m = RIDGE_FLOOR + (1 - RIDGE_FLOOR) * m; // nunca del todo plano

  // El borde frontal (depth minimo) vale 0 -> anclado a la grid; sube hacia el fondo.
  const front = (depth + DEPTH / 2) / DEPTH; // 0 delante .. 1 detras
  const amp = Math.pow(front, 0.7);

  return m * amp;
}

// Aplica el relieve a las posiciones y, opcionalmente, el degradado de color a la rejilla.
function applyRelief(
  position: BufferAttribute,
  base: Array<[number, number]>,
  time: number,
  colors?: BufferAttribute
) {
  for (let i = 0; i < position.count; i += 1) {
    const [x, depth] = base[i];
    const norm = reliefAt(x, depth, time);
    position.setZ(i, norm * PEAK_HEIGHT);

    if (colors) {
      // Tinte por altura: las cimas tiran a magenta, la base a cyan (mas brillo arriba = mas bloom).
      tmpColor.copy(COLOR_LOW).lerp(COLOR_HIGH, Math.min(1, norm * 1.15));
      colors.setXYZ(i, tmpColor.r, tmpColor.g, tmpColor.b);
    }
  }
  position.needsUpdate = true;
  if (colors) colors.needsUpdate = true;
}

// Relieve montañoso retrowave: caras opacas dentro y rejilla neon con degradado encima.
function HomeMountains({
  fillColor,
  position = [0, -50, -150],
  rotationY = 0
}: HomeMountainsProps) {
  const fillRef = useRef<Mesh>(null);
  const wireRef = useRef<Mesh>(null);
  // Posiciones base (x = ancho, y = profundidad) cacheadas en el primer frame.
  const baseRef = useRef<Array<[number, number]> | null>(null);

  useFrame(({ clock }) => {
    const fill = fillRef.current;
    const wire = wireRef.current;
    if (!fill || !wire) return;

    const fillPos = fill.geometry.attributes.position as BufferAttribute;
    const wirePos = wire.geometry.attributes.position as BufferAttribute;

    if (!baseRef.current) {
      const points: Array<[number, number]> = [];
      for (let i = 0; i < fillPos.count; i += 1) {
        points.push([fillPos.getX(i), fillPos.getY(i)]);
      }
      baseRef.current = points;
    }

    // Crea (una vez) el attribute de color de la rejilla para el degradado por altura.
    if (!wire.geometry.attributes.color) {
      const colorArray = new Float32Array(wirePos.count * 3);
      wire.geometry.setAttribute("color", new BufferAttribute(colorArray, 3));
    }
    const wireColors = wire.geometry.attributes.color as BufferAttribute;

    const time = clock.getElapsedTime();
    applyRelief(fillPos, baseRef.current, time);
    applyRelief(wirePos, baseRef.current, time, wireColors);
  });

  return (
    // El grupo exterior coloca el lado (posicion + giro en Y); el interior tumba el plano.
    <group position={position} rotation={[0, rotationY, 0]}>
      <group rotation={[-Math.PI / 2, 0, 0]}>
        {/* Caras solidas y opacas: entran en el pase opaco para que los edificios las tapen
            correctamente por profundidad. polygonOffset las empuja tras la rejilla. */}
        <mesh ref={fillRef}>
          <planeGeometry args={[WIDTH, DEPTH, SEGMENTS_X, SEGMENTS_Z]} />
          <meshBasicMaterial
            color={fillColor}
            polygonOffset
            polygonOffsetFactor={1}
            polygonOffsetUnits={1}
          />
        </mesh>

        {/* Rejilla neon con degradado vertical (cyan -> magenta) por vertex colors;
            el bloom de la escena le da el brillo neon en las cimas. */}
        <mesh ref={wireRef}>
          <planeGeometry args={[WIDTH, DEPTH, SEGMENTS_X, SEGMENTS_Z]} />
          <meshBasicMaterial vertexColors wireframe />
        </mesh>
      </group>
    </group>
  );
}

export default HomeMountains;
