import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useAnimations, useGLTF } from "@react-three/drei";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import { Vector3, type Group } from "three";

// Mismo elenco jugable que la partida (ver CHARACTER_MODEL_URLS en game/gameAssets.ts). No
// se importa de alli a proposito: ese modulo arrastra tambien el trazado del mapa, y este
// widget sale en la home y en el lobby, donde no pinta nada bajarse la manzana.
const CHARACTER_MODEL_URLS = [
  "/models/personajes/neon-vixen.glb",
  "/models/personajes/cubist-warrior.glb",
  "/models/personajes/purple-visor.glb",
  "/models/personajes/pixel-voyager.glb"
];

// Los cuatro modelos comparten estos huesos, y son la forma fiable de encuadrar la cabeza:
// son mallas con esqueleto, y ahi la caja delimitadora del objeto no da medidas de fiar.
const HEAD_BONE = "Head";
const HEAD_TOP_BONE = "head_end";
// Marcador de la cara: da hacia donde mira, sin depender de que el modelo este orientado
// a un eje concreto.
const HEAD_FRONT_BONE = "headfront";

function HeadModel({ url }: { url: string }) {
  const { scene, animations } = useGLTF(url);
  const groupRef = useRef<Group>(null);
  const { camera } = useThree();

  // Un clon propio, nunca el objeto cacheado por useGLTF: al desmontar, R3F libera los
  // recursos GPU de lo que cuelga de la escena, y con el original eso deja el modelo en
  // blanco la siguiente vez que se monta (p. ej. al volver de editar perfil).
  // SkeletonUtils.clone es el unico clon que reengancha el esqueleto: un clone() normal
  // duplica los huesos pero deja la malla atada a los originales, y se queda en T-pose.
  const model = useMemo(() => cloneSkeleton(scene), [scene]);

  // El mixer se ata al clon EN SI, no al grupo que lo envuelve: asi las pistas resuelven
  // sus huesos sobre los objetos que de verdad estan en pantalla. Atado al grupo, la
  // animacion podia quedar sin enganchar y el personaje se quedaba en T-pose.
  const { actions } = useAnimations(animations, model);

  // Sin reproducir nada, el modelo se queda en la T-pose del rig. `idle` es la postura de
  // reposo que ya traen los cuatro personajes (la misma que usa la partida).
  useEffect(() => {
    const idle = actions.idle;
    if (!idle) return;
    idle.reset().fadeIn(0.4).play();
    return () => {
      idle.stop();
    };
  }, [actions]);

  // Encuadre: la camara se coloca delante de la cara, a una distancia proporcional al
  // tamaño real de la cabeza de ese modelo.
  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    group.updateWorldMatrix(true, true);

    const head = group.getObjectByName(HEAD_BONE);
    const headTop = group.getObjectByName(HEAD_TOP_BONE);
    const headFront = group.getObjectByName(HEAD_FRONT_BONE);
    // Sin los huesos esperados se deja la camara por defecto (plano general) antes que
    // arriesgarse a apuntar a ninguna parte.
    if (!head || !headTop || !headFront) return;

    const headPosition = head.getWorldPosition(new Vector3());
    const topPosition = headTop.getWorldPosition(new Vector3());
    const frontPosition = headFront.getWorldPosition(new Vector3());

    const headHeight = Math.max(headPosition.distanceTo(topPosition), 0.001);
    // Punto de mira: entre la base del craneo y la coronilla (el hueso Head esta al cuello).
    const target = headPosition.clone().lerp(topPosition, 0.45);

    // Direccion de la cara, aplanada: la camara queda a la altura de los ojos, sin picado.
    const forward = frontPosition.clone().sub(headPosition);
    forward.y = 0;
    if (forward.lengthSq() < 1e-6) forward.set(0, 0, 1);
    forward.normalize();

    camera.position.copy(target).addScaledVector(forward, headHeight * 4.2);
    camera.lookAt(target);
    camera.updateProjectionMatrix();
  }, [camera, model]);

  // Mira a los lados con recorrido corto: que se sienta vivo sin distraer dentro de una
  // ficha tan pequeña. Se gira el grupo propio, no los huesos, para no pelearse con la
  // animacion de reposo (el mixer solo toca huesos con nombre, nunca este grupo).
  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y = Math.sin(clock.elapsedTime * 0.7) * 0.3;
  });

  return (
    <group ref={groupRef}>
      {/* dispose={null}: el clon comparte geometria y material con el original cacheado,
          asi que liberarlos al desmontar dejaria en blanco a la siguiente ficha. */}
      <primitive object={model} dispose={null} />
    </group>
  );
}

function HeadCanvas({ url }: { url: string }) {
  // Suspende aqui, FUERA del canvas, para que el respaldo de iniciales se vea en el DOM
  // mientras descarga el modelo (dentro del canvas, un fallback no puede pintar HTML).
  useGLTF(url);

  return (
    // offsetSize mide con offsetWidth/offsetHeight en vez de getBoundingClientRect. La ficha
    // del lobby entra con la animacion crt-on, que arranca en scaleY(0.005): el rect incluye
    // las transformaciones de los ancestros, asi que el canvas se media casi a cero y se
    // quedaba ahi (un transform del padre no dispara el ResizeObserver, asi que nunca se
    // volvia a medir). Por eso el retrato solo aparecia si el modelo tardaba mas que la
    // animacion, y recargar dentro del lobby "lo arreglaba".
    <Canvas dpr={[1, 1.5]} camera={{ fov: 26 }} gl={{ alpha: true }} resize={{ offsetSize: true }}>
      {/* Luz generosa y desde varios lados: la camara orbita con el giro de la cabeza. */}
      <ambientLight intensity={2.2} />
      <directionalLight position={[2, 3, 4]} intensity={2.4} />
      <directionalLight position={[-3, 1, 2]} intensity={1.2} />
      <directionalLight position={[0, 2, -3]} intensity={0.8} />
      <HeadModel url={url} />
    </Canvas>
  );
}

// Retrato 3D de un miembro aleatorio del elenco, como avatar por defecto de las unidades
// sin foto propia. Uno distinto cada vez que se monta la ficha.
function ProfileAvatarHead({ initials }: { initials: string }) {
  const url = useMemo(
    () => CHARACTER_MODEL_URLS[Math.floor(Math.random() * CHARACTER_MODEL_URLS.length)],
    []
  );

  const fallback = (
    <span className="flex h-full w-full items-center justify-center font-display text-3xl font-black text-neon-cyan sm:text-4xl">
      {initials}
    </span>
  );

  return (
    <div className="h-full w-full">
      <Suspense fallback={fallback}>
        <HeadCanvas url={url} />
      </Suspense>
    </div>
  );
}

export default ProfileAvatarHead;
