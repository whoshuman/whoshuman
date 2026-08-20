import { Clone, useGLTF } from "@react-three/drei";
import { useMemo } from "react";
import { Box3 } from "three";

import { createPlazaFloorTexture } from "./plazaFloorTexture";
import { PLAZA_FLOOR_REPEAT, PLAZA_FLOOR_SIZE, PLAZA_MODELS, plazaPieces } from "./plazaLayout";
import type { PlazaPiece } from "./plazaLayout";

type HomePlazaProps = {
  colorCyan: string;
  colorMagenta: string;
  // Donde se apoya la plaza en el mundo: justo encima del suelo de la rejilla (y -50.2).
  // La z va emparejada con CAMERA_POSES.city: si la plaza se aleja, el viaje de camara
  // tiene que alargarse lo mismo para que el lobby quede a la misma distancia de la plaza.
  position?: [number, number, number];
  // La plaza esta modelada a escala de persona; el multiplicador la convierte en skyline.
  scale?: number;
};

// Una pieza de la plaza. Clone (y no primitive) porque el mismo GLB se coloca varias veces:
// primitive movería siempre el mismo objeto, mientras que Clone reutiliza geometria y
// material y solo duplica los nodos, que es lo barato.
function PlazaPieceModel({ piece }: { piece: PlazaPiece }) {
  const { scene } = useGLTF(PLAZA_MODELS[piece.model].url);

  // Los GLB salen centrados en el origen, asi que medio edificio queda bajo tierra. Se mide la
  // caja una vez por modelo (el scene esta cacheado por useGLTF) y se sube esa media altura.
  const groundOffset = useMemo(() => -new Box3().setFromObject(scene).min.y, [scene]);

  return (
    <Clone
      object={scene}
      position={[piece.x, groundOffset * piece.scale, piece.z]}
      rotation={[0, piece.rotationY, 0]}
      scale={piece.scale}
    />
  );
}

// Plaza cyberpunk que sustituye a la ciudad GLB del menu: pavimento neon, arco de entrada,
// puestos bajos cerca de la camara y torres cerrando el perimetro.
function HomePlaza({
  colorCyan,
  colorMagenta,
  position = [0, -49.9, -60],
  scale = 4
}: HomePlazaProps) {
  const floorTexture = useMemo(() => {
    const texture = createPlazaFloorTexture(colorCyan, colorMagenta);
    texture?.repeat.set(PLAZA_FLOOR_REPEAT, PLAZA_FLOOR_REPEAT);

    return texture;
  }, [colorCyan, colorMagenta]);

  // Las luces viven dentro del grupo escalado, pero three mide la caida en unidades de mundo:
  // el radio se multiplica por la escala y la intensidad por su cuadrado (caida 1/d^2), asi
  // el ambiente no cambia si se reencuadra la plaza con otra escala.
  const neonLight = (brightness: number, radius: number) => ({
    intensity: brightness * (radius * scale) ** 2,
    distance: radius * scale * 2
  });

  return (
    <group position={position} scale={scale}>
      {/* Pavimento con la baldosa repetida. Material basico, como la rejilla: se mantiene
          luminoso sin depender de las luces y el bloom hace el resto. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[PLAZA_FLOOR_SIZE, PLAZA_FLOOR_SIZE]} />
        <meshBasicMaterial map={floorTexture} />
      </mesh>

      {/* Ambiente violeta de relleno: sin el, las caras en sombra de los GLB se van a negro. */}
      <ambientLight color="#2a1a4a" intensity={0.4} />

      {/* Magenta en el arco (es el foco de la composicion) y cianes rasantes en las torres. */}
      <pointLight color={colorMagenta} position={[0, 6, 13]} {...neonLight(1.6, 14)} />
      {/* Cian sobre la fuente: la textura del modelo salio tenue y sin esto el haz no brilla.
          Va en el centro del vacio, al mismo x que el arco, para reforzar la simetria. */}
      <pointLight color={colorCyan} position={[0, 4, -11]} {...neonLight(2.5, 12)} />
      <pointLight color={colorCyan} position={[-19, 15, -12]} {...neonLight(1.1, 20)} />
      <pointLight color={colorCyan} position={[19, 15, -12]} {...neonLight(1.1, 20)} />
      <pointLight color={colorCyan} position={[0, 19, -31]} {...neonLight(0.9, 22)} />

      {plazaPieces.map((piece, index) => (
        <PlazaPieceModel key={index} piece={piece} />
      ))}
    </group>
  );
}

// Descarga los GLB antes de montar el componente para que el primer render sea mas fluido.
Object.values(PLAZA_MODELS).forEach((model) => useGLTF.preload(model.url));

export default HomePlaza;
