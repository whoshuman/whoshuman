import { useFrame } from "@react-three/fiber";

type HomeCameraRigProps = {
  isZoomed: boolean;
  // Gira la camara a la derecha para la pantalla de edicion de perfil.
  lookRight?: boolean;
  // Gira la camara 180 grados para la pantalla del equipo (sobre el proyecto).
  lookBack?: boolean;
  // Tras el giro, baja a vista cenital (de pajaro) cercana sobre el coche.
  carFocus?: boolean;
};

// Interpola la camara entre la vista inicial, el acercamiento, el giro a la derecha,
// la vuelta completa (180 grados) y el picado cenital sobre el coche.
function HomeCameraRig({
  isZoomed,
  lookRight = false,
  lookBack = false,
  carFocus = false
}: HomeCameraRigProps) {
  useFrame(({ camera }) => {
    // Estados: cenital coche, equipo (vuelta), perfil (derecha), lobby (zoom) y home (lejos).
    const target = carFocus
      ? // Perseguidor algo cenital: detras y por encima del coche, mirando hacia abajo a el.
        // Con rotationY -PI (mira +Z) el picado necesita rotationX POSITIVO para mirar abajo.
        { x: 0, y: -18, z: 104, rotationX: 0.5, rotationY: -Math.PI }
      : lookBack
        ? { x: 0, y: -14, z: 56, rotationX: 0, rotationY: -Math.PI }
        : lookRight
          ? { x: 14, y: -21, z: -28, rotationX: -0.16, rotationY: -0.62 }
          : isZoomed
            ? { x: 0, y: -21, z: -28, rotationX: -0.16, rotationY: 0 }
            : { x: 0, y: -18, z: 56, rotationX: -0.22, rotationY: 0 };

    // Giro derecha rapido; vuelta de 180 y picado al coche algo mas lentos (cinematica).
    const ease = lookBack || carFocus ? 0.05 : lookRight ? 0.12 : 0.045;

    camera.position.x += (target.x - camera.position.x) * ease;
    camera.position.y += (target.y - camera.position.y) * ease;
    camera.position.z += (target.z - camera.position.z) * ease;
    camera.rotation.x += (target.rotationX - camera.rotation.x) * ease;
    camera.rotation.y += (target.rotationY - camera.rotation.y) * ease;
  });

  return null;
}

export default HomeCameraRig;
