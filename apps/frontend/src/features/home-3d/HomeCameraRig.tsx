import { useFrame } from "@react-three/fiber";

type HomeCameraRigProps = {
  isZoomed: boolean;
};

// Interpola la camara entre la vista inicial y el acercamiento hacia la ciudad.
function HomeCameraRig({ isZoomed }: HomeCameraRigProps) {
  useFrame(({ camera }) => {
    // El estado normal deja la ciudad al fondo; el estado zoom avanza hacia ella sin atravesarla.
    const target = isZoomed
      ? { x: 0, y: -24, z: -112, rotationX: -0.1 }
      : { x: 0, y: -18, z: 56, rotationX: -0.22 };

    // Interpolacion suave frame a frame para evitar saltos bruscos al hacer login/volver.
    camera.position.x += (target.x - camera.position.x) * 0.035;
    camera.position.y += (target.y - camera.position.y) * 0.035;
    camera.position.z += (target.z - camera.position.z) * 0.035;
    camera.rotation.x += (target.rotationX - camera.rotation.x) * 0.035;
  });

  return null;
}

export default HomeCameraRig;
