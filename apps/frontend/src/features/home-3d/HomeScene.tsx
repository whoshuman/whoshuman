import { Canvas } from "@react-three/fiber";

// Lee tokens CSS del design system para usarlos dentro de Three.js.
function getCssColor(variableName: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(variableName).trim();
}

type HomeGridProps = {
  colorMain: string;
  colorSecondary: string;
};

function HomeGrid({ colorMain, colorSecondary }: HomeGridProps) {
  return <gridHelper position={[0, -50, 0]} args={[2000, 200, colorMain, colorSecondary]} />;
}

type HomeHorizonProps = {
  color: string;
  colorCore: string;
};

// Simula la linea luminosa donde la rejilla se pierde en el fondo.
function HomeHorizon({ color, colorCore }: HomeHorizonProps) {
  return (
    <group position={[0, -42, -170]}>
      <mesh>
        <boxGeometry args={[600, 0.55, 1]} />
        <meshBasicMaterial color={colorCore} transparent opacity={1} />
      </mesh>

      <mesh position={[0, 0, -0.2]}>
        <boxGeometry args={[620, 2.4, 1]} />
        <meshBasicMaterial color={color} transparent opacity={0.55} />
      </mesh>

      <mesh position={[0, 0, -0.4]}>
        <boxGeometry args={[660, 6, 1]} />
        <meshBasicMaterial color={color} transparent opacity={0.22} />
      </mesh>
    </group>
  );
}

type HomeSunProps = {
  color: string;
};

// Crea el disco magenta del fondo; las franjas se dibujan como capa separada.
function HomeSun({ color }: HomeSunProps) {
  return (
    <mesh position={[0, 18, -185]}>
      <circleGeometry args={[28, 64]} />
      <meshBasicMaterial color={color} transparent opacity={0.9} />
    </mesh>
  );
}

type HomeSunStripesProps = {
  color: string;
};

// Pinta bandas del color de fondo sobre el sol para conseguir el look retrowave.
function HomeSunStripes({ color }: HomeSunStripesProps) {
  return (
    <group position={[0, 18, -184.8]}>
      {[-10, -5, 0, 5, 10].map((stripeY) => (
        <mesh key={stripeY} position={[0, stripeY, 0]}>
          <boxGeometry args={[60, 1.4, 1]} />
          <meshBasicMaterial color={color} />
        </mesh>
      ))}
    </group>
  );
}

function HomeScene() {
  const colorBg = getCssColor("--color-bg");
  const colorTextMain = getCssColor("--color-text-main");
  const colorNeonCyan = getCssColor("--color-neon-cyan");
  const colorNeonMagenta = getCssColor("--color-neon-magenta");

  return (
    <div className="absolute inset-0">
      <Canvas camera={{ position: [0, 1, 22], rotation: [-0.34, 0, 0], fov: 58 }}>
        {/* Fondo y niebla usan el color base para integrar la escena con la UI. */}
        <color attach="background" args={[colorBg]} />
        <fog attach="fog" args={[colorBg, 120, 260]} />

        {/* Capas principales del paisaje retrowave. */}
        <HomeSun color={colorNeonMagenta} />
        <HomeSunStripes color={colorBg} />
        <HomeHorizon color={colorNeonCyan} colorCore={colorTextMain} />
        <HomeGrid colorMain={colorNeonCyan} colorSecondary={colorNeonMagenta} />
      </Canvas>
    </div>
  );
}

export default HomeScene;
