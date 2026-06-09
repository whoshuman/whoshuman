import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Group } from "three";

import { cityParticles, flyingVehicles } from "./homeTrafficData";
import type { NeonPaletteProps } from "./homeSceneTypes";

// Anade vida a la ciudad con particulas y pequenos vehiculos luminosos.
function HomeCityTraffic({ colorCyan, colorGreen, colorMagenta, colorOrange }: NeonPaletteProps) {
  const vehiclesRef = useRef<Group>(null);
  const neonPalette = [colorCyan, colorMagenta, colorOrange, colorGreen];

  useFrame(({ clock }) => {
    const elapsedTime = clock.getElapsedTime();

    vehiclesRef.current?.children.forEach((vehicle, index) => {
      const vehicleConfig = flyingVehicles[index];
      // Cada vehiculo recorre una orbita propia para no aparecer/desaparecer en linea recta.
      const angle = vehicleConfig.phase + elapsedTime * vehicleConfig.speed;

      vehicle.position.x = Math.cos(angle) * vehicleConfig.radiusX;
      vehicle.position.z = vehicleConfig.z + Math.sin(angle) * vehicleConfig.radiusZ;
      // La oscilacion vertical da sensacion de vuelo y evita trayectorias demasiado mecanicas.
      vehicle.position.y =
        vehicleConfig.y +
        Math.sin(angle * 1.8 + vehicleConfig.verticalPhase) * vehicleConfig.verticalRange +
        Math.sin(elapsedTime * 0.7 + vehicleConfig.verticalPhase) * 1.1;
      vehicle.rotation.y =
        vehicleConfig.speed > 0 ? -Math.sin(angle) * 0.35 : Math.sin(angle) * 0.35;
    });
  });

  return (
    // El grupo se desplaza para quedar alineado con la ciudad lejana.
    <group position={[0, -48, -145]}>
      {/* Puntos de luz estaticos que simulan drones, senales o contaminacion luminica. */}
      {cityParticles.map((particle, index) => (
        <mesh key={index} position={[particle.x, particle.y, particle.z]}>
          <sphereGeometry args={[0.75, 12, 12]} />
          <meshBasicMaterial color={neonPalette[particle.colorIndex]} transparent opacity={0.82} />
        </mesh>
      ))}

      {/* Vehiculos animados; el ref permite actualizar posiciones desde useFrame. */}
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

export default HomeCityTraffic;
