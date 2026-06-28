import { useMemo } from "react";
import { CanvasTexture } from "three";

type HomeMoonProps = {
  color: string;
};

// Dibuja la luna en un canvas: degradado frio (blanco -> cyan -> violeta), crateres sutiles
// y franjas horizontales (scanlines) que la deshacen por abajo, espejo synthwave del sol.
function createMoonTexture() {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // Degradado vertical frio de la luna.
  const gradient = ctx.createLinearGradient(0, 0, 0, size);
  gradient.addColorStop(0, "#f4f0ff");
  gradient.addColorStop(0.4, "#bdb4ff");
  gradient.addColorStop(0.7, "#8b5cf6");
  gradient.addColorStop(1, "#5b2fd1");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  // Crateres: circulos un poco mas oscuros para dar relieve lunar.
  ctx.globalCompositeOperation = "source-atop";
  const craters: Array<[number, number, number]> = [
    [90, 80, 22],
    [165, 110, 16],
    [120, 150, 28],
    [70, 175, 12],
    [185, 60, 10]
  ];
  for (const [cx, cy, r] of craters) {
    const crater = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.2, cx, cy, r);
    crater.addColorStop(0, "rgba(40,20,90,0.35)");
    crater.addColorStop(1, "rgba(40,20,90,0)");
    ctx.fillStyle = crater;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Particiones (scanlines): huecos transparentes cada vez mas gruesos hacia abajo, igual
  // que el sol, para que la mitad inferior se "deshaga" en franjas.
  ctx.globalCompositeOperation = "destination-out";
  let y = size * 0.5;
  let gap = 4;
  while (y < size) {
    const thickness = gap * 0.85;
    ctx.fillRect(0, y, size, thickness);
    y += gap + thickness;
    gap += 1.6;
  }

  return new CanvasTexture(canvas);
}

// Luna synthwave al fondo del lado opuesto al sol (visible al darse la vuelta la camara).
function HomeMoon({ color }: HomeMoonProps) {
  const moonTexture = useMemo(() => createMoonTexture(), []);

  return (
    // Espejo del sol en +Z, pero MAS ALLA del anillo de montañas (z 850) para que asome
    // por detras de las crestas: el fill opaco de las montañas la tapa por abajo.
    <group position={[0, 74, 1000]} rotation={[0, Math.PI, 0]}>
      {/* Halo exterior difuso frio. */}
      <mesh position={[0, 0, -1.2]}>
        <circleGeometry args={[138, 64]} />
        <meshBasicMaterial color={color} transparent opacity={0.1} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0, -0.8]}>
        <circleGeometry args={[106, 64]} />
        <meshBasicMaterial color={"#bdb4ff"} transparent opacity={0.16} depthWrite={false} />
      </mesh>

      {/* Disco lunar con degradado, crateres y particiones (scanlines). */}
      <mesh>
        <circleGeometry args={[84, 64]} />
        <meshBasicMaterial map={moonTexture} transparent depthWrite={false} />
      </mesh>
    </group>
  );
}

export default HomeMoon;
