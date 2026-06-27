import { useThree } from "@react-three/fiber";

import { cityBuildings } from "./homeCityData";
import type { NeonPaletteProps } from "./homeSceneTypes";

type HomeCityProps = NeonPaletteProps & {
  colorBase: string;
};

// Ancho aproximado del conjunto de edificios sin escalar (rango x + anchos).
const CITY_BASE_WIDTH = 350;
// Distancia camara -> ciudad y campo de vision vertical de la escena de home.
const CITY_DISTANCE = 356;
const VERTICAL_FOV = 58;

// Ciudad procedural de fondo: volumenes simples, profundidad y detalles neon.
function HomeCity({ colorBase, colorCyan, colorGreen, colorMagenta, colorOrange }: HomeCityProps) {
  const { size } = useThree();

  // Escalamos la ciudad en X segun el aspect ratio para que cubra todo el ancho visible.
  const aspect = size.width / size.height;
  const visibleWidth = 2 * Math.tan((VERTICAL_FOV * Math.PI) / 360) * CITY_DISTANCE * aspect;
  const scaleX = Math.max(1.58, (visibleWidth * 1.05) / CITY_BASE_WIDTH);

  return (
    // La ciudad se coloca muy al fondo; el ancho se adapta al viewport para no dejar huecos.
    <group position={[0, -48, -300]} scale={[scaleX, 1, 1.12]}>
      {cityBuildings.map((building, buildingIndex) => {
        // Rotamos la paleta por edificio para evitar una ciudad plana de un solo color.
        const neonPalette = [colorCyan, colorMagenta, colorOrange, colorGreen];
        const accentColor = neonPalette[buildingIndex % neonPalette.length];
        const secondaryColor = neonPalette[(buildingIndex + 1) % neonPalette.length];
        const tertiaryColor = neonPalette[(buildingIndex + 2) % neonPalette.length];
        // El numero de ventanas depende del tamano del edificio para que el detalle escale solo.
        const windowRows = Math.max(3, Math.floor(building.height / 5.5));
        const windowColumns = Math.max(2, Math.floor(building.width / 3));
        const buildingTop = building.height / 2;
        const buildingFront = building.depth / 2;

        return (
          <group
            key={`${building.x}-${building.z}`}
            position={[building.x, building.height / 2, building.z]}
          >
            {/* Cuerpo solido del edificio. Se mantiene opaco para que la ciudad tenga peso visual. */}
            <mesh>
              <boxGeometry args={[building.width, building.height, building.depth]} />
              <meshBasicMaterial color={colorBase} />
            </mesh>

            {/* Tubos verticales de neon en fachada. */}
            <mesh position={[-building.width / 2 - 0.18, 0, buildingFront + 0.08]}>
              <boxGeometry args={[0.35, building.height * 0.9, 0.4]} />
              <meshBasicMaterial color={accentColor} transparent opacity={0.8} />
            </mesh>

            <mesh position={[building.width / 2 + 0.18, 0, buildingFront + 0.08]}>
              <boxGeometry args={[0.35, building.height * 0.9, 0.4]} />
              <meshBasicMaterial color={secondaryColor} transparent opacity={0.72} />
            </mesh>

            {/* Franjas horizontales para romper la silueta de cajas simples. */}
            <mesh position={[0, buildingTop - building.height * 0.32, buildingFront + 0.14]}>
              <boxGeometry args={[building.width * 0.72, 0.5, 0.3]} />
              <meshBasicMaterial color={tertiaryColor} transparent opacity={0.82} />
            </mesh>

            <mesh position={[0, buildingTop - building.height * 0.58, buildingFront + 0.14]}>
              <boxGeometry args={[building.width * 0.58, 0.42, 0.3]} />
              <meshBasicMaterial color={accentColor} transparent opacity={0.62} />
            </mesh>

            {/* Variantes de tejado para que la skyline no parezca repetida. */}
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

            {/* Ventanas generadas en grid sobre la cara frontal del edificio. */}
            {Array.from({ length: windowRows }).map((_, rowIndex) =>
              Array.from({ length: windowColumns }).map((__, columnIndex) => {
                const windowX =
                  -building.width / 2 + ((columnIndex + 1) * building.width) / (windowColumns + 1);
                const windowY =
                  -building.height / 2 + ((rowIndex + 1) * building.height) / (windowRows + 1);
                const windowColor =
                  neonPalette[(rowIndex + columnIndex + buildingIndex) % neonPalette.length];
                // Apagamos algunas ventanas de forma determinista para evitar ruido aleatorio.
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

export default HomeCity;
