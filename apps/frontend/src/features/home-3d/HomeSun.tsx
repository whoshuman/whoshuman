import { useMemo } from "react";
import { CanvasTexture } from "three";

type HomeSunProps = {
  color: string;
};

// Dibuja el disco solar en un canvas: degradado vertical amarillo -> magenta y
// franjas horizontales (scanlines) que "deshacen" la mitad inferior, estilo synthwave.
function createSunTexture() {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // Degradado vertical del sol.
  const gradient = ctx.createLinearGradient(0, 0, 0, size);
  gradient.addColorStop(0, "#fff6c2");
  gradient.addColorStop(0.32, "#ffe14d");
  gradient.addColorStop(0.55, "#ff9f1c");
  gradient.addColorStop(0.78, "#ff5db1");
  gradient.addColorStop(1, "#ff2bd6");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  // Scanlines: huecos transparentes cada vez mas gruesos y separados hacia abajo.
  ctx.globalCompositeOperation = "destination-out";
  let y = size * 0.28;
  let gap = 4;
  while (y < size) {
    const thickness = gap * 0.85;
    ctx.fillRect(0, y, size, thickness);
    y += gap + thickness;
    gap += 1.6;
  }

  return new CanvasTexture(canvas);
}

function HomeSun({ color }: HomeSunProps) {
  const sunTexture = useMemo(() => createSunTexture(), []);

  return (
    // Mas alla del anillo de montañas (z -850) para que asome por detras de las crestas;
    // la cresta norte opaca le tapa la base, igual que la luna en el lado opuesto.
    <group position={[0, 40, -1000]}>
      {/* Halo exterior difuso. Mas grande para que la corona se eleve sobre ciudad y montañas. */}
      <mesh position={[0, 0, -1.2]}>
        <circleGeometry args={[215, 64]} />
        <meshBasicMaterial color={color} transparent opacity={0.1} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0, -0.8]}>
        <circleGeometry args={[165, 64]} />
        <meshBasicMaterial color={"#ffb35c"} transparent opacity={0.18} depthWrite={false} />
      </mesh>

      {/* Disco solar con degradado y scanlines. */}
      <mesh>
        <circleGeometry args={[138, 64]} />
        <meshBasicMaterial map={sunTexture} transparent depthWrite={false} />
      </mesh>
    </group>
  );
}

export default HomeSun;
