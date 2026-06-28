import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { CanvasTexture, RepeatWrapping } from "three";
import type { Mesh, MeshBasicMaterial } from "three";

// Carretera synthwave que va desde el inicio del mapa hasta la luna (+Z). La textura se
// desplaza hacia la camara (tapiz) para dar sensacion de que el coche avanza hacia la luna.

const ROAD_WIDTH = 40;
const ROAD_LENGTH = 1100;
// Tramos repetidos a lo largo de la carretera. Cada tramo lleva una traviesa fina y un trazo
// central; al desplazarse, esas marcas corren hacia la camara (sensacion de tapiz/avance).
const REPEAT = 34;
// Velocidad del tapiz (spans de textura por segundo).
const SCROLL_SPEED = 1.1;

// Dibuja un tramo de carretera tileable y FINO: asfalto oscuro, bordes neon delgados, linea
// central discontinua delgada y una traviesa tenue. El bloom de la escena le da el glow.
function createRoadTexture() {
  // Lienzo alto para lineas finas y nitidas a lo largo del tramo.
  const w = 96;
  const h = 256;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // Asfalto muy oscuro.
  ctx.fillStyle = "#06040f";
  ctx.fillRect(0, 0, w, h);

  // Bordes neon cyan finos (2px) a izquierda y derecha.
  ctx.fillStyle = "#24f5ff";
  ctx.fillRect(3, 0, 2, h);
  ctx.fillRect(w - 5, 0, 2, h);

  // Linea central magenta discontinua y delgada (trazo + hueco por tramo).
  ctx.fillStyle = "#ff2bd6";
  ctx.fillRect(w / 2 - 1.5, h * 0.12, 3, h * 0.5);

  // Traviesa horizontal fina y tenue (1 por tramo): da el ritmo del movimiento sin recargar.
  ctx.fillStyle = "rgba(36,245,255,0.5)";
  ctx.fillRect(0, h - 3, w, 2);

  const texture = new CanvasTexture(canvas);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(1, REPEAT);
  texture.anisotropy = 8;
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
    // Tumbada sobre el suelo (un pelin por encima de la grid) y centrada entre camara y luna.
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -49.5, 530]}>
      <planeGeometry args={[ROAD_WIDTH, ROAD_LENGTH]} />
      <meshBasicMaterial map={roadTexture ?? undefined} transparent />
    </mesh>
  );
}

export default HomeRoad;
