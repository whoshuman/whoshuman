import { Canvas, useFrame } from "@react-three/fiber";
import { useRouterState } from "@tanstack/react-router";

import skyHome3d from "../../assets/sky-home-3d.png";
import RetrowaveLandscape from "./RetrowaveLandscape";
import { CAMERA_POSES, initialCameraProps, rememberCameraPose } from "./cameraPoses";
import type { CameraPose } from "./cameraPoses";
import { useSceneIntent } from "./sceneIntentStore";
import type { SceneIntent } from "./sceneIntentStore";

// Escena 3D ÚNICA de toda la app. Antes había dos canvas —el de la home y el del fondo del
// resto de pantallas—, así que al navegar se destruía un contexto WebGL y se creaba otro:
// eso obligaba a resubir a la GPU los ~280k triángulos y las texturas de la plaza, y era el
// parpadeo negro que se veía al entrar al lobby. Con un solo canvas montado en AppLayout la
// escena sobrevive al cambio de ruta y el viaje de cámara es continuo de verdad.

// Pose de cada pantalla. El lobby vive dentro de la ciudad —el mismo punto al que llega el
// viaje al pulsar JUGAR— y perfil y contactos son pantallas montadas en la fachada de un
// edificio, a un lado y a otro. El resto se ven desde la vista de reposo.
function poseForRoute(pathname: string): CameraPose {
  if (pathname === "/lobby") return CAMERA_POSES.city;
  if (pathname === "/profile") return CAMERA_POSES.profile;
  if (pathname === "/friends") return CAMERA_POSES.friends;
  return CAMERA_POSES.home;
}

// En la home manda la intención (zoom, giros, picado al coche); fuera, la ruta.
function poseFor(pathname: string, intent: SceneIntent): CameraPose {
  if (pathname !== "/") return poseForRoute(pathname);
  if (intent.carFocus) return CAMERA_POSES.carFocus;
  if (intent.lookBack) return CAMERA_POSES.team;
  if (intent.lookRight) return CAMERA_POSES.profile;
  if (intent.isZoomed) return CAMERA_POSES.city;
  return CAMERA_POSES.home;
}

// Los giros cortos sobre una fachada van más rápidos que los desplazamientos largos.
const FACADE_ROUTES = new Set(["/profile", "/friends"]);

// Balanceo de la home: la cámara "respira" para que la escena no parezca una foto fija.
// Cuatro frecuencias distintas y muy lentas (periodos de 25 a 50 s) para que el ciclo no
// se pille repitiéndose. El giro pesa más que el desplazamiento a esta distancia, así que
// sus amplitudes son diminutas: 0,005 rad son unos 0,3°.
const SWAY = [
  { speed: 0.21, amount: 0.9 }, // posición X
  { speed: 0.17, amount: 0.5 }, // posición Y
  { speed: 0.13, amount: 0.0035 }, // cabeceo
  { speed: 0.25, amount: 0.005 } // giro
] as const;

function WorldCameraRig({ pathname }: { pathname: string }) {
  useFrame(({ camera, clock }) => {
    const intent = useSceneIntent.getState();
    const target = poseFor(pathname, intent);
    const isFacade = pathname === "/" ? intent.lookRight : FACADE_ROUTES.has(pathname);
    // La vuelta de 180 y el picado al coche son cinemáticos: más lentos a propósito.
    const ease = intent.lookBack || intent.carFocus ? 0.05 : isFacade ? 0.12 : 0.045;

    // Solo en la home. Se suma al DESTINO, no a la cámara: así el propio lerp lo suaviza y
    // el balanceo no pelea con los viajes de cámara ni deja saltos al entrar o salir.
    const t = pathname === "/" ? clock.elapsedTime : 0;
    const wave = (index: number) =>
      t === 0 ? 0 : Math.sin(t * SWAY[index].speed) * SWAY[index].amount;

    camera.position.x += (target.x + wave(0) - camera.position.x) * ease;
    camera.position.y += (target.y + wave(1) - camera.position.y) * ease;
    camera.position.z += (target.z - camera.position.z) * ease;
    camera.rotation.x += (target.rotationX + wave(2) - camera.rotation.x) * ease;
    camera.rotation.y += (target.rotationY + wave(3) - camera.rotation.y) * ease;

    // Se deja constancia de dónde quedó por si el canvas llegara a remontarse (p. ej. tras
    // volver del juego, que sí tiene escena propia).
    rememberCameraPose(camera);
  });

  return null;
}

function WorldScene() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isHome = pathname === "/";
  const carX = useSceneIntent((s) => s.carX);
  const showRoad = useSceneIntent((s) => s.showRoad);

  return (
    <div className="pointer-events-none fixed inset-0 z-0">
      {/* Cielo 2D como capa HTML para no cargar una textura 3D innecesaria. */}
      <img
        src={skyHome3d}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover object-top opacity-80"
      />
      {/* La home deja ver más cielo; el resto de pantallas lo oscurecen para que el
          contenido por encima se lea sin competir con el fondo. */}
      <div
        className={`absolute inset-0 bg-linear-to-b ${
          isHome ? "from-bg/20 via-bg/35 to-bg/80" : "from-bg/40 via-bg/55 to-bg/85"
        }`}
      />

      <Canvas dpr={[1, 1.5]} camera={initialCameraProps()}>
        <WorldCameraRig pathname={pathname} />
        <RetrowaveLandscape showRoadScene={showRoad} carX={carX} />
      </Canvas>
    </div>
  );
}

export default WorldScene;
