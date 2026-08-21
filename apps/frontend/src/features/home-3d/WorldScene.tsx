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
// Cuatro frecuencias distintas y lentas (periodos de 20 a 37 s) para que el ciclo no se
// pille repitiéndose. El giro pesa mucho más que el desplazamiento a esta distancia, así
// que sus amplitudes son pequeñas: 0,013 rad son unos 0,75°.
const SWAY = [
  { speed: 0.26, amount: 2.4 }, // posición X
  { speed: 0.21, amount: 1.3 }, // posición Y
  { speed: 0.17, amount: 0.009 }, // cabeceo
  { speed: 0.31, amount: 0.013 } // giro
] as const;

// Turbulencia del viaje de cámara: mientras la nave se lanza hacia la ciudad (y mientras
// cargan las pantallas del lobby) la imagen tiembla, como en una entrada a toda velocidad.
// A diferencia del balanceo, va en frecuencias altas y se aplica DIRECTAMENTE a la cámara:
// pasarla por el lerp la suavizaría hasta borrarla.
const TURBULENCE = [
  { speed: 11, amount: 0.16 }, // sacudida lateral
  { speed: 14.7, amount: 0.11 }, // sacudida vertical
  { speed: 17.3, amount: 0.0045 }, // cabeceo
  { speed: 13.1, amount: 0.006 } // giro
] as const;

// La turbulencia se deduce de lo que queda de viaje: no hace falta ningún estado extra,
// sacude mientras se viaja y se calma al llegar, que es exactamente el rato en el que
// cargan las ventanas del lobby.
//
// El umbral no es cero porque el balanceo mantiene la cámara permanentemente a un par de
// unidades de su destino: sin él, la home vibraría en reposo. Por debajo de MIN no hay
// turbulencia y en FULL está al máximo.
const TURBULENCE_MIN_DISTANCE = 8;
const TURBULENCE_FULL_DISTANCE = 35;

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

    // Lo que queda de viaje, medido DESPUÉS de mover la cámara: cuanto más lejos del
    // destino, más fuerte la sacudida.
    const remaining = Math.hypot(
      target.x - camera.position.x,
      target.y - camera.position.y,
      target.z - camera.position.z
    );
    const shake = Math.min(
      1,
      Math.max(0, remaining - TURBULENCE_MIN_DISTANCE) /
        (TURBULENCE_FULL_DISTANCE - TURBULENCE_MIN_DISTANCE)
    );
    if (shake > 0.01) {
      const time = clock.elapsedTime;
      const jolt = (index: number) =>
        Math.sin(time * TURBULENCE[index].speed) * TURBULENCE[index].amount * shake;

      camera.position.x += jolt(0);
      camera.position.y += jolt(1);
      camera.rotation.x += jolt(2);
      camera.rotation.y += jolt(3);
    }

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
