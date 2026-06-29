import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { CanvasTexture, RepeatWrapping } from "three";
import type { Mesh, MeshBasicMaterial } from "three";

// Carretera synthwave que va desde el inicio del mapa hasta la luna (+Z). La textura se
// desplaza hacia la camara (tapiz) para dar sensacion de que el coche avanza hacia la luna.

const ROAD_WIDTH = 66;
const ROAD_LENGTH = 1000;
// Celdas de rejilla a lo largo de la carretera. Mas repeticiones = celdas mas juntas; al
// desplazarse, los travesaños corren hacia la camara (rejilla outrun en movimiento).
const REPEAT = 26;
// Velocidad del tapiz (spans de textura por segundo).
const SCROLL_SPEED = 1.1;

// Dibuja un tramo de carretera tileable estilo REJILLA OUTRUN: sin asfalto (fondo transparente,
// se funde con el suelo/espacio), solo lineas neon en perspectiva: columnas longitudinales cyan,
// eje central magenta y un travesaño por tramo que forma la cuadricula. shadowBlur da el halo y
// el bloom de la escena lo enciende.
function createRoadTexture() {
  // Lienzo de alta resolucion para lineas nitidas y halos suaves.
  const w = 256;
  const h = 256;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // Sin relleno: el lienzo queda transparente -> la carretera es solo la rejilla luminosa.

  // Helper: linea con halo neon (glow). vertical = columna longitudinal; horizontal = travesaño.
  const glowLine = (
    x: number,
    y: number,
    lw: number,
    lh: number,
    color: string,
    blur: number
  ) => {
    ctx.save();
    ctx.shadowBlur = blur;
    ctx.shadowColor = color;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, lw, lh);
    ctx.restore();
  };

  // Columnas longitudinales cyan: dos bordes + dos interiores (4 carriles de rejilla).
  const columns = [0.06, 0.37, 0.63, 0.94];
  for (const c of columns) {
    glowLine(w * c - 1.5, 0, 3, h, "#24f5ff", 18);
  }

  // Eje central magenta (columna brillante en el medio).
  glowLine(w / 2 - 1.5, 0, 3, h, "#ff2bd6", 18);

  // Travesaño de la rejilla (1 por tramo) cyan con halo: al hacer tapiz forma las celdas.
  glowLine(0, h - 4, w, 3, "#24f5ff", 16);

  const texture = new CanvasTexture(canvas);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(1, REPEAT);
  texture.anisotropy = 16;
  return texture;
}

function HomeRoad() {
  const meshRef = useRef<Mesh>(null);
  const roadTexture = useMemo(() => createRoadTexture(), []);

  useFrame((_, delta) => {
    // Mutamos el offset de la textura via la malla (no el valor de useMemo): tapiz hacia camara.
    const material = meshRef.current?.material as MeshBasicMaterial | undefined;
    if (material?.map) {
      material.map.offset.y -= delta * SCROLL_SPEED;
    }
  });

  return (
    // Tumbada sobre el suelo (un pelin por encima de la grid). Empieza mas lejos del centro
    // (borde cercano ~z 100) para no colarse bajo la camara cenital sobre el coche.
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -49.5, 600]}>
      <planeGeometry args={[ROAD_WIDTH, ROAD_LENGTH]} />
      <meshBasicMaterial map={roadTexture ?? undefined} transparent />
    </mesh>
  );
}

export default HomeRoad;
