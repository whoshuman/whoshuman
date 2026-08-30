// Poses de camara del paisaje retrowave. Las usa el rig de WorldScene, que es la unica
// escena 3D de la app: cada pantalla tiene su punto de vista y la camara viaja entre ellos
// sin cortar, porque el canvas no se desmonta al cambiar de ruta.

export type CameraPose = {
  x: number;
  y: number;
  z: number;
  rotationX: number;
  rotationY: number;
};

export const CAMERA_POSES = {
  // Vista de reposo de la home: lejos del horizonte, para que el zoom tenga recorrido.
  home: { x: 0, y: -18, z: 56, rotationX: -0.22, rotationY: 0 },
  // Dentro de la ciudad: donde termina el viaje al pulsar JUGAR y donde vive el lobby.
  // La z va emparejada con la posicion de la plaza (ver HomePlaza): alejar una obliga a
  // alargar la otra lo mismo, o el lobby deja de quedar a la altura que le toca.
  city: { x: 0, y: -21, z: -43, rotationX: -0.16, rotationY: 0 },
  // Giro a la derecha: la pantalla de perfil, montada en la fachada de un edificio.
  profile: { x: 14, y: -21, z: -43, rotationX: -0.16, rotationY: -0.62 },
  // Red de contactos: el mismo giro que el perfil pero al otro lado de la calle, en
  // espejo (x y rotationY invertidos).
  friends: { x: -14, y: -21, z: -43, rotationX: -0.16, rotationY: 0.62 },
  // Media vuelta hacia la luna: la pantalla del equipo (sobre el proyecto).
  team: { x: 0, y: -14, z: 56, rotationX: 0, rotationY: -Math.PI },
  // Picado cenital sobre el coche, tras el giro. Con rotationY -PI (mira +Z) el picado
  // necesita rotationX POSITIVO para mirar hacia abajo.
  carFocus: { x: 0, y: -18, z: 86, rotationX: 0.4, rotationY: -Math.PI }
} satisfies Record<string, CameraPose>;

// Ultima pose por la que paso la camara. Las escenas la escriben en cada fotograma y la
// leen al montarse: asi, cambiar de ruta (que destruye un canvas y crea otro) arranca la
// camara nueva donde se quedo la anterior, y el movimiento se ve continuo.
export const lastCameraPose: { current: CameraPose } = { current: { ...CAMERA_POSES.home } };

export function rememberCameraPose(camera: {
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number };
}) {
  lastCameraPose.current = {
    x: camera.position.x,
    y: camera.position.y,
    z: camera.position.z,
    rotationX: camera.rotation.x,
    rotationY: camera.rotation.y
  };
}

// Props de camara inicial para un <Canvas>, arrancando donde quedo la escena anterior.
export function initialCameraProps() {
  const pose = lastCameraPose.current;
  return {
    position: [pose.x, pose.y, pose.z] as [number, number, number],
    rotation: [pose.rotationX, pose.rotationY, 0] as [number, number, number],
    fov: 58,
    // OBLIGATORIO declararlo: react-three-fiber crea su camara con far = 1000, y este
    // paisaje no cabe ahi. El sol vive en z = -1000 y la camara de la home en z = 56, asi
    // que el disco queda a una profundidad de entre 989 y 1049: el plano lejano lo partia
    // por la mitad y solo se dibujaba el 18% de arriba, la pura coronilla. De ahi la
    // sensacion de estar demasiado lejos — literalmente, lo estabamos. A las montanas del
    // fondo les pasaba lo mismo y les recortaba la base.
    //
    // 2000 es el valor por defecto de three.js y deja de sobra: lo mas lejano de la escena
    // (el canto inferior del halo, y las cordilleras laterales vistas desde la pose del
    // coche) ronda 1080.
    far: 2000
  };
}
