import { useMemo } from "react";
import { Shape } from "three";

type HomeSunProps = {
  color: string;
};

// Three no tiene una geometria directa de semicirculo, asi que se construye como Shape.
function createUpperHalfCircle(radius: number) {
  const shape = new Shape();

  shape.moveTo(-radius, 0);
  shape.absarc(0, 0, radius, Math.PI, 0, true);
  shape.lineTo(-radius, 0);

  return shape;
}

// Crea un sol recortado en semicircunferencia para que no aparezca bajo la ciudad.
function HomeSun({ color }: HomeSunProps) {
  // Las tres capas comparten forma pero tienen radios/opacidades distintas para simular glow.
  const glowOuter = useMemo(() => createUpperHalfCircle(74), []);
  const glowInner = useMemo(() => createUpperHalfCircle(62), []);
  const sunShape = useMemo(() => createUpperHalfCircle(50), []);

  return (
    // El sol queda por detras de la ciudad para construir el horizonte retrowave.
    <group position={[0, -20, -360]}>
      <mesh position={[0, 0, -0.8]}>
        <shapeGeometry args={[glowOuter]} />
        <meshBasicMaterial color={color} transparent opacity={0.08} depthWrite={false} />
      </mesh>

      <mesh position={[0, 0, -0.5]}>
        <shapeGeometry args={[glowInner]} />
        <meshBasicMaterial color={color} transparent opacity={0.16} depthWrite={false} />
      </mesh>

      <mesh>
        <shapeGeometry args={[sunShape]} />
        <meshBasicMaterial color={color} transparent opacity={0.94} />
      </mesh>
    </group>
  );
}

export default HomeSun;
