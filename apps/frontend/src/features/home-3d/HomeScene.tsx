import { Canvas } from "@react-three/fiber";

function getCssColor(variableName: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(variableName).trim();
}

function HomeScene() {
  const colorBg = getCssColor("--color-bg");
  const colorNeonCyan = getCssColor("--color-neon-cyan");
  const colorNeonMagenta = getCssColor("--color-neon-magenta");
  return (
    <div className="absolute inset-0">
      <Canvas camera={{ position: [0, 4, 9], rotation: [-0.45, 0, 0], fov: 60 }}>
        <color attach="background" args={[colorBg]} />
        <gridHelper args={[120, 80, colorNeonCyan, colorNeonMagenta]} />
      </Canvas>
    </div>
  );
}

export default HomeScene;
