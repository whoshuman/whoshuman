import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { Shape } from "three";
import type { Group } from "three";

type HomeSceneProps = {
  isZoomed: boolean;
};

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

type HomeCameraRigProps = {
  isZoomed: boolean;
};

// Interpola la camara entre la vista inicial y el acercamiento hacia la ciudad.
function HomeCameraRig({ isZoomed }: HomeCameraRigProps) {
  useFrame(({ camera }) => {
    const target = isZoomed
      ? { x: 0, y: -24, z: -112, rotationX: -0.1 }
      : { x: 0, y: -18, z: 56, rotationX: -0.22 };

    camera.position.x += (target.x - camera.position.x) * 0.035;
    camera.position.y += (target.y - camera.position.y) * 0.035;
    camera.position.z += (target.z - camera.position.z) * 0.035;
    camera.rotation.x += (target.rotationX - camera.rotation.x) * 0.035;
  });

  return null;
}

type HomeSunProps = {
  color: string;
};

function createUpperHalfCircle(radius: number) {
  const shape = new Shape();

  shape.moveTo(-radius, 0);
  shape.absarc(0, 0, radius, Math.PI, 0, true);
  shape.lineTo(-radius, 0);

  return shape;
}

// Crea un sol recortado en semicircunferencia para que no aparezca bajo la ciudad.
function HomeSun({ color }: HomeSunProps) {
  const glowOuter = useMemo(() => createUpperHalfCircle(74), []);
  const glowInner = useMemo(() => createUpperHalfCircle(62), []);
  const sunShape = useMemo(() => createUpperHalfCircle(50), []);

  return (
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

type CityBuilding = {
  x: number;
  z: number;
  width: number;
  height: number;
  depth: number;
  roof: "flat" | "antenna" | "spire" | "sign";
};

type HomeCityProps = {
  colorBase: string;
  colorCyan: string;
  colorGreen: string;
  colorMagenta: string;
  colorOrange: string;
};

const cityBuildings: CityBuilding[] = [
  { x: -154, z: -34, width: 8, height: 20, depth: 9, roof: "antenna" },
  { x: -138, z: -26, width: 8, height: 20, depth: 9, roof: "antenna" },
  { x: -124, z: -28, width: 11, height: 28, depth: 10, roof: "flat" },
  { x: -110, z: -38, width: 10, height: 34, depth: 10, roof: "sign" },
  { x: -98, z: -24, width: 9, height: 24, depth: 9, roof: "spire" },
  { x: -86, z: -16, width: 9, height: 28, depth: 10, roof: "antenna" },
  { x: -72, z: -8, width: 10, height: 24, depth: 10, roof: "flat" },
  { x: -58, z: -3, width: 13, height: 38, depth: 12, roof: "sign" },
  { x: -42, z: -7, width: 10, height: 50, depth: 11, roof: "spire" },
  { x: -27, z: -1, width: 15, height: 32, depth: 13, roof: "antenna" },
  { x: -10, z: -8, width: 12, height: 66, depth: 12, roof: "spire" },
  { x: 6, z: -2, width: 16, height: 74, depth: 14, roof: "antenna" },
  { x: 25, z: -9, width: 12, height: 54, depth: 11, roof: "sign" },
  { x: 42, z: -4, width: 14, height: 42, depth: 12, roof: "antenna" },
  { x: 60, z: -10, width: 10, height: 30, depth: 10, roof: "flat" },
  { x: 75, z: -5, width: 9, height: 22, depth: 9, roof: "spire" },
  { x: 88, z: -14, width: 8, height: 32, depth: 9, roof: "antenna" },
  { x: 102, z: -24, width: 10, height: 26, depth: 10, roof: "sign" },
  { x: 116, z: -24, width: 11, height: 36, depth: 11, roof: "antenna" },
  { x: 130, z: -28, width: 9, height: 24, depth: 9, roof: "flat" },
  { x: 144, z: -30, width: 8, height: 30, depth: 9, roof: "spire" },
  { x: 158, z: -38, width: 9, height: 22, depth: 9, roof: "antenna" },
  { x: -78, z: 15, width: 14, height: 20, depth: 14, roof: "flat" },
  { x: -52, z: 12, width: 18, height: 26, depth: 15, roof: "sign" },
  { x: -24, z: 16, width: 20, height: 34, depth: 16, roof: "antenna" },
  { x: 4, z: 14, width: 22, height: 42, depth: 18, roof: "sign" },
  { x: 33, z: 16, width: 18, height: 30, depth: 15, roof: "flat" },
  { x: 58, z: 12, width: 16, height: 24, depth: 14, roof: "antenna" },
  { x: 82, z: 14, width: 12, height: 22, depth: 13, roof: "sign" },
  { x: -112, z: -62, width: 16, height: 18, depth: 15, roof: "flat" },
  { x: -88, z: -58, width: 14, height: 24, depth: 14, roof: "sign" },
  { x: -68, z: -72, width: 18, height: 16, depth: 18, roof: "flat" },
  { x: -36, z: -76, width: 16, height: 22, depth: 17, roof: "antenna" },
  { x: -4, z: -74, width: 20, height: 28, depth: 19, roof: "sign" },
  { x: 30, z: -76, width: 17, height: 20, depth: 17, roof: "flat" },
  { x: 64, z: -72, width: 16, height: 18, depth: 16, roof: "sign" },
  { x: 104, z: -60, width: 15, height: 20, depth: 15, roof: "flat" },
  { x: 126, z: -66, width: 13, height: 26, depth: 14, roof: "antenna" }
];

// Ciudad procedural de fondo: volumenes simples, profundidad y detalles neon.
function HomeCity({ colorBase, colorCyan, colorGreen, colorMagenta, colorOrange }: HomeCityProps) {
  return (
    <group position={[0, -48, -300]} scale={[1.58, 1, 1.12]}>
      {cityBuildings.map((building, buildingIndex) => {
        const neonPalette = [colorCyan, colorMagenta, colorOrange, colorGreen];
        const accentColor = neonPalette[buildingIndex % neonPalette.length];
        const secondaryColor = neonPalette[(buildingIndex + 1) % neonPalette.length];
        const tertiaryColor = neonPalette[(buildingIndex + 2) % neonPalette.length];
        const windowRows = Math.max(3, Math.floor(building.height / 5.5));
        const windowColumns = Math.max(2, Math.floor(building.width / 3));
        const buildingTop = building.height / 2;
        const buildingFront = building.depth / 2;

        return (
          <group
            key={`${building.x}-${building.z}`}
            position={[building.x, building.height / 2, building.z]}
          >
            <mesh>
              <boxGeometry args={[building.width, building.height, building.depth]} />
              <meshBasicMaterial color={colorBase} />
            </mesh>

            <mesh position={[-building.width / 2 - 0.18, 0, buildingFront + 0.08]}>
              <boxGeometry args={[0.35, building.height * 0.9, 0.4]} />
              <meshBasicMaterial color={accentColor} transparent opacity={0.8} />
            </mesh>

            <mesh position={[building.width / 2 + 0.18, 0, buildingFront + 0.08]}>
              <boxGeometry args={[0.35, building.height * 0.9, 0.4]} />
              <meshBasicMaterial color={secondaryColor} transparent opacity={0.72} />
            </mesh>

            <mesh position={[0, buildingTop - building.height * 0.32, buildingFront + 0.14]}>
              <boxGeometry args={[building.width * 0.72, 0.5, 0.3]} />
              <meshBasicMaterial color={tertiaryColor} transparent opacity={0.82} />
            </mesh>

            <mesh position={[0, buildingTop - building.height * 0.58, buildingFront + 0.14]}>
              <boxGeometry args={[building.width * 0.58, 0.42, 0.3]} />
              <meshBasicMaterial color={accentColor} transparent opacity={0.62} />
            </mesh>

            {building.roof === "antenna" && (
              <>
                <mesh position={[0, buildingTop + 4, 0]}>
                  <boxGeometry args={[0.35, 8, 0.35]} />
                  <meshBasicMaterial color={accentColor} transparent opacity={0.8} />
                </mesh>
                <mesh position={[2.2, buildingTop + 2.8, 0]}>
                  <boxGeometry args={[0.25, 5.6, 0.25]} />
                  <meshBasicMaterial color={secondaryColor} transparent opacity={0.65} />
                </mesh>
              </>
            )}

            {building.roof === "spire" && (
              <mesh position={[0, buildingTop + 3.2, 0]}>
                <coneGeometry args={[building.width * 0.28, 6.4, 4]} />
                <meshBasicMaterial color={accentColor} transparent opacity={0.58} />
              </mesh>
            )}

            {building.roof === "sign" && (
              <mesh position={[0, buildingTop + 2.4, buildingFront + 0.45]}>
                <boxGeometry args={[building.width * 0.72, 2.4, 0.5]} />
                <meshBasicMaterial color={secondaryColor} transparent opacity={0.72} />
              </mesh>
            )}

            {Array.from({ length: windowRows }).map((_, rowIndex) =>
              Array.from({ length: windowColumns }).map((__, columnIndex) => {
                const windowX =
                  -building.width / 2 + ((columnIndex + 1) * building.width) / (windowColumns + 1);
                const windowY =
                  -building.height / 2 + ((rowIndex + 1) * building.height) / (windowRows + 1);
                const windowColor =
                  neonPalette[(rowIndex + columnIndex + buildingIndex) % neonPalette.length];
                const isLit = (rowIndex + columnIndex + buildingIndex) % 3 !== 0;

                return (
                  <mesh
                    key={`${rowIndex}-${columnIndex}`}
                    position={[windowX, windowY, buildingFront + 0.18]}
                  >
                    <boxGeometry args={[0.68, 0.42, 0.2]} />
                    <meshBasicMaterial
                      color={windowColor}
                      transparent
                      opacity={isLit ? 0.9 : 0.22}
                    />
                  </mesh>
                );
              })
            )}
          </group>
        );
      })}
    </group>
  );
}

type HomeCityTrafficProps = {
  colorCyan: string;
  colorGreen: string;
  colorMagenta: string;
  colorOrange: string;
};

const cityParticles = [
  { x: -92, y: 16, z: -132, colorIndex: 3 },
  { x: -68, y: 22, z: -147, colorIndex: 0 },
  { x: -52, y: 38, z: -156, colorIndex: 1 },
  { x: -48, y: 68, z: -174, colorIndex: 0 },
  { x: -36, y: 18, z: -141, colorIndex: 2 },
  { x: -18, y: 52, z: -160, colorIndex: 3 },
  { x: -12, y: 28, z: -130, colorIndex: 1 },
  { x: 0, y: 30, z: -145, colorIndex: 0 },
  { x: 18, y: 62, z: -158, colorIndex: 1 },
  { x: 22, y: 18, z: -134, colorIndex: 3 },
  { x: 34, y: 24, z: -142, colorIndex: 2 },
  { x: 52, y: 46, z: -154, colorIndex: 3 },
  { x: 62, y: 70, z: -178, colorIndex: 2 },
  { x: 70, y: 28, z: -149, colorIndex: 0 },
  { x: 86, y: 40, z: -162, colorIndex: 1 },
  { x: 96, y: 20, z: -136, colorIndex: 2 }
];

const flyingVehicles = [
  {
    y: 13,
    z: -126,
    speed: 0.34,
    phase: 0.1,
    radiusX: 170,
    radiusZ: 18,
    verticalPhase: 0.4,
    verticalRange: 4.4,
    colorIndex: 0,
    size: 4.2
  },
  {
    y: 21,
    z: -138,
    speed: 0.28,
    phase: 1.4,
    radiusX: 198,
    radiusZ: 22,
    verticalPhase: 2.1,
    verticalRange: 5.2,
    colorIndex: 1,
    size: 5.5
  },
  {
    y: 31,
    z: -146,
    speed: -0.26,
    phase: 2.6,
    radiusX: 176,
    radiusZ: 20,
    verticalPhase: 3.2,
    verticalRange: 3.8,
    colorIndex: 2,
    size: 4.8
  },
  {
    y: 42,
    z: -154,
    speed: -0.24,
    phase: 3.8,
    radiusX: 212,
    radiusZ: 26,
    verticalPhase: 0.9,
    verticalRange: 6,
    colorIndex: 3,
    size: 6.2
  },
  {
    y: 54,
    z: -165,
    speed: 0.22,
    phase: 5.1,
    radiusX: 158,
    radiusZ: 24,
    verticalPhase: 4.6,
    verticalRange: 4.8,
    colorIndex: 0,
    size: 5
  },
  {
    y: 66,
    z: -178,
    speed: -0.18,
    phase: 0.8,
    radiusX: 188,
    radiusZ: 30,
    verticalPhase: 1.7,
    verticalRange: 5.6,
    colorIndex: 2,
    size: 3.8
  },
  {
    y: 74,
    z: -188,
    speed: 0.16,
    phase: 4.4,
    radiusX: 140,
    radiusZ: 22,
    verticalPhase: 5.3,
    verticalRange: 4.2,
    colorIndex: 1,
    size: 3.4
  },
  {
    y: 30,
    z: -202,
    speed: 0.14,
    phase: 2.9,
    radiusX: 225,
    radiusZ: 34,
    verticalPhase: 3.9,
    verticalRange: 5,
    colorIndex: 3,
    size: 4.4
  },
  {
    y: 58,
    z: -116,
    speed: -0.2,
    phase: 5.7,
    radiusX: 205,
    radiusZ: 18,
    verticalPhase: 1.1,
    verticalRange: 6.2,
    colorIndex: 0,
    size: 4
  }
];

// Anade vida a la ciudad con particulas y pequenos vehiculos luminosos.
function HomeCityTraffic({
  colorCyan,
  colorGreen,
  colorMagenta,
  colorOrange
}: HomeCityTrafficProps) {
  const vehiclesRef = useRef<Group>(null);
  const neonPalette = [colorCyan, colorMagenta, colorOrange, colorGreen];

  useFrame(({ clock }) => {
    const elapsedTime = clock.getElapsedTime();

    vehiclesRef.current?.children.forEach((vehicle, index) => {
      const vehicleConfig = flyingVehicles[index];
      const angle = vehicleConfig.phase + elapsedTime * vehicleConfig.speed;

      vehicle.position.x = Math.cos(angle) * vehicleConfig.radiusX;
      vehicle.position.z = vehicleConfig.z + Math.sin(angle) * vehicleConfig.radiusZ;
      vehicle.position.y =
        vehicleConfig.y +
        Math.sin(angle * 1.8 + vehicleConfig.verticalPhase) * vehicleConfig.verticalRange +
        Math.sin(elapsedTime * 0.7 + vehicleConfig.verticalPhase) * 1.1;
      vehicle.rotation.y =
        vehicleConfig.speed > 0 ? -Math.sin(angle) * 0.35 : Math.sin(angle) * 0.35;
    });
  });

  return (
    <group position={[0, -48, -145]}>
      {cityParticles.map((particle, index) => (
        <mesh key={index} position={[particle.x, particle.y, particle.z]}>
          <sphereGeometry args={[0.75, 12, 12]} />
          <meshBasicMaterial color={neonPalette[particle.colorIndex]} transparent opacity={0.82} />
        </mesh>
      ))}

      <group ref={vehiclesRef}>
        {flyingVehicles.map((vehicle, index) => {
          const vehicleColor = neonPalette[vehicle.colorIndex];

          return (
            <group
              key={index}
              position={[
                Math.cos(vehicle.phase) * vehicle.radiusX,
                vehicle.y,
                vehicle.z + Math.sin(vehicle.phase) * vehicle.radiusZ
              ]}
            >
              <mesh>
                <boxGeometry args={[vehicle.size, 0.85, 0.85]} />
                <meshBasicMaterial color={vehicleColor} transparent opacity={0.92} />
              </mesh>

              <mesh position={[vehicle.speed > 0 ? -vehicle.size : vehicle.size, 0, 0]}>
                <boxGeometry args={[vehicle.size * 0.85, 0.24, 0.24]} />
                <meshBasicMaterial color={vehicleColor} transparent opacity={0.38} />
              </mesh>
            </group>
          );
        })}
      </group>
    </group>
  );
}

function HomeScene({ isZoomed }: HomeSceneProps) {
  const colorSurface = getCssColor("--color-surface");
  const colorNeonCyan = getCssColor("--color-neon-cyan");
  const colorNeonMagenta = getCssColor("--color-neon-magenta");
  const colorSunOrange = getCssColor("--color-sun-orange");
  const colorSuccess = getCssColor("--color-success");

  return (
    <div className="absolute inset-0">
      <Canvas camera={{ position: [0, -18, 56], rotation: [-0.22, 0, 0], fov: 58 }}>
        <HomeCameraRig isZoomed={isZoomed} />

        {/* La niebla usa un morado muy oscuro para fundirse con el cielo sin crear una franja magenta. */}
        {/* <fog attach="fog" args={["#0b0520", 230, 520]} /> */}

        {/* Capas principales del paisaje retrowave. */}
        <HomeSun color={colorNeonMagenta} />
        <HomeCity
          colorBase={colorSurface}
          colorCyan={colorNeonCyan}
          colorGreen={colorSuccess}
          colorMagenta={colorNeonMagenta}
          colorOrange={colorSunOrange}
        />
        <HomeCityTraffic
          colorCyan={colorNeonCyan}
          colorGreen={colorSuccess}
          colorMagenta={colorNeonMagenta}
          colorOrange={colorSunOrange}
        />
        <HomeGrid colorMain={colorNeonCyan} colorSecondary={colorNeonMagenta} />

        <EffectComposer>
          <Bloom intensity={1.2} luminanceThreshold={0.15} luminanceSmoothing={0.18} mipmapBlur />
        </EffectComposer>
      </Canvas>
    </div>
  );
}

export default HomeScene;
