import { useFrame } from "@react-three/fiber";

type HomeCameraRigProps = {
  isZoomed: boolean;
  // Gira la camara a la derecha para la pantalla de edicion de perfil.
  lookRight?: boolean;
  // Gira la camara 180 grados para la pantalla del equipo (sobre el proyecto).
  lookBack?: boolean;
};

// Interpola la camara entre la vista inicial, el acercamiento, el giro a la derecha
// y la vuelta completa (180 grados) hacia el equipo.
function HomeCameraRig({ isZoomed, lookRight = false, lookBack = false }: HomeCameraRigProps) {
  useFrame(({ camera }) => {
    // Estados: equipo (vuelta), perfil (derecha), lobby (zoom) y home (lejos).
    const target = lookBack
      ? { x: 0, y: -14, z: 56, rotationX: 0, rotationY: -Math.PI }
      : lookRight
        ? { x: 14, y: -21, z: -28, rotationX: -0.16, rotationY: -0.62 }
        : isZoomed
          ? { x: 0, y: -21, z: -28, rotationX: -0.16, rotationY: 0 }
          : { x: 0, y: -18, z: 56, rotationX: -0.22, rotationY: 0 };

    // El giro a la derecha es rapido; la vuelta de 180 es algo mas lenta para verla girar.
    const ease = lookBack ? 0.06 : lookRight ? 0.12 : 0.045;

    camera.position.x += (target.x - camera.position.x) * ease;
    camera.position.y += (target.y - camera.position.y) * ease;
    camera.position.z += (target.z - camera.position.z) * ease;
    camera.rotation.x += (target.rotationX - camera.rotation.x) * ease;
    camera.rotation.y += (target.rotationY - camera.rotation.y) * ease;
  });

  return null;
}

export default HomeCameraRig;
