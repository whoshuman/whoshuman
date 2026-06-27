import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { BufferAttribute, Mesh } from "three";

type HomeMountainsProps = {
  color: string;
  fillColor: string;
};

// Dimensiones del terreno wireframe. Mas segmentos = malla mas detallada (y mas coste).
const WIDTH = 2000;
const DEPTH = 240;
const SEGMENTS_X = 50;
const SEGMENTS_Z = 10;
const PEAK_HEIGHT = 54;

// Aplica el relieve animado (crestas que ondulan) al attribute de posiciones de una geometria.
function applyRelief(position: BufferAttribute, base: Array<[number, number]>, time: number) {
  for (let i = 0; i < position.count; i += 1) {
    const [x, depth] = base[i];

    const ridge = Math.sin(x * 0.025) * Math.cos(x * 0.011 + 1.3);
    const detail = Math.sin(x * 0.07 + depth * 0.04) * 0.45;
    let height = ridge + detail;
    height = Math.sign(height) * Math.pow(Math.abs(height), 1.4);
    height += Math.sin(time * 0.7 + x * 0.018) * 0.22;

    const envelope = 0.35 + ((depth + DEPTH / 2) / DEPTH) * 0.95;
    position.setZ(i, height * PEAK_HEIGHT * envelope);
  }
  position.needsUpdate = true;
}

// Relieve montañoso retrowave al fondo: caras opacas en el interior y rejilla neon encima.
function HomeMountains({ color, fillColor }: HomeMountainsProps) {
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

    const time = clock.getElapsedTime();
    applyRelief(fillPos, baseRef.current, time);
    applyRelief(wirePos, baseRef.current, time);
  });

  return (
    // Detras de toda la ciudad (edificios llegan a ~z -385) y delante del sol (z -560).
    <group rotation={[-Math.PI / 2, 0, 0]} position={[0, -90, -150]}>
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

      {/* Rejilla neon por encima de las caras. Opaca para respetar la oclusion con la ciudad;
          el bloom de la escena le da el brillo neon. */}
      <mesh ref={wireRef}>
        <planeGeometry args={[WIDTH, DEPTH, SEGMENTS_X, SEGMENTS_Z]} />
        <meshBasicMaterial color={color} wireframe />
      </mesh>
    </group>
  );
}

export default HomeMountains;
