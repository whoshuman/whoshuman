import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { CanvasTexture, RepeatWrapping, type Texture } from "three";

// Carretera synthwave que va desde el inicio del mapa hasta la luna (+Z). La textura se
// desplaza hacia la camara (tapiz) para dar sensacion de que el coche avanza hacia la luna.

const ROAD_WIDTH = 44;
const ROAD_LENGTH = 1100;
// Numero de tramos repetidos a lo largo de la carretera (cada tramo = una linea discontinua).
const REPEAT = 26;
// Velocidad de desplazamiento del tapiz (unidades de textura por segundo).
const SCROLL_SPEED = 0.55;

// Dibuja un tramo de carretera tileable: asfalto oscuro, bordes neon y linea central discontinua.
function createRoadTexture() {
  const w = 128;
  const h = 128;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // Asfalto.
  ctx.fillStyle = "#0a0818";
  ctx.fillRect(0, 0, w, h);

  // Bordes neon cyan a izquierda y derecha.
  ctx.fillStyle = "#24f5ff";
  ctx.fillRect(4, 0, 6, h);
  ctx.fillRect(w - 10, 0, 6, h);

  // Linea central magenta discontinua (un trazo por tramo).
  ctx.fillStyle = "#ff2bd6";
  ctx.fillRect(w / 2 - 3, h * 0.15, 6, h * 0.55);

  // Travesaño tenue al borde del tramo para reforzar la sensacion de movimiento.
  ctx.fillStyle = "rgba(36,245,255,0.18)";
  ctx.fillRect(0, h - 4, w, 3);

  const texture = new CanvasTexture(canvas);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(1, REPEAT);
  return texture;
}

function HomeRoad() {
  const textureRef = useRef<Texture | null>(null);
  const roadTexture = useMemo(() => {
    const texture = createRoadTexture();
    textureRef.current = texture;
    return texture;
  }, []);

  useFrame((_, delta) => {
    if (textureRef.current) {
      // Desplaza el tapiz hacia la camara: las lineas corren hacia el observador.
      textureRef.current.offset.y -= delta * SCROLL_SPEED;
    }
  });

  return (
    // Tumbada sobre el suelo (un pelin por encima de la grid) y centrada entre camara y luna.
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -49.5, 530]}>
      <planeGeometry args={[ROAD_WIDTH, ROAD_LENGTH]} />
      <meshBasicMaterial map={roadTexture ?? undefined} transparent />
    </mesh>
  );
}

export default HomeRoad;
