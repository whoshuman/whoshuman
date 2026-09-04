import { AdaptiveDpr, Clone, PerformanceMonitor, useGLTF } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import type { GameCollectibleState, GameEntityState } from "@whoshuman/shared-types";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject
} from "react";
import { useTranslation } from "react-i18next";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import HomeMountains from "../../features/home-3d/HomeMountains";
import HomeSun from "../../features/home-3d/HomeSun";
import { getCssColor } from "../../features/home-3d/homeSceneUtils";
import {
  TOUCH_CAMERA_EVENT,
  TOUCH_SEEKER_SHOOT_EVENT,
  type TouchCameraDetail
} from "../input/touchInput";
import { createMapFloorTexture } from "../maps/mapFloorTexture";
import { createSkyDomeTexture } from "../maps/skyDomeTexture";
import neonBlock from "../maps/neon-block.json";
import { MAP_MODEL_BASE, mapPieces } from "../maps/neonBlockLayout";
import {
  CELL_MODEL_URL,
  CHARACTER_MODEL_URLS,
  CHASER_MODEL_URL,
  preloadGameModels
} from "../gameAssets";
import { isTypingInField } from "../../shared/isTypingInField";
import { setSfxLoop, setSfxLoopProximity, stopAllSfxLoops } from "../../shared/sfx";
import { useGameStore } from "../store/gameStore";
import { AIM_LOCK_RADIUS, WORLD_UNITS_TO_METERS, aimTelemetry } from "../systems/aimTelemetry";
import { sampleSeeker, sampleWorld } from "../systems/interpolation";

// COPIA del mapa lógico del servidor (game-service/src/game/maps/neon-block.json).
// El server es la única verdad de colisiones: lo que se pinta aquí debe coincidir
// con lo que él simula. Si backend cambia el mapa, re-copiar el JSON.
const { bounds, obstacles } = neonBlock;
const MAP_W = bounds.maxX - bounds.minX;
const MAP_D = bounds.maxZ - bounds.minZ;
const CENTER_X = (bounds.minX + bounds.maxX) / 2;
const CENTER_Z = (bounds.minZ + bounds.maxZ) / 2;
// El mapa lógico es 2D (AABBs en XZ, alturas de suelo 0-0.77). La altura visual
// de los edificios es solo presentación.
const BUILDING_HEIGHT = 1.4;
const PLAYER_HEIGHT = 0.36;
const MAX_OTHER_ENTITIES = 71; // 64 NPC + hasta 7 jugadores distintos del cliente
const SPRINT_FRAME_COUNT = 8;
// Terreno que se supone que cubre un ciclo del clip "sprint". La animación NO va con
// el reloj: avanza en proporción a lo que el personaje recorre de verdad, así que
// quien va a media velocidad da la mitad de pasos y quien topa con algo se queda con
// los pies quietos en vez de pedalear en el sitio.
// El valor NO es la zancada medida (0.18): con ella el personaje daba 2 ciclos/s a
// velocidad de crucero y parecía ir vitaminado, porque el clip tiene la zancada muy
// corta y necesita muchos ciclos para avanzar. Este 0.384 = npcSpeed(0.36) × la
// duración del clip (1.067s), o sea: a velocidad de crucero se reproduce exactamente
// al ritmo con el que se animó. Los pies patinan algo a cambio de una cadencia
// creíble, y a esta escala (personajes de 0.33 de alto) el patinaje no se aprecia.
const SPRINT_CYCLE_DISTANCE = 0.384;
// Girar sin desplazarse (un NPC desencajándose de otro) también mueve los pies:
// el giro se convierte en distancia equivalente con este radio.
// El clip idle dura 2.03s en los cuatro modelos: 12 fotogramas a 6 fps lo dejan en
// un bucle de 2s, prácticamente su velocidad original.
const IDLE_FRAME_COUNT = 12;
const IDLE_FPS = 6;
// Umbral de "se mueve", al cuadrado. Muy bajo a propósito: las posiciones vienen de
// interpolar snapshots, así que una entidad parada da diferencia exactamente 0 y no
// hay ruido del que protegerse. Con el umbral anterior (1e-6) un NPC rozando una
// pared al 10% de velocidad se clasificaba como quieto y se deslizaba en pose idle.
const MOVEMENT_EPSILON_SQ = 1e-8;
// Tope de ciclos por segundo del clip de andar. El jugador va a 3 u/s (8× los NPC) y
// pediría 7.8 ciclos/s: un borrón con solo 8 fotogramas horneados. Se le deja en 2,
// poco más del doble de la cadencia de autor, que se lee como correr sin parecer que
// va acelerado.
const SPRINT_MAX_CYCLES_PER_SECOND = 2;
// Lo que tarda un personaje en pasar de quieto a andando y al revés. Es el paso completo
// (0 a 1 del peso), la mitad para cada tramo del cruce. Más largo se lee como que arranca
// con desgana; más corto vuelve a parecer un salto.
const WALK_BLEND_SECONDS = 0.18;

interface Motion {
  x: number;
  z: number;
  phase: number; // 0..1 dentro del ciclo de caminar, propio de cada entidad
  idleOffset: number; // desfase fijo del idle, para que no respiren todos a la vez
  moving: boolean;
  // 0 = quieto, 1 = andando. Antes esto era el propio `moving`, y al cambiar el personaje
  // saltaba de una zancada a media altura a la pose de reposo en un solo fotograma.
  walkWeight: number;
}

// Reparto del peso entre los dos ciclos. Por encima de la mitad se dibuja en el de andar
// y por debajo en el de quieto; el resto del camino lo cubre la mezcla hacia la pose
// neutra, que es la MISMA en los dos conjuntos. Por eso las dos ramas coinciden en 0.5
// (mezcla completa a esa pose) y el cambio de malla no se ve.
function blendAmount(walkWeight: number): number {
  return walkWeight >= 0.5 ? (1 - walkWeight) * 2 : walkWeight * 2;
}

// Acumula el recorrido de una entidad y avanza su fase de caminar en proporción a
// él. Cada una lleva la suya, así que dos personajes a distinta velocidad pisan a
// distinto ritmo y el que se queda bloqueado deja de mover los pies.
function advanceMotion(
  motions: Map<string, Motion>,
  entity: GameEntityState,
  delta: number
): Motion {
  const previous = motions.get(entity.entityId);
  if (!previous) {
    const first: Motion = {
      x: entity.x,
      z: entity.z,
      // Fase inicial dispersa: si todos arrancasen en 0, la multitud entera pisaría
      // al unísono como un desfile.
      phase: Math.random(),
      idleOffset: Math.random(),
      moving: false,
      walkWeight: 0
    };
    motions.set(entity.entityId, first);
    return first;
  }

  const distanceSq = (entity.x - previous.x) ** 2 + (entity.z - previous.z) ** 2;

  previous.x = entity.x;
  previous.z = entity.z;
  previous.moving = distanceSq > MOVEMENT_EPSILON_SQ;
  if (previous.moving) {
    const travelled = Math.sqrt(distanceSq);
    const step = Math.min(travelled / SPRINT_CYCLE_DISTANCE, SPRINT_MAX_CYCLES_PER_SECOND * delta);
    previous.phase = (previous.phase + step) % 1;
  }
  // El peso viaja hacia su destino en vez de conmutar. De paso hace innecesaria cualquier
  // histéresis sobre `moving`: una entidad que alterne durante un par de fotogramas
  // apenas mueve el peso, así que no se nota.
  const weightStep = delta / WALK_BLEND_SECONDS;
  previous.walkWeight = previous.moving
    ? Math.min(1, previous.walkWeight + weightStep)
    : Math.max(0, previous.walkWeight - weightStep);
  return previous;
}

// Solo hay 8 poses horneadas del ciclo de andar: a la cadencia real eso son 7.5
// fotogramas por segundo y se ven los saltos de una pose a otra. En vez de hornear
// más (memoria y draw calls), cada malla lleva también la pose SIGUIENTE y el shader
// interpola entre ambas según lo avanzada que esté cada instancia en su fotograma.
// Sale fluido a cualquier cadencia y sin una sola geometría de más.
// El avance dentro del fotograma viene por instancia en las mallas instanciadas, y por
// uniform en la del propio jugador, que es una malla suelta. El resto del shader es
// idéntico; la malla suelta simplemente ignora el atributo aMorph de la geometría.
function patchMorphMaterial(
  material: THREE.Material,
  uniforms?: { morph: { value: number }; blend: { value: number } }
): void {
  const declaration = uniforms
    ? "uniform float uMorph;\nuniform float uBlend;\n#define MORPH uMorph\n#define BLEND uBlend"
    : "attribute float aMorph;\nattribute float aBlend;\n#define MORPH aMorph\n#define BLEND aBlend";
  // three.js cachea los programas compilados por los parámetros del material, y dos
  // clones con onBeforeCompile distinto darían la misma clave: reutilizaría el shader
  // del otro. Hoy no chocan porque la clave incluye si la malla es instanciada, pero
  // eso es suerte; declararlo es lo que exige la API.
  material.customProgramCacheKey = () => (uniforms ? "morph-uniform" : "morph-attribute");
  material.onBeforeCompile = (shader) => {
    if (uniforms) {
      shader.uniforms.uMorph = uniforms.morph;
      shader.uniforms.uBlend = uniforms.blend;
    }
    // Dos mezclas encadenadas: primero la pose exacta dentro del ciclo (MORPH, entre este
    // fotograma y el siguiente), y sobre ella el paso al otro ciclo (BLEND, hacia la pose
    // neutra). Con BLEND a 0 no cuesta nada: es la misma cuenta de siempre.
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>\nattribute vec3 nextPosition;\nattribute vec3 nextNormal;\nattribute vec3 restPosition;\nattribute vec3 restNormal;\n${declaration}`
      )
      .replace(
        "#include <beginnormal_vertex>",
        "#include <beginnormal_vertex>\nobjectNormal = normalize(mix(mix(objectNormal, nextNormal, MORPH), restNormal, BLEND));"
      )
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\ntransformed = mix(mix(transformed, nextPosition, MORPH), restPosition, BLEND);"
      );
  };
}

// Empareja cada pose con la siguiente (la última con la primera, que el ciclo cierra).
// Comparte los BufferAttribute de las horneadas en vez de copiarlos: lo único nuevo es
// el atributo por instancia con su avance dentro del fotograma.
function buildMorphSet(
  frames: THREE.BufferGeometry[],
  rest: THREE.BufferGeometry
): THREE.BufferGeometry[] {
  return frames.map((frame, index) => {
    const next = frames[(index + 1) % frames.length];
    const geometry = new THREE.BufferGeometry();
    geometry.setIndex(frame.getIndex());
    for (const name of ["position", "normal", "uv"]) {
      const attribute = frame.getAttribute(name);
      if (attribute) geometry.setAttribute(name, attribute);
    }
    geometry.setAttribute("nextPosition", next.getAttribute("position"));
    geometry.setAttribute("nextNormal", next.getAttribute("normal"));
    // Pose neutra por la que pasa el cambio de ciclo. Es el MISMO atributo para los dos
    // conjuntos y para todos sus fotogramas: no ocupa memoria nueva en la GPU, y que sea
    // el mismo destino en ambos lados es justo lo que hace que el cruce case.
    geometry.setAttribute("restPosition", rest.getAttribute("position"));
    geometry.setAttribute("restNormal", rest.getAttribute("normal"));
    geometry.setAttribute(
      "aMorph",
      new THREE.InstancedBufferAttribute(new Float32Array(MAX_OTHER_ENTITIES), 1)
    );
    geometry.setAttribute(
      "aBlend",
      new THREE.InstancedBufferAttribute(new Float32Array(MAX_OTHER_ENTITIES), 1)
    );
    // El bulto no cambia entre poses vecinas; reusarla evita recalcularla por fotograma.
    geometry.boundingSphere = frame.boundingSphere;
    return geometry;
  });
}
// Los modelos miden ~1.69 unidades de alto; esto los deja en ~0.33, la altura que
// tenían los personajes anteriores respecto al mapa.
const CHARACTER_SCALE = 0.194;
const SEEKER_AIM_DISTANCE = Math.max(MAP_W, MAP_D) * 0.7;
const SEEKER_OVERVIEW_DISTANCE = Math.max(MAP_W, MAP_D) * 0.95;
// Altura de la órbita sobre el horizonte. Antes no era un parámetro: salía de la
// posición inicial del Canvas (~28°), que dejaba la vista casi en picado sobre los
// tejados. Bajarla acerca la cámara al suelo y mete la nave y el horizonte en cuadro.
const SEEKER_OVERVIEW_PITCH = 0.38; // ~22°
const SEEKER_AIM_SENSITIVITY = 0.002;
// Desplazamiento maximo que se acepta de un solo evento de raton, en pixeles. A la
// sensibilidad de arriba son ~14 grados de golpe: de sobra para cualquier gesto real, y
// corta los saltos que mete el navegador al recolocar el cursor.
const AIM_MAX_STEP_PX = 120;
// Lo que tarda la cámara en entrar y salir de la mira. Muy corto a propósito: es un
// golpe de zoom, no un viaje. Debe ir acorde con la animación scope-flash del CSS.
const AIM_TRANSITION_SECONDS = 0.16;
// Cada cuánto se refrescan las cifras del visor. A 60 Hz los dígitos bailan y no hay
// quien los lea; ~12 Hz se ve vivo y legible.
const SCOPE_REFRESH_MS = 80;
const TOUCH_CAMERA_SPEED = 1.8;
const TOUCH_SEEKER_AIM_SPEED = 0.65;
const HIDER_CAMERA_DISTANCE = 1.8;
// Lo que se queda la cámara por delante de la fachada contra la que choca. El plano
// cercano del canvas está a 0.1: pegada al muro, lo recorta y se ve el interior igual.
const WALL_MARGIN = 0.15;
// Cuando el hueco hasta el muro no da ni para el margen fijo, el retranqueo pasa a ser
// esta fracción del hueco. Un suelo fijo NO vale: con la pared a 0.10 y un mínimo de
// 0.45, el mínimo gana y devuelve la cámara al interior del edificio, que es justo lo
// que se venía a arreglar.
const WALL_MARGIN_RATIO = 0.8;
// Único suelo duro, y solo para que la cámara no caiga exactamente sobre la cabeza: a
// distancia 0, lookAt se queda sin dirección y la orientación sale NaN.
const MIN_CAMERA_DISTANCE = 0.02;
// Por debajo de esto la cámara está dentro del propio personaje y se le ve la cabeza por
// dentro. Se oculta, como hace cualquier tercera persona al apretarla contra una pared.
const SELF_HIDE_DISTANCE = 0.5;

// El modelo mide 0.12 de alto; x1.0 lo deja en ~0.12, algo menos de un tercio de personaje.
// A 1.7 abultaban demasiado y competían con los personajes en la lectura de la escena.
const CELL_SCALE = 1.0;
const COLLECTIBLE_BEAM_HEIGHT = 4.8;
const COLLECTIBLE_BEAM_RADIUS = 0.055;
// Lo que dura en pantalla una célula ya recogida. Corto a propósito: es el remate de un
// gesto, no una cinemática, y el jugador sigue corriendo mientras.
const PICKUP_MS = 450;
// Lo que se eleva al recogerse. Con personajes de 0.33 de alto, 0.4 la saca por encima
// de la cabeza sin que parezca que sale disparada.
const PICKUP_RISE = 0.4;
// El modelo mide 1 unidad de largo; el mapa entero mide ~5, así que a 1:1 sería
// gigante. 0.55 lo deja en algo menos de dos veces la altura de un personaje.
const CHASER_SCALE = 0.55;
// En vista general la nave va delante de la cámara para que el cazador se vea a sí
// mismo. Como el offset es en espacio de cámara, queda siempre en el mismo punto de
// la pantalla por mucho que cambie la inclinación.
// La nave mide 0.55 de largo ya escalada y el fov vertical es 60°, así que a esta
// distancia (1.30) ocupa ~24° de los 60: su borde inferior cae a 28° del centro,
// justo dentro de los 30° que llegan al borde de la pantalla. Acercarla más la
// recortaría por abajo.
const CHASER_SCREEN_FORWARD = 1.25;
// Cuánto vuela por debajo de la cámara. A diferencia del avance, esto es una caída fija
// en vertical del mundo y no se encoge al apuntar: es la única forma de que la nave
// ocupe SIEMPRE el mismo punto del mundo, que es lo que ven los demás jugadores.
const CHASER_SCREEN_DOWN = 0.36;
// De dónde sale el haz para el propio cazador: por detrás y por debajo de la cámara, o
// saldría del punto de vista y no se vería converger en la retícula. Es un apaño de primera
// persona y NO mueve la nave (que a esas alturas está justo en la cámara).
const CHASER_BACK_OFFSET = 1.15;
const CHASER_DOWN_OFFSET = 0.3;
// La nave mide 0.55 de eslora: a menos de media, la cámara ya la tiene encima y hay que
// dejar de dibujarla.
const CHASER_HIDE_DISTANCE = 0.3;
// Aleteo. El modelo es una malla rígida de una pieza (sin huesos, sin animaciones y
// sin las alas como objetos aparte), así que las góndolas se doblan en el vertex
// shader. Miden |x| 0.29-0.48 y las separa del fuselaje un estrechamiento en
// |x| 0.24-0.29: ahí va la bisagra, y el doblez entra progresivamente entre
// RAMP_IN y RAMP_OUT para que no se marque un pliegue en el borde.
const CHASER_WING_HINGE = 0.24;
const CHASER_WING_RAMP_IN = 0.2;
const CHASER_WING_RAMP_OUT = 0.3;
// Alabeo: la nave se tumba hacia el lado al que vira, como un avion. El valor se suaviza
// en el tiempo para que entre y salga solo, sin saltos al pulsar y soltar la tecla.
// Umbral para dar por "en movimiento" la nave ajena (u/s) y alcance en el que se la oye.
const SHIP_AUDIBLE_SPEED = 0.15;
const SHIP_AUDIBLE_RANGE = 9;

const CHASER_BANK_ANGLE = 0.45; // ~26° en pleno viraje
const CHASER_BANK_SPEED = 4.5; // rapidez con la que entra y sale
const CHASER_FLAP_ANGLE = 0.22; // ~13° en la punta
const CHASER_FLAP_SPEED = 6.5; // rad/s → ~1 aleteo por segundo
// Flotación vertical: muy leve y lenta, para que la nave respire en el sitio.
const CHASER_BOB_AMPLITUDE = 0.035; // ciclo completo ≈ 5% de la altura de pantalla
const CHASER_BOB_SPEED = 1.5; // rad/s → un vaivén cada ~4 s
// La nave volaba siempre nivelada, así que con la cámara picando 22° su morro
// apuntaba al horizonte en vez de al mapa. Ahora hereda parte de la inclinación de
// la cámara: a 1 apuntaría exactamente adonde ella mira, y a 0.8 el morro queda algo
// por encima, que es como desciende una nave sobre su objetivo sin parecer que cae.
const CHASER_PITCH_FOLLOW = 0.8;
// Tope para cuando el cazador apunta casi en vertical: sin él la nave se vería de canto.
const CHASER_MAX_PITCH = 0.6; // ~34°
// Mirilla láser. El haz es finísimo (el personaje mide 0.33 de alto) y llega como
// mucho al doble del mapa, por si el cazador apunta al horizonte y nunca toca suelo.
const LASER_RADIUS = 0.006;
const LASER_DOT_RADIUS = 0.028;
const LASER_MAX_LENGTH = Math.max(MAP_W, MAP_D) * 2;

// Una pieza del mapa. Clone y no primitive: hay modelos repetidos (farolas, arboles) y
// primitive moveria siempre el mismo objeto; Clone comparte geometria y material y solo
// duplica los nodos, que es lo barato.
// Escenas cuyo material ya se ha pasado a mate. Va en un WeakSet de modulo y no en
// scene.userData porque escribir dentro del objeto que devuelve useGLTF es mutar un valor
// de React durante el render, y el linter lo rechaza con razon. El WeakSet no retiene nada:
// si la escena se descarta de la cache, la entrada se va con ella.
const matteScenes = new WeakSet<THREE.Object3D>();

// Red de seguridad: si se entra a /game sin pasar por el lobby (recarga, enlace directo),
// nadie ha precargado nada y hay que pedirlo aqui. Por el camino normal esto ya no baja
// nada, porque el lobby lo dejo en cache mientras se llenaba la sala.
preloadGameModels();

function MapPieceModel({ piece }: { piece: (typeof mapPieces)[number] }) {
  const { scene } = useGLTF(MAP_MODEL_BASE + piece.model);

  // Los GLB salen de una IA: la malla tiene normales sucias y, con algo de metalness o
  // roughness baja, cada facetado devuelve un reflejo desparejo que canta muchisimo. Se
  // pasan a mate puro, que perdona esos defectos, y se conserva la textura de color.
  //
  // useGLTF cachea la escena por URL y hay modelos repetidos (farolas, arboles), asi que sin
  // el registro se recorreria la MISMA escena una vez por instancia. Se apunta por escena y
  // no por componente justamente por eso: lo que se normaliza es el objeto compartido.
  useMemo(() => {
    if (matteScenes.has(scene)) return;
    matteScenes.add(scene);

    scene.traverse((object) => {
      const material = (object as THREE.Mesh).material;
      for (const entry of Array.isArray(material) ? material : [material]) {
        if (entry instanceof THREE.MeshStandardMaterial) {
          entry.metalness = 0;
          entry.roughness = 1;
          entry.envMapIntensity = 0;
          entry.needsUpdate = true;
        }
      }
    });
  }, [scene]);

  return (
    <Clone
      object={scene}
      position={[piece.x, piece.groundOffset, piece.z]}
      rotation={[0, piece.rotationY, 0]}
      // scaleZ solo lo trae la losa de calle, que es cuadrada y hay que ajustar a una
      // manzana rectangular; el resto de piezas escalan por igual en los tres ejes.
      scale={[piece.scale, piece.scale, piece.scaleZ ?? piece.scale]}
    />
  );
}

// La manzana: calle, edificios y atrezo, colocados desde el layout generado junto al mapa
// del servidor. Antes era un unico GLB de ciudad entera.
function CityMap() {
  return (
    <group>
      {mapPieces.map((piece, index) => (
        <MapPieceModel key={index} piece={piece} />
      ))}
    </group>
  );
}

// Los AABB siguen siendo la verdad para disparos, pero el GLB aporta la imagen.
function Obstacles() {
  const geometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false
      }),
    []
  );

  return (
    <group>
      {mapPieces.map((piece, index) => {
        const box = piece.collider;
        if (!box) return null;
        const w = box.maxX - box.minX;
        const d = box.maxZ - box.minZ;
        const x = (box.minX + box.maxX) / 2;
        const z = (box.minZ + box.maxZ) / 2;
        // Altura real de la pieza, no una fija: si no, una farola pararia los disparos
        // como si fuese un rascacielos.
        return (
          <group key={index} position={[x, box.height / 2, z]} scale={[w, box.height, d]}>
            <mesh geometry={geometry} material={material} userData={{ blocksShot: true }} />
          </group>
        );
      })}
    </group>
  );
}

// Fondo del mundo: la rejilla neon que se pierde en el horizonte y el sol al fondo, el mismo
// lenguaje visual del menu. Sin esto la manzana flotaba en negro y el mapa se acababa de
// golpe en el borde. Todo va con fog={false}: la niebla de la partida (8..22) es lo que da
// ambiente de cerca, pero se comeria el fondo entero.
function Backdrop() {
  const cyan = useMemo(() => getCssColor("--color-neon-cyan"), []);
  const magenta = useMemo(() => getCssColor("--color-neon-magenta"), []);
  const surface = useMemo(() => getCssColor("--color-surface"), []);

  const sky = useMemo(() => createSkyDomeTexture(), []);

  return (
    <group>
      {/* Cupula de cielo: una esfera enorme vista por dentro (BackSide). Al ser un objeto de
          la escena gira con la camara, a diferencia de la capa HTML que habia antes y que se
          quedaba clavada a la pantalla al girar la vista del cazador. Sin niebla ni escritura
          de profundidad: es el fondo de todo. */}
      <mesh position={[CENTER_X, 0, CENTER_Z]}>
        <sphereGeometry args={[120, 32, 16]} />
        <meshBasicMaterial map={sky} side={THREE.BackSide} fog={false} depthWrite={false} />
      </mesh>

      {/* Suelo infinito bajo la rejilla: tapa el vacio por los huecos de las lineas. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[CENTER_X, -0.06, CENTER_Z]}>
        <planeGeometry args={[160, 160]} />
        <meshBasicMaterial color="#07031a" fog={false} />
      </mesh>
      {/* Rejilla retrowave. 80 divisiones sobre 160 u = una celda por cada 2 u, la misma
          densidad aparente que en el menu a esta escala de mundo. */}
      <gridHelper
        position={[CENTER_X, -0.04, CENTER_Z]}
        args={[160, 80, cyan, "#241a52"]}
        material-fog={false}
        material-transparent
        material-opacity={0.55}
      />
      {/* Sol al fondo. HomeSun esta modelado a escala de menu (disco de 276 u), asi que se
          encoge para este mundo: x0.05 lo deja en ~14 u de ancho a 50 de distancia. */}
      <group position={[CENTER_X, 2.4, CENTER_Z]} scale={0.05}>
        <HomeSun color={magenta} />
      </group>

      {/* Anillo de montañas, las mismas del menu. Tambien vienen a escala de menu (2000 u de
          ancho), asi que van a x0.035: crestas de ~4 u a 30 de distancia, justo por delante
          del sol. Cierran el horizonte por los cuatro lados para que el mundo no se acabe en
          un canto de rejilla se mire hacia donde se mire. */}
      <group position={[CENTER_X, 0, CENTER_Z]} scale={0.035}>
        <HomeMountains fillColor={surface} position={[0, 0, -900]} />
        <HomeMountains fillColor={surface} position={[0, 0, 900]} rotationY={Math.PI} />
        <HomeMountains fillColor={surface} position={[-900, 0, 0]} rotationY={Math.PI / 2} />
        <HomeMountains fillColor={surface} position={[900, 0, 0]} rotationY={-Math.PI / 2} />
      </group>
    </group>
  );
}

// Luz en la punta de cada farola: un foco corto que moja el asfalto a su alrededor y una
// bombilla visible en el remate. Son 7 luces puntuales, que no es gratis (el renderizador
// las evalua por fragmento), pero la manzana es pequeña y es lo que le da vida al suelo.
// El color alterna cian y magenta para que la calle no quede monocroma.
function LamppostLights() {
  const cyan = useMemo(() => getCssColor("--color-neon-cyan"), []);
  const magenta = useMemo(() => getCssColor("--color-neon-magenta"), []);
  const lamps = useMemo(() => mapPieces.filter((p) => p.model === "neon-lamppost.glb"), []);

  return (
    <group>
      {lamps.map((lamp, index) => {
        const color = index % 2 === 0 ? cyan : magenta;
        // El collider guarda la altura real del modelo: la bombilla va justo bajo el remate.
        const top = (lamp.collider?.height ?? 1) * 0.92;

        return (
          <group key={index} position={[lamp.x, top, lamp.z]}>
            {/* distance corta: cada farola ilumina su tramo, no el mapa entero. */}
            <pointLight color={color} intensity={2.6} distance={2.6} decay={2} />
            {/* Bombilla: basica y sin luz propia, para que se vea el origen del foco. */}
            <mesh>
              <sphereGeometry args={[0.045, 10, 10]} />
              <meshBasicMaterial color={color} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

// El suelo de la manzana: un plano con el trazado de calzadas pintado. Sustituye al GLB de
// calle, que al ser un volumen dejaba su superficie por encima del suelo jugable.
function Floor() {
  const cyan = useMemo(() => getCssColor("--color-neon-cyan"), []);
  const magenta = useMemo(() => getCssColor("--color-neon-magenta"), []);
  const texture = useMemo(() => createMapFloorTexture(cyan, magenta), [cyan, magenta]);

  return (
    <group position={[CENTER_X, 0, CENTER_Z]}>
      {/* Va por DEBAJO de la losa de calle (que ocupa de -0.10 a 0): solo se ve si la losa
          no llega a algun canto del area jugable. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.12, 0]}>
        <planeGeometry args={[MAP_W, MAP_D]} />
        <meshBasicMaterial map={texture} color={texture ? "#ffffff" : "#050014"} />
      </mesh>
    </group>
  );
}

interface VanishingCollectible extends GameCollectibleState {
  // Momento en que dejó de llegar en el snapshot, para medir su salida.
  start: number;
}

// Célula activa. El haz solo se enciende cuando hace falta para ubicarla: si ya se ve
// la célula en sí (nada de un edificio por medio) sobra, así que se apaga. El cazador
// es la excepción — los ve todos siempre, le sirve para leer por dónde ha andado la
// multitud sin tener que rastrear cada célula una a una.
function CollectibleMarker({
  item,
  geometry,
  material,
  beamGeometry,
  beamMaterial
}: {
  item: GameCollectibleState;
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  beamGeometry: THREE.BufferGeometry;
  beamMaterial: THREE.Material;
}) {
  const selfRole = useGameStore((state) => state.selfRole);
  const cell = useRef<THREE.Mesh>(null);
  const beam = useRef<THREE.Mesh>(null);
  const direction = useMemo(() => new THREE.Vector3(), []);
  const target = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ camera }, delta) => {
    if (cell.current) {
      cell.current.rotation.y += delta * 1.4;
      cell.current.rotation.x += delta * 0.7;
    }
    if (!beam.current) return;
    if (selfRole === "seeker") {
      beam.current.visible = true;
      return;
    }
    target.set(item.x, item.y, item.z);
    beam.current.visible = beamOccluded(camera.position, target, direction);
  });

  return (
    <group position={[item.x, 0, item.z]}>
      <mesh ref={cell} geometry={geometry} material={material} position={[0, item.y, 0]} />
      <mesh
        ref={beam}
        geometry={beamGeometry}
        material={beamMaterial}
        position={[0, COLLECTIBLE_BEAM_HEIGHT / 2, 0]}
        renderOrder={2}
      />
    </group>
  );
}

// Célula ya recogida. El servidor deja de mandarla y hasta ahora se esfumaba en un
// fotograma; aquí se queda el tiempo justo para rematar el gesto: sube girando cada vez
// más rápido, se agranda y se apaga, mientras su haz se cierra con un último destello.
function VanishingCell({
  item,
  geometry,
  cellMaterial,
  beamGeometry,
  beamMaterial
}: {
  item: VanishingCollectible;
  geometry: THREE.BufferGeometry;
  cellMaterial: THREE.Material;
  beamGeometry: THREE.BufferGeometry;
  beamMaterial: THREE.Material;
}) {
  const cell = useRef<THREE.Mesh>(null);
  const beam = useRef<THREE.Mesh>(null);
  // Materiales propios y no los compartidos: bajarle el alfa al del GLTF apagaría de
  // paso todas las células que siguen en el mapa.
  const materials = useMemo(() => {
    const fading = cellMaterial.clone();
    fading.transparent = true;
    fading.depthWrite = false;
    return { cell: fading, beam: beamMaterial.clone() };
  }, [cellMaterial, beamMaterial]);

  useEffect(
    () => () => {
      materials.cell.dispose();
      materials.beam.dispose();
    },
    [materials]
  );

  useFrame((_, delta) => {
    const progress = Math.min(1, (performance.now() - item.start) / PICKUP_MS);
    // Arranca de golpe y frena al final: ese tirón inicial es lo que se lee como que
    // algo se la lleva, en vez de como que flota hacia arriba.
    const eased = 1 - (1 - progress) ** 3;
    if (cell.current) {
      cell.current.position.y = item.y + PICKUP_RISE * eased;
      cell.current.scale.setScalar(1 + 0.7 * eased);
      // Al giro de reposo se le suma un impulso que se agota con la propia salida.
      cell.current.rotation.y += delta * (1.4 + 9 * (1 - eased));
      cell.current.rotation.x += delta * 0.7;
      // Exponente > 1: aguanta visible casi todo el recorrido y se apaga al final, en
      // vez de desvanecerse desde el primer fotograma.
      materials.cell.opacity = 1 - progress ** 1.6;
    }
    if (beam.current) {
      beam.current.scale.set(1 - eased, 1, 1 - eased);
      materials.beam.opacity = 0.24 + 0.5 * Math.sin(Math.PI * progress);
    }
  });

  return (
    <group position={[item.x, 0, item.z]}>
      <mesh ref={cell} geometry={geometry} material={materials.cell} position={[0, item.y, 0]} />
      <mesh
        ref={beam}
        geometry={beamGeometry}
        material={materials.beam}
        position={[0, COLLECTIBLE_BEAM_HEIGHT / 2, 0]}
        renderOrder={2}
      />
    </group>
  );
}

function Collectibles() {
  const collectibles = useGameStore((state) => state.collectibles);
  const phase = useGameStore((state) => state.round?.phase);
  const [vanishing, setVanishing] = useState<VanishingCollectible[]>([]);
  const previous = useRef<GameCollectibleState[]>([]);
  const { scene } = useGLTF(CELL_MODEL_URL);
  // Una sola geometría y un solo material para las células: el GLB se carga una vez
  // y cada célula es un mesh que los reutiliza.
  const { geometry, material } = useMemo(() => {
    scene.updateMatrixWorld(true);
    let source: THREE.Mesh | null = null;
    scene.traverse((object) => {
      if (!source && (object as THREE.Mesh).isMesh) source = object as THREE.Mesh;
    });
    if (!source) throw new Error("El modelo de célula no tiene malla");
    const mesh = source as THREE.Mesh;
    const cellGeometry = mesh.geometry.clone();
    cellGeometry.applyMatrix4(mesh.matrixWorld);
    cellGeometry.scale(CELL_SCALE, CELL_SCALE, CELL_SCALE);
    // El modelo se apoya en y=0; centrarlo hace que gire sobre sí mismo y no en órbita.
    cellGeometry.computeBoundingBox();
    const center = cellGeometry.boundingBox!.getCenter(new THREE.Vector3());
    cellGeometry.translate(-center.x, -center.y, -center.z);
    cellGeometry.computeBoundingSphere();
    return { geometry: cellGeometry, material: mesh.material as THREE.Material };
  }, [scene]);
  const beamGeometry = useMemo(
    () =>
      new THREE.CylinderGeometry(
        COLLECTIBLE_BEAM_RADIUS,
        COLLECTIBLE_BEAM_RADIUS,
        COLLECTIBLE_BEAM_HEIGHT,
        12
      ),
    []
  );
  const beamMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: getCssColor("--color-neon-cyan"),
        transparent: true,
        opacity: 0.24,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false
      }),
    []
  );

  // Las que dejan de venir en el snapshot es que alguien las ha recogido. Solo se
  // animan en juego: al terminar la ronda o salir de la partida la lista se vacía de
  // golpe, y ahí no hay recogida que rematar — se irían todas a la vez.
  useEffect(() => {
    const present = new Set(collectibles.map((item) => item.collectibleId));
    const gone = previous.current.filter((item) => !present.has(item.collectibleId));
    previous.current = collectibles;
    if (gone.length === 0 || phase !== "playing") return;
    const start = performance.now();
    setVanishing((current) => [...current, ...gone.map((item) => ({ ...item, start }))]);
  }, [collectibles, phase]);

  // Retirada de las ya consumidas. Se hace con un temporizador y no en useFrame: cambiar
  // el estado de React en cada fotograma volvería a montar el árbol 60 veces por segundo.
  useEffect(() => {
    if (vanishing.length === 0) return;
    const timer = setTimeout(() => {
      const cutoff = performance.now() - PICKUP_MS;
      setVanishing((current) => {
        const alive = current.filter((item) => item.start > cutoff);
        // Misma referencia si no sobra ninguna: devolver un array nuevo relanzaría este
        // efecto y con él el temporizador, en bucle.
        return alive.length === current.length ? current : alive;
      });
    }, PICKUP_MS);
    return () => clearTimeout(timer);
  }, [vanishing]);

  // El material de la célula lo gestiona useGLTF; el haz sí pertenece a este componente.
  useEffect(
    () => () => {
      geometry.dispose();
      beamGeometry.dispose();
      beamMaterial.dispose();
    },
    [beamGeometry, beamMaterial, geometry]
  );

  return (
    <>
      {collectibles.map((item) => (
        <CollectibleMarker
          key={item.collectibleId}
          item={item}
          geometry={geometry}
          material={material}
          beamGeometry={beamGeometry}
          beamMaterial={beamMaterial}
        />
      ))}
      {vanishing.map((item) => (
        <VanishingCell
          key={`${item.collectibleId}:${item.start}`}
          item={item}
          geometry={geometry}
          cellMaterial={material}
          beamGeometry={beamGeometry}
          beamMaterial={beamMaterial}
        />
      ))}
    </>
  );
}

// El cliente solo conoce su propia entidad. Todas las demás se renderizan juntas:
// no existe ningún dato que permita distinguir humano de NPC.
function Units() {
  const selfEntityId = useGameStore((s) => s.selfEntityId);
  const selfRole = useGameStore((s) => s.selfRole);
  const aiming = useGameStore((s) => s.aiming);
  const shoot = useGameStore((s) => s.shoot);
  const { camera, gl, scene } = useThree();
  const characterModels = useGLTF(CHARACTER_MODEL_URLS) as Array<{
    scene: THREE.Group;
    animations: THREE.AnimationClip[];
  }>;
  const selfRef = useRef<THREE.Group>(null);
  const selfMeshRef = useRef<THREE.Mesh>(null);
  // También por fotograma, igual que los que andan: si todos los parados comparten
  // pose, la multitud respira al unísono como un pelotón.
  const idleCharacters = useRef<(THREE.InstancedMesh | null)[][]>(
    CHARACTER_MODEL_URLS.map(() => [])
  );
  // [variante][fotograma]: cada fotograma del ciclo es su propia malla, con su
  // geometría fija. Un personaje se dibuja en la que corresponde a SU fase, que es
  // lo que permite que cada uno ande a su ritmo.
  const sprintingCharacters = useRef<(THREE.InstancedMesh | null)[][]>(
    CHARACTER_MODEL_URLS.map(() => [])
  );
  const idleEntityIds = useRef<string[][][]>(
    CHARACTER_MODEL_URLS.map(() => Array.from({ length: IDLE_FRAME_COUNT }, () => []))
  );
  const sprintingEntityIds = useRef<string[][][]>(
    CHARACTER_MODEL_URLS.map(() => Array.from({ length: SPRINT_FRAME_COUNT }, () => []))
  );
  const motions = useRef(new Map<string, Motion>());
  const touchCamera = useRef({ x: 0, y: 0 });
  const hiderCameraYaw = useRef(0);
  const hiderCameraPitch = useRef(0.45);
  const transform = useMemo(() => new THREE.Object3D(), []);
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const aimRay = useMemo(() => new THREE.Vector3(), []);
  const aimOffset = useMemo(() => new THREE.Vector3(), []);
  const cameraDestination = useMemo(() => new THREE.Vector3(), []);
  const cameraTarget = useMemo(() => new THREE.Vector3(), []);
  const cameraDirection = useMemo(() => new THREE.Vector3(), []);
  // Distancia real a la que va la cámara, ya recortada por los muros. Es un ref y no un
  // cálculo suelto porque el retroceso se recupera poco a poco entre fotogramas.
  const hiderCameraDistance = useRef(HIDER_CAMERA_DISTANCE);
  const selfUniformsByVariant = useRef<{ morph: { value: number }; blend: { value: number } }[]>(
    []
  );
  const characterAssets = useMemo(
    () =>
      characterModels.map(({ scene: characterScene, animations }) => {
        const mixer = new THREE.AnimationMixer(characterScene);
        const idle = animations.find((clip) => clip.name === "idle");
        const sprint = animations.find((clip) => clip.name === "sprint");
        const meshes: THREE.Mesh[] = [];
        characterScene.traverse((object) => {
          if ((object as THREE.Mesh).isMesh) meshes.push(object as THREE.Mesh);
        });

        const bakeGeometry = (clip: THREE.AnimationClip | undefined, time: number) => {
          mixer.stopAllAction();
          if (clip) {
            mixer.clipAction(clip).reset().play();
            mixer.setTime(time);
          }
          characterScene.updateMatrixWorld(true);

          const parts = meshes.map((mesh) => {
            const geometry = mesh.geometry.clone();
            if ((mesh as THREE.SkinnedMesh).isSkinnedMesh) {
              const skinnedMesh = mesh as THREE.SkinnedMesh;
              const position = geometry.getAttribute("position");
              const vertex = new THREE.Vector3();
              for (let i = 0; i < position.count; i += 1) {
                skinnedMesh.getVertexPosition(i, vertex).applyMatrix4(mesh.matrixWorld);
                position.setXYZ(i, vertex.x, vertex.y, vertex.z);
              }
            } else {
              geometry.applyMatrix4(mesh.matrixWorld);
            }
            geometry.deleteAttribute("skinIndex");
            geometry.deleteAttribute("skinWeight");
            geometry.deleteAttribute("normal");
            geometry.deleteAttribute("tangent");
            return geometry;
          });
          const geometry = mergeGeometries(parts, false);
          parts.forEach((part) => part.dispose());
          if (!geometry) throw new Error("No se pudo combinar la geometría del personaje");
          geometry.scale(CHARACTER_SCALE, CHARACTER_SCALE, CHARACTER_SCALE);
          geometry.computeVertexNormals();
          geometry.computeBoundingSphere();
          return geometry;
        };
        // Se hornea hasta el fotograma N-1: el instante t=duration repetiría la pose
        // de t=0 y el bucle daría un tirón.
        const idleFrames = Array.from({ length: IDLE_FRAME_COUNT }, (_, frame) =>
          bakeGeometry(idle, ((idle?.duration ?? 0) * frame) / IDLE_FRAME_COUNT)
        );
        const sprintFrames = Array.from({ length: SPRINT_FRAME_COUNT }, (_, frame) =>
          bakeGeometry(sprint, ((sprint?.duration ?? 0) * frame) / SPRINT_FRAME_COUNT)
        );
        mixer.stopAllAction();
        mixer.uncacheRoot(characterScene);

        const sourceMaterial = meshes[0]?.material;
        if (
          !sourceMaterial ||
          Array.isArray(sourceMaterial) ||
          !(sourceMaterial instanceof THREE.MeshStandardMaterial)
        ) {
          throw new Error("Material de personaje no compatible");
        }
        const material = sourceMaterial.clone();
        material.metalness = 0;
        material.roughness = 0.8;
        if (material.map) {
          material.map.colorSpace = THREE.SRGBColorSpace;
          material.map.magFilter = THREE.LinearFilter;
          material.map.minFilter = THREE.LinearMipmapLinearFilter;
          material.map.anisotropy = Math.min(4, gl.capabilities.getMaxAnisotropy());
          material.map.needsUpdate = true;
        }
        patchMorphMaterial(material);
        const selfUniforms = { morph: { value: 0 }, blend: { value: 0 } };
        const selfMaterial = material.clone();
        patchMorphMaterial(selfMaterial, selfUniforms);

        // La pose neutra del cruce es el primer fotograma del idle: los dos conjuntos
        // mezclan hacia ella, así que el salto de un ciclo al otro pasa por un punto
        // común en vez de por dos poses distintas.
        const rest = idleFrames[0];
        return {
          idleGeometries: buildMorphSet(idleFrames, rest),
          sprintGeometries: buildMorphSet(sprintFrames, rest),
          // Las horneadas quedan como dueñas de los datos: las de morfeo solo las
          // referencian, así que se liberan aquí y no allí.
          bakedGeometries: [...idleFrames, ...sprintFrames],
          material,
          selfMaterial,
          selfUniforms
        };
      }),
    [characterModels, gl]
  );
  useEffect(() => {
    selfUniformsByVariant.current = characterAssets.map((asset) => asset.selfUniforms);
    return () => {
      selfUniformsByVariant.current = [];
    };
  }, [characterAssets]);
  useEffect(
    () => () => {
      for (const asset of characterAssets) {
        asset.idleGeometries.forEach((geometry) => geometry.dispose());
        asset.sprintGeometries.forEach((geometry) => geometry.dispose());
        asset.bakedGeometries.forEach((geometry) => geometry.dispose());
        asset.material.dispose();
        asset.selfMaterial.dispose();
      }
    },
    [characterAssets]
  );

  useEffect(() => {
    const updateCamera = (event: Event) => {
      touchCamera.current = (event as CustomEvent<TouchCameraDetail>).detail;
    };
    window.addEventListener(TOUCH_CAMERA_EVENT, updateCamera);
    return () => window.removeEventListener(TOUCH_CAMERA_EVENT, updateCamera);
  }, []);

  useEffect(() => {
    touchCamera.current = { x: 0, y: 0 };
    hiderCameraYaw.current = 0;
    hiderCameraPitch.current = 0.45;
    hiderCameraDistance.current = HIDER_CAMERA_DISTANCE;
  }, [selfRole]);

  useFrame(({ camera, clock }, delta) => {
    const entities = sampleWorld();
    const self = entities.find((entity) => entity.entityId === selfEntityId);
    // Fase global del idle, en ciclos. Cada entidad le suma su desfase propio.
    const idleCycles = (clock.elapsedTime * IDLE_FPS) / IDLE_FRAME_COUNT;

    if (selfRef.current) {
      selfRef.current.visible = selfRole !== "seeker" && !!self;
      if (selfRole !== "seeker" && self) {
        const asset = characterAssets[self.skinId];
        const motion = advanceMotion(motions.current, self, delta);
        if (selfMeshRef.current && asset) {
          selfMeshRef.current.material = asset.selfMaterial;
          const selfUniforms = selfUniformsByVariant.current[self.skinId];
          // Ya no manda `moving` sino el peso: en el tramo intermedio se sigue dibujando
          // en el ciclo que corresponda, pero mezclado hacia la pose neutra.
          if (motion.walkWeight >= 0.5) {
            const exact = motion.phase * SPRINT_FRAME_COUNT;
            const frame = Math.min(SPRINT_FRAME_COUNT - 1, Math.floor(exact));
            selfMeshRef.current.geometry = asset.sprintGeometries[frame];
            if (selfUniforms) selfUniforms.morph.value = exact - frame;
          } else {
            const exact = ((idleCycles + motion.idleOffset) % 1) * IDLE_FRAME_COUNT;
            const frame = Math.min(IDLE_FRAME_COUNT - 1, Math.floor(exact));
            selfMeshRef.current.geometry = asset.idleGeometries[frame];
            if (selfUniforms) selfUniforms.morph.value = exact - frame;
          }
          if (selfUniforms) selfUniforms.blend.value = blendAmount(motion.walkWeight);
        }
        selfRef.current.position.set(self.x, self.y, self.z);
        selfRef.current.rotation.y = self.rotationY;
        hiderCameraYaw.current += touchCamera.current.x * TOUCH_CAMERA_SPEED * delta;
        hiderCameraPitch.current = THREE.MathUtils.clamp(
          hiderCameraPitch.current + touchCamera.current.y * TOUCH_CAMERA_SPEED * delta,
          0.12,
          1.05
        );
        const yaw = self.rotationY + hiderCameraYaw.current;
        cameraTarget.set(self.x, self.y + PLAYER_HEIGHT, self.z);
        // Hacia dónde se iría la cámara si no hubiera nada en medio. Sale ya normalizado:
        // el horizontal va escalado por cos(inclinación) y el vertical por su seno.
        const horizontal = Math.cos(hiderCameraPitch.current);
        cameraDirection.set(
          -Math.sin(yaw) * horizontal,
          Math.sin(hiderCameraPitch.current),
          -Math.cos(yaw) * horizontal
        );
        // Hasta dónde puede retroceder sin atravesar una fachada.
        const allowed = cameraClearance(cameraTarget, cameraDirection, HIDER_CAMERA_DISTANCE);
        const previousDistance = hiderCameraDistance.current;
        // Entrar es urgente y salir no: al pegarse a un muro hay que recortar en el acto,
        // pero al despegarse conviene volver despacio, o cada esquina da un tirón. El
        // factor exponencial mantiene ese ritmo igual a cualquier tasa de fotogramas.
        hiderCameraDistance.current =
          allowed < previousDistance
            ? allowed
            : THREE.MathUtils.lerp(previousDistance, allowed, 1 - Math.exp(-4 * delta));
        cameraDestination
          .copy(cameraTarget)
          .addScaledVector(cameraDirection, hiderCameraDistance.current);
        // Apretada contra un muro, la cámara acaba dentro del personaje: se oculta en vez
        // de enseñar su cabeza por dentro.
        selfRef.current.visible = hiderCameraDistance.current > SELF_HIDE_DISTANCE;
        // Y el propio viaje de la cámara tampoco puede ir a su paso de siempre cuando la
        // están empujando hacia dentro: para cuando llegase, ya se habría visto el
        // interior del edificio.
        const pushedIn =
          camera.position.distanceTo(cameraTarget) > hiderCameraDistance.current + WALL_MARGIN;
        camera.position.lerp(cameraDestination, pushedIn ? 0.45 : 0.08);
        camera.lookAt(cameraTarget);
      }
    }

    const others = entities.filter((entity) => entity.entityId !== selfEntityId);
    const count = Math.min(others.length, MAX_OTHER_ENTITIES);
    const idleCounts = CHARACTER_MODEL_URLS.map(() =>
      Array.from({ length: IDLE_FRAME_COUNT }, () => 0)
    );
    const sprintingCounts = CHARACTER_MODEL_URLS.map(() =>
      Array.from({ length: SPRINT_FRAME_COUNT }, () => 0)
    );
    for (const frames of idleEntityIds.current) for (const ids of frames) ids.length = 0;
    for (const frames of sprintingEntityIds.current) for (const ids of frames) ids.length = 0;

    // ¿Hay alguien bajo la retícula? Se resuelve dentro del recorrido que ya se hace de
    // todas las entidades, midiendo su distancia al rayo de puntería. Trazar un rayo
    // contra la escena cada fotograma costaría mucho más para el mismo dato.
    const checkingAim = selfRole === "seeker" && aiming;
    if (checkingAim) camera.getWorldDirection(aimRay);
    let locked = false;

    for (let i = 0; i < count; i += 1) {
      const entity = others[i];
      const variant = entity.skinId;
      const motion = advanceMotion(motions.current, entity, delta);

      if (checkingAim && !locked) {
        // A media altura del personaje, que es donde apunta quien dispara al cuerpo.
        aimOffset.set(entity.x, entity.y + PLAYER_HEIGHT / 2, entity.z).sub(camera.position);
        const along = aimOffset.dot(aimRay);
        // Detrás de la cámara o más lejos que el impacto del haz: tapado, no cuenta.
        // El láser publica la distancia después de este bucle, así que en el primer
        // fotograma aún vale 0: ahí se acepta cualquiera y se afina al siguiente.
        const reach = aimTelemetry.distance > 0 ? aimTelemetry.distance : Infinity;
        if (along > 0 && along <= reach) {
          locked = aimOffset.addScaledVector(aimRay, -along).lengthSq() < AIM_LOCK_RADIUS ** 2;
        }
      }

      // Cada uno a la malla del fotograma que le toca por su propia fase, y lo que le
      // sobra de ese fotograma va al atributo de morfeo para interpolar al siguiente.
      let mesh: THREE.InstancedMesh | null;
      let instance: number;
      let exact: number;
      let frame: number;
      if (motion.walkWeight >= 0.5) {
        exact = motion.phase * SPRINT_FRAME_COUNT;
        frame = Math.min(SPRINT_FRAME_COUNT - 1, Math.floor(exact));
        instance = sprintingCounts[variant][frame]++;
        sprintingEntityIds.current[variant][frame][instance] = entity.entityId;
        mesh = sprintingCharacters.current[variant][frame];
      } else {
        exact = ((idleCycles + motion.idleOffset) % 1) * IDLE_FRAME_COUNT;
        frame = Math.min(IDLE_FRAME_COUNT - 1, Math.floor(exact));
        instance = idleCounts[variant][frame]++;
        idleEntityIds.current[variant][frame][instance] = entity.entityId;
        mesh = idleCharacters.current[variant][frame];
      }
      if (!mesh) continue;

      transform.position.set(entity.x, entity.y, entity.z);
      transform.rotation.set(0, entity.rotationY, 0);
      transform.updateMatrix();
      mesh.setMatrixAt(instance, transform.matrix);
      const morph = mesh.geometry.getAttribute("aMorph") as THREE.InstancedBufferAttribute;
      morph.setX(instance, exact - frame);
      const blend = mesh.geometry.getAttribute("aBlend") as THREE.InstancedBufferAttribute;
      blend.setX(instance, blendAmount(motion.walkWeight));
    }

    for (let variant = 0; variant < CHARACTER_MODEL_URLS.length; variant += 1) {
      // La geometría de cada malla es fija; aquí solo cambia cuántos la usan y su
      // avance dentro del fotograma.
      const flush = (mesh: THREE.InstancedMesh | null, used: number) => {
        if (!mesh) return;
        mesh.count = used;
        mesh.instanceMatrix.needsUpdate = true;
        mesh.geometry.getAttribute("aMorph").needsUpdate = true;
        mesh.geometry.getAttribute("aBlend").needsUpdate = true;
      };
      for (let frame = 0; frame < IDLE_FRAME_COUNT; frame += 1) {
        flush(idleCharacters.current[variant][frame], idleCounts[variant][frame]);
      }
      for (let frame = 0; frame < SPRINT_FRAME_COUNT; frame += 1) {
        flush(sprintingCharacters.current[variant][frame], sprintingCounts[variant][frame]);
      }
    }

    if (checkingAim) aimTelemetry.locked = locked;

    // Las entidades que ya no llegan en el snapshot (muertas o desconectadas) no
    // deben dejar su fase acumulándose en el mapa durante toda la partida.
    if (motions.current.size > entities.length * 2) {
      const alive = new Set(entities.map((entity) => entity.entityId));
      for (const id of motions.current.keys()) {
        if (!alive.has(id)) motions.current.delete(id);
      }
    }
  });

  useEffect(() => {
    const shootAtCrosshair = () => {
      if (selfRole !== "seeker" || !aiming) return;
      const meshes = [
        ...idleCharacters.current.flat(),
        ...sprintingCharacters.current.flat()
      ].filter((mesh): mesh is THREE.InstancedMesh => mesh !== null);
      for (const mesh of meshes) mesh.computeBoundingSphere();
      raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
      const hit = raycaster
        .intersectObject(scene, true)
        .find(
          ({ object }) =>
            object.userData.blocksShot || typeof object.userData.characterVariant === "number"
        );
      // Contra un muro, o al vacio, no hay blanco — pero el disparo se efectua igual
      // (suena), asi que se avisa al store en todos los casos.
      let targetEntityId: string | null = null;
      if (hit && !hit.object.userData.blocksShot && hit.instanceId !== undefined) {
        const variant = hit.object.userData.characterVariant as number;
        // Cada malla sabe de qué ciclo y fotograma es, que es lo que identifica al
        // grupo donde se apuntó esa instancia.
        const frame = hit.object.userData.frame as number;
        const ids = hit.object.userData.sprinting
          ? sprintingEntityIds.current
          : idleEntityIds.current;
        targetEntityId = ids[variant]?.[frame]?.[hit.instanceId] ?? null;
      }
      shoot(targetEntityId);
    };
    // Con el derecho ya pulsado (apuntando), pulsar el izquierdo NO genera un pointerdown.
    // Los eventos de puntero solo lo emiten al pasar de CERO botones a uno; mientras haya
    // alguno apretado, los demas cambios de boton llegan como pointermove, con `button`
    // diciendo cual cambio (los movimientos normales traen -1). Por eso apuntando con el
    // derecho el disparo estaba muerto y con F no: ahi no hay ningun boton pulsado.
    const handleShoot = (event: PointerEvent) => {
      if (event.button !== 0 || event.pointerType === "touch") return;
      // En el pointermove hay que separar pulsar de soltar, que llegan igual: si el bit
      // del izquierdo sigue en `buttons`, es una pulsacion.
      if (event.type === "pointermove" && (event.buttons & 1) === 0) return;
      shootAtCrosshair();
    };
    gl.domElement.addEventListener("pointerdown", handleShoot);
    gl.domElement.addEventListener("pointermove", handleShoot);
    window.addEventListener(TOUCH_SEEKER_SHOOT_EVENT, shootAtCrosshair);
    return () => {
      gl.domElement.removeEventListener("pointerdown", handleShoot);
      gl.domElement.removeEventListener("pointermove", handleShoot);
      window.removeEventListener(TOUCH_SEEKER_SHOOT_EVENT, shootAtCrosshair);
    };
  }, [aiming, camera, gl, raycaster, scene, selfRole, shoot]);

  return (
    <group>
      <group ref={selfRef} visible={false}>
        <mesh
          ref={selfMeshRef}
          geometry={characterAssets[0].idleGeometries[0]}
          material={characterAssets[0].material}
        />
      </group>
      {characterAssets.map((asset, variant) => (
        <group key={CHARACTER_MODEL_URLS[variant]}>
          {asset.idleGeometries.map((geometry, frame) => (
            <instancedMesh
              key={`idle-${frame}`}
              ref={(mesh) => {
                idleCharacters.current[variant][frame] = mesh;
              }}
              args={[geometry, asset.material, MAX_OTHER_ENTITIES]}
              frustumCulled={false}
              userData={{ characterVariant: variant, sprinting: false, frame }}
            />
          ))}
          {asset.sprintGeometries.map((geometry, frame) => (
            <instancedMesh
              key={`sprint-${frame}`}
              ref={(mesh) => {
                sprintingCharacters.current[variant][frame] = mesh;
              }}
              args={[geometry, asset.material, MAX_OTHER_ENTITIES]}
              frustumCulled={false}
              userData={{ characterVariant: variant, sprinting: true, frame }}
            />
          ))}
        </group>
      ))}
    </group>
  );
}

// Dobla las góndolas alrededor de la bisagra girándolas sobre el eje Z. El ángulo
// lleva el signo del lado, así ambas suben y bajan a la vez (aletean) en vez de
// alabear la nave, y entra con un smoothstep para que el fuselaje no se pliegue.
const CHASER_FLAP_GLSL = /* glsl */ `
uniform float uFlap;

// Prefijadas: comparten espacio de nombres con los #define que inyecta three.js.
const float CHASER_HINGE = ${CHASER_WING_HINGE.toFixed(3)};
const float CHASER_RAMP_IN = ${CHASER_WING_RAMP_IN.toFixed(3)};
const float CHASER_RAMP_OUT = ${CHASER_WING_RAMP_OUT.toFixed(3)};

float chaserAngle(float x) {
  return uFlap * sign(x) * smoothstep(CHASER_RAMP_IN, CHASER_RAMP_OUT, abs(x));
}

vec3 chaserBendPosition(vec3 p) {
  float a = chaserAngle(p.x);
  float side = sign(p.x);
  float lx = p.x - side * CHASER_HINGE;
  float c = cos(a);
  float s = sin(a);
  return vec3(side * CHASER_HINGE + lx * c - p.y * s, lx * s + p.y * c, p.z);
}

vec3 chaserBendNormal(vec3 n, vec3 p) {
  float a = chaserAngle(p.x);
  float c = cos(a);
  float s = sin(a);
  return vec3(n.x * c - n.y * s, n.x * s + n.y * c, n.z);
}
`;

// La nave del cazador. No tiene lógica de vuelo propia: se cuelga de la cámara que
// ya sobrevuela el mapa, con el morro (+Z del modelo, igual que el rotationY del
// resto de entidades) encarando adonde apunta la cámara e inclinado hacia el suelo.
function ChaserShip() {
  const { scene } = useGLTF(CHASER_MODEL_URL);
  // Ya no se suscribe a `aiming`: la mira entra por seekerAimBlend, que es un valor de
  // modulo. Asi la nave deja de re-renderizarse cada vez que se apunta o se suelta.
  const selfRole = useGameStore((s) => s.selfRole);
  const sendAimPose = useGameStore((s) => s.sendAimPose);
  const isSeeker = selfRole === "seeker";
  const ref = useRef<THREE.Group>(null);
  const direction = useMemo(() => new THREE.Vector3(), []);
  const aimPoint = useMemo(() => new THREE.Vector3(), []);

  // El uniform del aleteo, compartido con el shader y actualizado en cada frame.
  const flap = useRef({ value: 0 });
  // Alabeo actual, perseguido hacia el objetivo en cada fotograma.
  const bank = useRef(0);
  // Ultima pose conocida de la nave ajena, para deducir si se mueve.
  const lastShipPos = useRef<{ x: number; y: number; z: number } | null>(null);

  // useGLTF cachea la escena, así que el material se clona antes de tocarlo: si no,
  // el shader quedaría pegado al modelo para cualquier otro que lo cargue. Se guarda
  // el original para devolvérselo a la caché al desmontar; sin eso, un segundo
  // montaje clonaría el clon ya liberado.
  const patched = useMemo(() => {
    const entries: { mesh: THREE.Mesh; original: THREE.Material; clone: THREE.Material }[] = [];
    scene.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh || Array.isArray(mesh.material)) return;
      const original = mesh.material;
      const clone = original.clone();
      // Igual que en los personajes: sin clave propia, el programa del aleteo podría
      // confundirse con el del material sin parchear.
      clone.customProgramCacheKey = () => "chaser-flap";
      clone.onBeforeCompile = (shader) => {
        shader.uniforms.uFlap = flap.current;
        shader.vertexShader = shader.vertexShader
          .replace("#include <common>", `#include <common>\n${CHASER_FLAP_GLSL}`)
          .replace(
            "#include <beginnormal_vertex>",
            "#include <beginnormal_vertex>\nobjectNormal = chaserBendNormal(objectNormal, position);"
          )
          .replace(
            "#include <begin_vertex>",
            "#include <begin_vertex>\ntransformed = chaserBendPosition(transformed);"
          );
      };
      mesh.material = clone;
      entries.push({ mesh, original, clone });
    });
    return entries;
  }, [scene]);
  useEffect(
    () => () => {
      for (const { mesh, original, clone } of patched) {
        mesh.material = original;
        clone.dispose();
      }
    },
    [patched]
  );

  // El disparo lanza un raycast contra toda la escena: la nave no debe entrar
  // siquiera en el test de intersección.
  useEffect(() => {
    scene.traverse((object) => {
      object.raycast = () => {};
    });
  }, [scene]);

  useFrame(({ camera, clock }, delta) => {
    const ship = ref.current;
    if (!ship) return;
    flap.current.value = Math.sin(clock.elapsedTime * CHASER_FLAP_SPEED) * CHASER_FLAP_ANGLE;

    // Para el resto de jugadores la nave es una entidad más del mundo: su pose llega
    // por la red, porque quien la mueve es la cámara del cazador.
    if (!isSeeker) {
      const seeker = sampleSeeker();
      ship.visible = !!seeker;
      if (!seeker) {
        setSfxLoop("shipMove", false);
        return;
      }
      // La pose que llega por la red no trae velocidad: el movimiento se deduce de cuanto
      // se ha desplazado desde el fotograma anterior. El umbral filtra el temblor de la
      // interpolacion, que si no encenderia el motor con la nave quieta.
      const previous = lastShipPos.current;
      const speed =
        previous && delta > 0
          ? Math.hypot(seeker.x - previous.x, seeker.y - previous.y, seeker.z - previous.z) / delta
          : 0;
      lastShipPos.current = { x: seeker.x, y: seeker.y, z: seeker.z };
      setSfxLoop("shipMove", speed > SHIP_AUDIBLE_SPEED);
      // Se oye mas fuerte cuanto mas cerca pasa: a SHIP_AUDIBLE_RANGE ya no se oye nada.
      // Al cuadrado y no lineal: con la caida lineal la nave todavia sonaba a media
      // potencia a mitad de mapa y resultaba pesada mientras te escondias. Asi solo se
      // impone cuando de verdad la tienes encima, que es cuando debe acojonar.
      const distance = camera.position.distanceTo(ship.position);
      const closeness = 1 - Math.min(1, distance / SHIP_AUDIBLE_RANGE);
      setSfxLoopProximity("shipMove", closeness * closeness);

      ship.position.set(seeker.x, seeker.y, seeker.z);
      direction.set(seeker.dirX, seeker.dirY, seeker.dirZ).normalize();
      ship.rotation.set(
        THREE.MathUtils.clamp(
          Math.asin(THREE.MathUtils.clamp(-direction.y, -1, 1)) * CHASER_PITCH_FOLLOW,
          -CHASER_MAX_PITCH,
          CHASER_MAX_PITCH
        ),
        Math.atan2(direction.x, direction.z),
        0,
        "YXZ"
      );
      return;
    }

    camera.getWorldDirection(direction);
    // La separación entre cámara y nave se encoge al mismo ritmo al que la cámara se
    // acerca, así que la nave SE QUEDA QUIETA en el mundo mientras dura el zoom: la
    // cámara le entra por dentro, que es justo lo que se buscaba.
    //
    // Antes esto era un `if (aiming)` con la nave 1.25 por delante o 1.15 por detrás. Al
    // ser un booleano y no el avance del zoom, la nave DABA UN SALTO de 2.4 unidades en un
    // solo fotograma nada más pulsar el botón — y esa posición es la que se publica a los
    // demás, así que los escondidos veían la nave teletransportarse cada vez que el cazador
    // apuntaba. De paso disparaba el zumbido del motor, porque el salto se lee como
    // velocidad altísima.
    const aimBlend = seekerAimBlend.value;
    // La cámara la mueve otro useFrame, así que su matriz puede ir un fotograma
    // por detrás; sin esto la nave arrastraría al girar.
    camera.updateMatrixWorld();
    // Solo el AVANCE se encoge con el zoom, y lo hace exactamente al ritmo al que la
    // cámara se acerca (4.75 -> 3.5 son los mismos 1.25 que vuela por delante), así que
    // la nave se queda clavada en el mundo. La caída vertical NO puede encogerse: la
    // cámara no baja para compensarla, así que si se anulaba al apuntar la nave subía
    // ~0.33 en el mundo — y esa es la posición que se publica, o sea que los escondidos
    // veían la nave levantarse cada vez que el cazador ponía la mira. Se aplica aparte y
    // en vertical de MUNDO, no de cámara: apuntando la orientación es libre y en ejes de
    // cámara el desvío giraría con ella.
    ship.position
      .set(0, 0, -CHASER_SCREEN_FORWARD * (1 - aimBlend))
      .applyMatrix4(camera.matrixWorld);
    ship.position.y -= CHASER_SCREEN_DOWN;
    // Con la mira puesta la cámara está DENTRO de la nave: se oculta, o se vería el modelo
    // por dentro tapando la pantalla. El umbral es media eslora, que es cuando empieza a
    // comerse el encuadre.
    ship.visible = CHASER_SCREEN_FORWARD * (1 - aimBlend) > CHASER_HIDE_DISTANCE;
    // Sube y baja en vertical del mundo, no de la pantalla: así se lee como que la
    // nave flota, y no como que se mueve la cámara.
    ship.position.y += Math.sin(clock.elapsedTime * CHASER_BOB_SPEED) * CHASER_BOB_AMPLITUDE;

    // Se publica ya con la flotación aplicada: es la posición desde la que sale el
    // láser, y debe coincidir con la que ve el propio cazador. El punto de mira se
    // calcula igual que en AimLaser, desde la cámara, que es donde está la retícula.
    aimPoint
      .copy(camera.position)
      .addScaledVector(direction, aimDistance(camera.position, direction));
    sendAimPose({
      x: ship.position.x,
      y: ship.position.y,
      z: ship.position.z,
      dirX: direction.x,
      dirY: direction.y,
      dirZ: direction.z,
      aimX: aimPoint.x,
      aimY: aimPoint.y,
      aimZ: aimPoint.z
    });
    // Morro hacia el mapa: direction.y es negativo mirando hacia abajo, así que el
    // asin da lo que la cámara pica bajo el horizonte y la nave hereda parte de ello.
    const cameraPitch = Math.asin(THREE.MathUtils.clamp(-direction.y, -1, 1));
    const pitch = THREE.MathUtils.clamp(
      cameraPitch * CHASER_PITCH_FOLLOW,
      -CHASER_MAX_PITCH,
      CHASER_MAX_PITCH
    );
    // Alabeo hacia el lado del viraje. Se persigue el objetivo en vez de asignarlo para
    // que la nave se tumbe y se enderece con inercia, no de golpe.
    const bankTarget = seekerTurn.value * CHASER_BANK_ANGLE;
    bank.current += (bankTarget - bank.current) * Math.min(1, delta * CHASER_BANK_SPEED);

    // Orden YXZ: primero encara el rumbo, luego baja el morro sobre su propio eje y por
    // ultimo alabea. Con el orden por defecto (XYZ) la inclinación se aplicaría en ejes de
    // mundo y se convertiría en alabeo en cuanto la nave girase.
    ship.rotation.set(pitch, Math.atan2(direction.x, direction.z), bank.current, "YXZ");
  });

  return <primitive ref={ref} object={scene} scale={CHASER_SCALE} />;
}

// Viraje lateral que esta pidiendo el cazador (-1 izquierda .. 1 derecha). Lo escribe el rig
// de camara y lo leen la nave (para el alabeo) y el zumbido del motor. Es un valor de modulo
// y no estado de React a proposito: cambia en cada fotograma y no debe provocar renders.
const seekerTurn = { value: 0 };

// Avance del golpe de zoom de la mira (0 = vista general, 1 = mira puesta), ya suavizado.
// Lo escribe el rig de camara y lo lee la nave para encogerle su separacion de la camara al
// mismo ritmo que esta se acerca. Va aqui por lo mismo que seekerTurn: cambia cada fotograma
// y no debe provocar renders.
const seekerAimBlend = { value: 0 };

const AIM_EPSILON = 1e-6;

// Slab test: distancia al primer corte del rayo con una caja alineada a los ejes.
// null si no la corta.
// Lo que de verdad puede esconder una célula. Los AABB del mapa no traen altura, así
// que el resto del código los trata a todos como columnas de BUILDING_HEIGHT — para la
// cámara y para el láser eso vale (pecar de prudente no molesta), pero para encender el
// haz no: de los 14 obstáculos del mapa real solo 3 son edificios; los otros 11 son
// farolas (0.08), carteles (0.09) y árboles (0.2), y tomarlos por muros hacía parpadear
// el haz cada vez que una farola cruzaba la línea de visión. Se filtra por planta: nada
// tan estrecho tapa a nadie.
const BEAM_BLOCKER_MIN_SIDE = 0.3;
const beamBlockers = obstacles.filter(
  (rect) => Math.min(rect.maxX - rect.minX, rect.maxZ - rect.minZ) >= BEAM_BLOCKER_MIN_SIDE
);

/**
 * ¿Un edificio tapa la línea directa de `origin` a `target`? Mismos AABB que ya usan
 * la cámara y el láser (rayBoxDistance): si el primer edificio que corta el rayo
 * queda más cerca que el propio objetivo, no se ve a simple vista. `direction` es un
 * Vector3 del llamador, reescrito aquí — evita reservar uno nuevo cada fotograma por
 * cada célula.
 */
function beamOccluded(
  origin: THREE.Vector3,
  target: THREE.Vector3,
  direction: THREE.Vector3
): boolean {
  direction.subVectors(target, origin);
  const distance = direction.length();
  if (distance < 0.001) return false;
  direction.divideScalar(distance);
  for (const rect of beamBlockers) {
    const t = rayBoxDistance(
      origin,
      direction,
      [rect.minX, 0, rect.minZ],
      [rect.maxX, BUILDING_HEIGHT, rect.maxZ]
    );
    if (t !== null && t > 0.05 && t < distance - 0.05) return true;
  }
  return false;
}

function rayBoxDistance(
  origin: THREE.Vector3,
  direction: THREE.Vector3,
  min: [number, number, number],
  max: [number, number, number]
): number | null {
  const o = [origin.x, origin.y, origin.z];
  const d = [direction.x, direction.y, direction.z];
  let near = 0;
  let far = Infinity;
  for (let axis = 0; axis < 3; axis += 1) {
    if (Math.abs(d[axis]) < AIM_EPSILON) {
      if (o[axis] < min[axis] || o[axis] > max[axis]) return null; // paralelo y fuera
      continue;
    }
    const t1 = (min[axis] - o[axis]) / d[axis];
    const t2 = (max[axis] - o[axis]) / d[axis];
    near = Math.max(near, Math.min(t1, t2));
    far = Math.min(far, Math.max(t1, t2));
    if (near > far) return null;
  }
  return near;
}

/**
 * Hasta dónde puede retroceder la cámara detrás del jugador sin colarse en un edificio.
 * Se traza desde su cabeza hacia donde iría la cámara y se corta en el primer AABB del
 * mapa — los mismos que ya usan el láser y el servidor, así que la cámara respeta
 * exactamente los mismos muros que las balas.
 */
function cameraClearance(origin: THREE.Vector3, direction: THREE.Vector3, wanted: number): number {
  let hit = wanted;
  for (const rect of obstacles) {
    const t = rayBoxDistance(
      origin,
      direction,
      [rect.minX, 0, rect.minZ],
      [rect.maxX, BUILDING_HEIGHT, rect.maxZ]
    );
    // t = 0 es la cabeza ya dentro de la caja (rozando una esquina): no hay nada que
    // recortar por delante y el rayo no dice nada útil, así que se ignora.
    if (t !== null && t > 0 && t < hit) hit = t;
  }
  // El margen fijo se descuenta del choque, pero cuando el hueco es más estrecho que el
  // propio margen la resta se iría a negativo: ahí manda el proporcional, que siempre
  // deja la cámara DENTRO del hueco en vez de al otro lado de la pared.
  return Math.max(hit - WALL_MARGIN, hit * WALL_MARGIN_RATIO, MIN_CAMERA_DISTANCE);
}

/**
 * Distancia a lo que hay bajo la retícula: el primer edificio o el suelo. Se calcula
 * contra los AABB del mapa, que son la misma verdad que usa el servidor para los
 * disparos, en vez de trazar contra la escena entera cada fotograma.
 */
function aimDistance(origin: THREE.Vector3, direction: THREE.Vector3): number {
  let best = LASER_MAX_LENGTH;
  if (direction.y < -AIM_EPSILON) {
    const toGround = -origin.y / direction.y;
    if (toGround > 0) best = Math.min(best, toGround);
  }
  for (const rect of obstacles) {
    const t = rayBoxDistance(
      origin,
      direction,
      [rect.minX, 0, rect.minZ],
      [rect.maxX, BUILDING_HEIGHT, rect.maxZ]
    );
    if (t !== null && t > 0 && t < best) best = t;
  }
  return best;
}

// Mirilla láser del cazador: un haz desde el cañón hasta donde apunta, con un punto
// en el impacto. Lo ven todos, así que a los escondidos les avisa de que les están
// encarando. El cazador lo saca de su propia cámara (sin latencia) y el resto de la
// pose que llega por la red.
function AimLaser() {
  const selfRole = useGameStore((s) => s.selfRole);
  const aiming = useGameStore((s) => s.aiming);
  const isSeeker = selfRole === "seeker";
  const beam = useRef<THREE.Mesh>(null);
  const dot = useRef<THREE.Mesh>(null);
  const group = useRef<THREE.Group>(null);
  const origin = useMemo(() => new THREE.Vector3(), []);
  const direction = useMemo(() => new THREE.Vector3(), []);
  const target = useMemo(() => new THREE.Vector3(), []);
  const beamDirection = useMemo(() => new THREE.Vector3(), []);
  const beamAxis = useMemo(() => new THREE.Vector3(0, 1, 0), []);

  useFrame(({ camera }) => {
    const container = group.current;
    if (!container) return;

    if (isSeeker) {
      container.visible = aiming;
      if (!aiming) {
        // Al soltar la mira se olvida la lectura: si no, al volver a apuntar el primer
        // fotograma usaría la distancia de la vez anterior y el marcador de blanco
        // podría encenderse sobre alguien que ahora está tapado.
        aimTelemetry.distance = 0;
        aimTelemetry.locked = false;
        return;
      }
      camera.getWorldDirection(direction);
      // El punto de mira se saca del rayo de la CÁMARA, que es donde está la retícula.
      target
        .copy(camera.position)
        .addScaledVector(direction, aimDistance(camera.position, direction));
      // Pero el haz sale del cañón, que va detrás y debajo de la cámara.
      origin
        .copy(camera.position)
        .addScaledVector(direction, -CHASER_BACK_OFFSET)
        .setY(camera.position.y - CHASER_DOWN_OFFSET);
    } else {
      const seeker = sampleSeeker();
      container.visible = !!seeker?.aiming;
      if (!seeker?.aiming) return;
      // El haz sale de la nave, en la posición real que ocupa: la misma que se dibuja.
      origin.set(seeker.x, seeker.y, seeker.z);
      target.set(seeker.aimX, seeker.aimY, seeker.aimZ);
    }

    // Del cañón HACIA el punto de mira. Antes viajaba paralelo a la cámara, y como el
    // cañón está desplazado, el haz nunca convergía en la retícula: apuntando lejos el
    // desvío pasaba de 6 unidades, más que el mapa entero.
    beamDirection.subVectors(target, origin);
    const length = beamDirection.length();
    if (length < 0.01) {
      container.visible = false;
      return;
    }
    beamDirection.divideScalar(length);

    // Telemetría para el HUD. Solo la publica el cazador: es su propia mira.
    if (isSeeker) {
      aimTelemetry.distance = length;
      aimTelemetry.altitude = origin.y;
      aimTelemetry.heading = Math.atan2(direction.x, direction.z);
      aimTelemetry.grounded = length < LASER_MAX_LENGTH * 0.99;
    }

    // El cilindro nace a lo largo de +Y y centrado: se orienta al haz, se estira hasta
    // el impacto y se coloca en el punto medio.
    if (beam.current) {
      beam.current.quaternion.setFromUnitVectors(beamAxis, beamDirection);
      beam.current.scale.set(1, length, 1);
      beam.current.position.copy(origin).addScaledVector(beamDirection, length / 2);
    }
    if (dot.current) {
      // Sin corte (apuntando al horizonte) el haz se pierde a lo lejos y no hay impacto.
      dot.current.visible = length < LASER_MAX_LENGTH * 0.99;
      dot.current.position.copy(target);
    }
  });

  return (
    <group ref={group} visible={false}>
      <mesh ref={beam} raycast={() => {}}>
        <cylinderGeometry args={[LASER_RADIUS, LASER_RADIUS, 1, 6, 1, true]} />
        <meshBasicMaterial
          color="#ff2b6b"
          transparent
          opacity={0.75}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh ref={dot} raycast={() => {}}>
        <sphereGeometry args={[LASER_DOT_RADIUS, 10, 10]} />
        <meshBasicMaterial
          color="#ff6b8b"
          transparent
          opacity={0.9}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

function SeekerCamera() {
  const selfRole = useGameStore((s) => s.selfRole);
  const aiming = useGameStore((s) => s.aiming);
  const setAiming = useGameStore((s) => s.setAiming);
  const { camera, gl } = useThree();
  const pressed = useRef({ left: false, right: false });
  const touchCamera = useRef({ x: 0, y: 0 });
  const aimPitch = useRef(0);
  const aimYaw = useRef(0);
  const orbitYaw = useRef(0);
  // 0 = vista general, 1 = mira puesta. Lo intermedio es el golpe de zoom.
  const aimBlend = useRef(0);
  // La orientación libre no se entrega hasta que el zoom termina; si no, el ratón
  // pelearía con la transición.
  const aimReady = useRef(false);
  // Al enganchar la captura del puntero, el primer evento trae de golpe la distancia
  // entre donde estaba el cursor y el centro de la pantalla. Ese salto giraba la mirilla
  // de un tiron (y como el cabeceo tiene tope abajo, se iba al suelo). Se tira ese
  // primer movimiento.
  const skipAimMove = useRef(false);
  const target = useMemo(() => new THREE.Vector3(CENTER_X, 0.4, CENTER_Z), []);
  // Al soltar la mira la cámara mira adonde la dejó el jugador: se guarda esa
  // orientación para volver a la de órbita interpolando y no de un tirón.
  const exitQuaternion = useMemo(() => new THREE.Quaternion(), []);
  const orbitQuaternion = useMemo(() => new THREE.Quaternion(), []);

  // Coloca la cámara en la órbita a partir de yaw/inclinación/distancia. Antes la
  // inclinación se heredaba de dónde estuviera ya la cámara y solo se ajustaba la
  // distancia, así que no había forma de regularla.
  const placeOrbit = useCallback(
    (distance: number) => {
      const horizontal = Math.cos(SEEKER_OVERVIEW_PITCH) * distance;
      camera.position.set(
        target.x + Math.sin(orbitYaw.current) * horizontal,
        target.y + Math.sin(SEEKER_OVERVIEW_PITCH) * distance,
        target.z + Math.cos(orbitYaw.current) * horizontal
      );
      camera.lookAt(target);
    },
    [camera, target]
  );

  useEffect(() => {
    if (selfRole !== "seeker") return;
    // Mismo motivo que en el disparo: con otro boton ya pulsado, el derecho no genera
    // pointerdown/pointerup sino pointermove, y hay que mirar `buttons` para saber si
    // acaba de pulsarse o de soltarse.
    const startAiming = (event: PointerEvent) => {
      if (event.button !== 2) return;
      if (event.type === "pointermove" && (event.buttons & 2) === 0) return;
      event.preventDefault();
      setAiming(true);
      void gl.domElement.requestPointerLock();
    };
    const stopAiming = (event?: PointerEvent) => {
      if (event && event.button !== 2) return;
      // Un pointerup con el boton derecho TODAVIA pulsado (bit 2 de buttons) no es una
      // soltada real: al enganchar el pointer lock con el boton apretado, el navegador
      // rompe la captura implicita y sintetiza uno. Si se hacia caso, la mira se apagaba
      // al instante y por eso apuntando con el derecho no se podia disparar (con F si,
      // porque ahi no hay ningun boton pulsado).
      if (event && (event.buttons & 2) !== 0) return;
      setAiming(false);
      if (document.pointerLockElement === gl.domElement) document.exitPointerLock();
    };
    const cancelAiming = () => setAiming(false);
    const preventMenu = (event: MouseEvent) => event.preventDefault();
    const lockChanged = () => {
      if (document.pointerLockElement === gl.domElement) {
        // La captura se pide al apuntar, pero se concede cuando el navegador quiere. Si para
        // cuando llega ya se ha bajado la mira —soltar el derecho, o F—, no la suelta nadie:
        // `stopAiming` miro el pointerLockElement cuando todavia no estaba enganchada y no
        // tenia nada que soltar. El raton se quedaba secuestrado con la mira apagada y solo
        // se salia con Esc. Llegar tarde a una mira que ya no esta es soltarla en el acto.
        if (!useGameStore.getState().aiming) {
          document.exitPointerLock();
          return;
        }
        // Acaba de engancharse: el proximo movimiento trae el salto de recolocacion.
        skipAimMove.current = true;
        return;
      }
      if (useGameStore.getState().aiming) setAiming(false);
    };
    gl.domElement.addEventListener("pointerdown", startAiming);
    gl.domElement.addEventListener("pointermove", startAiming);
    gl.domElement.addEventListener("contextmenu", preventMenu);
    window.addEventListener("pointerup", stopAiming);
    // Soltar el derecho con el izquierdo aun pulsado tampoco da pointerup: sin esto la
    // mira se quedaba encendida hasta soltar los dos botones.
    window.addEventListener("pointermove", stopAiming);
    window.addEventListener("blur", cancelAiming);
    document.addEventListener("pointerlockchange", lockChanged);
    return () => {
      gl.domElement.removeEventListener("pointerdown", startAiming);
      gl.domElement.removeEventListener("pointermove", startAiming);
      gl.domElement.removeEventListener("contextmenu", preventMenu);
      window.removeEventListener("pointerup", stopAiming);
      window.removeEventListener("pointermove", stopAiming);
      window.removeEventListener("blur", cancelAiming);
      document.removeEventListener("pointerlockchange", lockChanged);
      if (document.pointerLockElement === gl.domElement) document.exitPointerLock();
      setAiming(false);
    };
  }, [gl, selfRole, setAiming]);

  // Ya no coloca la cámara: de eso se encarga el useFrame, que la lleva hasta la mira
  // con el zoom. Aquí solo se anota de dónde sale el viaje de vuelta.
  useEffect(() => {
    if (selfRole !== "seeker") return;
    if (aiming) {
      aimReady.current = false;
    } else {
      exitQuaternion.copy(camera.quaternion);
      target.set(CENTER_X, 0.4, CENTER_Z);
    }
  }, [aiming, camera, exitQuaternion, selfRole, target]);

  useEffect(() => {
    if (selfRole !== "seeker") return;
    const applyAimMovement = (movementX: number, movementY: number) => {
      aimYaw.current -= movementX * SEEKER_AIM_SENSITIVITY;
      aimPitch.current = THREE.MathUtils.clamp(
        aimPitch.current - movementY * SEEKER_AIM_SENSITIVITY,
        -Math.PI / 2 + 0.1,
        -0.05
      );
      camera.rotation.set(aimPitch.current, aimYaw.current, 0, "YXZ");
    };
    // OJO: va sobre pointermove, NO sobre mousemove. Apuntar con el boton derecho cancela
    // su pointerdown (preventDefault, para que no salga el menu contextual), y cancelar un
    // pointerdown hace que el navegador SUPRIMA los eventos de raton de compatibilidad de
    // esa interaccion —mousemove incluido— hasta que se suelta el boton. Por eso la mirilla
    // se quedaba clavada mientras se mantenia el derecho, y con F no: ahi no se cancela
    // ningun pointerdown. Los eventos de puntero no se suprimen, y PointerEvent hereda
    // movementX/Y de MouseEvent, asi que sirve igual.
    const moveAim = (event: PointerEvent) => {
      if (!aiming || event.pointerType !== "mouse") return;
      // Pulsar o soltar un boton NO gira la camara. Con otro boton ya apretado, el cambio
      // de boton no llega como pointerdown sino como pointermove (`button` dice cual
      // cambio; los movimientos de verdad traen -1), y ese evento es justo el que arrastra
      // el salto de recolocacion del cursor: por eso la camara se iba hacia abajo AL
      // DISPARAR, que es cuando el navegador concede la captura por fin.
      if (event.button !== -1) return;
      // La captura del puntero se pide en el pointerdown del boton derecho, o sea con el
      // boton YA apretado, y ahi el navegador puede no engancharla. Sin captura, el raton
      // llega al borde de la ventana y movementX pasa a valer 0: la vista deja de girar
      // aunque sigas moviendo. Se reintenta mientras se apunta; si ya esta enganchada, no
      // cuesta nada.
      if (document.pointerLockElement !== gl.domElement) {
        void gl.domElement.requestPointerLock();
      }
      if (skipAimMove.current) {
        skipAimMove.current = false;
        return;
      }
      // aimReady: hasta que el zoom no acaba, la cámara la manda la transición.
      if (!aimReady.current) return;
      // Tope por evento: un salto asi no lo hace una mano, lo hace una recolocacion del
      // cursor (cambio de captura, volver a la ventana). Girar media vuelta de golpe es
      // peor que perder algo de recorrido en un manotazo.
      applyAimMovement(
        THREE.MathUtils.clamp(event.movementX, -AIM_MAX_STEP_PX, AIM_MAX_STEP_PX),
        THREE.MathUtils.clamp(event.movementY, -AIM_MAX_STEP_PX, AIM_MAX_STEP_PX)
      );
    };
    document.addEventListener("pointermove", moveAim);
    return () => document.removeEventListener("pointermove", moveAim);
  }, [aiming, camera, gl, selfRole]);

  useEffect(() => {
    const updateCamera = (event: Event) => {
      touchCamera.current = (event as CustomEvent<TouchCameraDetail>).detail;
    };
    window.addEventListener(TOUCH_CAMERA_EVENT, updateCamera);
    return () => window.removeEventListener(TOUCH_CAMERA_EVENT, updateCamera);
  }, []);

  useEffect(() => {
    if (selfRole !== "seeker") return;
    const setKey = (event: KeyboardEvent, active: boolean) => {
      // Con el foco en el chat las teclas son suyas: apuntar con F y girar con A/D hacian
      // preventDefault, asi que ademas de ejecutar la accion impedian que la letra llegara
      // a escribirse. Solo se ignoran las pulsaciones; las sueltas (active=false) se
      // procesan siempre, para no dejar una tecla marcada como pulsada.
      if (active && isTypingInField(event.target)) return;
      if (active && event.code === "KeyF" && !event.repeat) {
        event.preventDefault();
        const next = !useGameStore.getState().aiming;
        setAiming(next);
        if (next) {
          void gl.domElement.requestPointerLock();
        } else if (document.pointerLockElement === gl.domElement) {
          document.exitPointerLock();
        }
        return;
      }
      const side =
        event.code === "ArrowLeft" || event.code === "KeyA"
          ? "left"
          : event.code === "ArrowRight" || event.code === "KeyD"
            ? "right"
            : null;
      if (!side) return;
      event.preventDefault();
      pressed.current[side] = active;
    };
    const down = (event: KeyboardEvent) => setKey(event, true);
    const up = (event: KeyboardEvent) => setKey(event, false);
    const clear = () => (pressed.current = { left: false, right: false });
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", clear);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", clear);
      // Al salir de la partida no puede quedar el motor sonando de fondo.
      seekerTurn.value = 0;
      stopAllSfxLoops();
    };
  }, [gl, selfRole, setAiming]);

  useFrame(({ camera }, delta) => {
    if (selfRole !== "seeker") return;

    const goal = aiming ? 1 : 0;
    if (aimBlend.current !== goal) {
      const step = delta / AIM_TRANSITION_SECONDS;
      aimBlend.current =
        goal > aimBlend.current
          ? Math.min(goal, aimBlend.current + step)
          : Math.max(goal, aimBlend.current - step);
    }
    const blend = aimBlend.current;
    // Se publica ya suavizado, que es como lo consume la nave. Con blend 0 y 1 da 0 y 1
    // exactos, asi que sirve igual para los tramos planos.
    seekerAimBlend.value = blend * blend * (3 - 2 * blend);

    // Apuntando no se pilota: hay que bajar la mira para volver a mover la nave. Ademas de
    // ser la regla pedida, deja el alabeo a cero y apaga el motor mientras se apunta, que es
    // lo coherente con una nave detenida en el aire.
    const horizontalInput = THREE.MathUtils.clamp(
      Number(pressed.current.right) - Number(pressed.current.left) + touchCamera.current.x,
      -1,
      1
    );
    const turnDirection = aiming ? 0 : horizontalInput;
    // Se publica para la nave (alabeo) y se enciende el motor solo mientras se vira. Es
    // declarativo: llamarlo cada fotograma es barato y solo actua cuando cambia de verdad.
    seekerTurn.value = turnDirection;
    setSfxLoop("shipMove", turnDirection !== 0);
    setSfxLoopProximity("shipMove", 1);

    if (blend === 0) {
      if (turnDirection !== 0) orbitYaw.current += turnDirection * delta * 1.2;
      placeOrbit(SEEKER_OVERVIEW_DISTANCE);
      return;
    }

    if (blend < 1) {
      // Golpe de zoom. La distancia de puntería está 1.29 más cerca que la de vista
      // general y la nave vuela 1.25 por delante de la cámara: el acercamiento acaba
      // justo donde ella estaba, así que se lee como entrar por su centro.
      const eased = blend * blend * (3 - 2 * blend);
      placeOrbit(THREE.MathUtils.lerp(SEEKER_OVERVIEW_DISTANCE, SEEKER_AIM_DISTANCE, eased));
      if (!aiming) {
        // De vuelta: placeOrbit acaba de dejar la orientación de órbita en la cámara;
        // se interpola desde donde el jugador soltó la mira, por el arco corto.
        orbitQuaternion.copy(camera.quaternion);
        camera.quaternion.copy(exitQuaternion).slerp(orbitQuaternion, 1 - eased);
      }
      return;
    }

    // Mira puesta: a partir de aquí manda la orientación libre.
    if (!aimReady.current) {
      placeOrbit(SEEKER_AIM_DISTANCE);
      camera.rotation.reorder("YXZ");
      aimPitch.current = camera.rotation.x;
      aimYaw.current = camera.rotation.y;
      aimReady.current = true;
    }
    if (horizontalInput === 0 && touchCamera.current.y === 0) return;
    aimYaw.current -= horizontalInput * delta * TOUCH_SEEKER_AIM_SPEED;
    aimPitch.current = THREE.MathUtils.clamp(
      aimPitch.current - touchCamera.current.y * delta * TOUCH_SEEKER_AIM_SPEED,
      -Math.PI / 2 + 0.1,
      -0.05
    );
    camera.rotation.set(aimPitch.current, aimYaw.current, 0, "YXZ");
  });

  return null;
}

// Marco holográfico: caja translúcida con escuadras en las esquinas, el lenguaje
// visual de los paneles de la nave.
function HoloFrame({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    // El posicionamiento va fuera y el marco dentro: si el llamador pasara `absolute`
    // al mismo elemento que lleva `relative`, chocarían y el panel se estiraría a lo
    // ancho de la pantalla en vez de ajustarse a su contenido.
    <div className={className}>
      <div className="relative border border-neon-cyan/25 bg-bg/45 backdrop-blur-[2px]">
        {[
          "-left-px -top-px border-l-2 border-t-2",
          "-right-px -top-px border-r-2 border-t-2",
          "-bottom-px -left-px border-b-2 border-l-2",
          "-bottom-px -right-px border-b-2 border-r-2"
        ].map((corner) => (
          <span key={corner} className={`absolute h-2 w-2 border-neon-cyan/80 ${corner}`} />
        ))}
        {/* Envoltorio propio: separar aquí las filas evita que el divide-y pinte
            también sobre las escuadras, que son hijas del marco. */}
        <div className="divide-y divide-neon-cyan/15">{children}</div>
      </div>
    </div>
  );
}

function HoloReadout({
  label,
  valueRef,
  accent = "text-neon-cyan"
}: {
  label: string;
  valueRef: RefObject<HTMLSpanElement | null>;
  accent?: string;
}) {
  return (
    <div className="px-3 py-1.5">
      <p className="font-display text-[0.5rem] font-bold uppercase leading-none tracking-[0.28em] text-text-muted/70">
        {label}
      </p>
      <span
        ref={valueRef}
        className={`font-display mt-1 block text-lg font-black leading-none tabular-nums ${accent} [text-shadow:0_0_14px_currentColor]`}
      >
        --
      </span>
    </div>
  );
}

/**
 * Visor de puntería del cazador. Se queda montado siempre y entra/sale por opacidad:
 * desmontarlo al soltar la mira cortaría el fundido de salida en seco. El escalado
 * acompaña al zoom de la cámara, de modo que el visor se cierra sobre el centro.
 *
 * Las lecturas se escriben directamente en el DOM desde un requestAnimationFrame, sin
 * pasar por el estado de React: cambian en cada fotograma y provocarían un re-render a
 * 60 Hz de todo el árbol.
 */
function ScopeOverlay({ visible }: { visible: boolean }) {
  const { t } = useTranslation();
  const presentCount = useGameStore((s) => s.presentCount);
  const distanceRef = useRef<HTMLSpanElement>(null);
  const altitudeRef = useRef<HTMLSpanElement>(null);
  const headingRef = useRef<HTMLSpanElement>(null);
  const targetRef = useRef<HTMLSpanElement>(null);
  const markerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!visible) return;
    let frame = 0;
    let lastWrite = 0;
    const meters = (units: number) => (units * WORLD_UNITS_TO_METERS).toFixed(1);

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      // ~12 Hz: a 60 los dígitos bailan y no hay quien los lea.
      if (now - lastWrite < SCOPE_REFRESH_MS) return;
      lastWrite = now;

      const { distance, altitude, heading, locked, grounded } = aimTelemetry;
      if (distanceRef.current) {
        distanceRef.current.textContent = grounded ? `${meters(distance)} M` : "∞";
      }
      if (altitudeRef.current) altitudeRef.current.textContent = `${meters(altitude)} M`;
      if (headingRef.current) {
        const degrees = Math.round(((((heading * 180) / Math.PI) % 360) + 360) % 360);
        headingRef.current.textContent = `${String(degrees).padStart(3, "0")}°`;
      }
      if (targetRef.current) {
        targetRef.current.textContent = locked ? t("game.scopeLocked") : t("game.scopeScanning");
        targetRef.current.style.color = locked ? "var(--color-error)" : "var(--color-text-muted)";
      }
      if (markerRef.current) {
        markerRef.current.style.opacity = locked ? "1" : "0";
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [visible, t]);

  return (
    <div
      className="pointer-events-none absolute inset-0 z-[5] transition-[opacity,transform] ease-out"
      style={{
        background:
          "radial-gradient(circle at center, transparent 0 27vmin, rgba(2, 0, 14, 0.94) 28vmin)",
        opacity: visible ? 1 : 0,
        transform: visible ? "scale(1)" : "scale(1.12)",
        transitionDuration: `${AIM_TRANSITION_SECONDS * 1000}ms`
      }}
    >
      {/* Retícula */}
      <div className="absolute left-1/2 top-1/2 h-[56vmin] w-[56vmin] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full border border-neon-cyan/70 shadow-[inset_0_0_28px_rgba(36,245,255,0.12)]">
        {/* Barrido de radar */}
        <span className="animate-scope-sweep absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-neon-cyan to-transparent" />
        {/* Marcas de grados cada 30°, como la corona de un instrumento */}
        {Array.from({ length: 12 }, (_, i) => (
          <span
            key={i}
            className="absolute left-1/2 top-0 h-[28vmin] w-px origin-bottom"
            style={{ transform: `rotate(${i * 30}deg)` }}
          >
            <span
              className={`block w-px ${i % 3 === 0 ? "h-3 bg-neon-cyan/80" : "h-1.5 bg-neon-cyan/40"}`}
            />
          </span>
        ))}
        <span className="absolute left-1/2 top-1/2 h-px w-14 -translate-x-1/2 -translate-y-1/2 bg-neon-cyan/80" />
        <span className="absolute left-1/2 top-1/2 h-14 w-px -translate-x-1/2 -translate-y-1/2 bg-neon-cyan/80" />
        <span className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-neon-magenta bg-bg" />
        {/* Cerco que late cuando hay alguien encarado */}
        <span
          ref={markerRef}
          className="animate-scope-pulse absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-error opacity-0 transition-opacity duration-150"
        />
      </div>

      {/* Rumbo, arriba */}
      <HoloFrame className="absolute left-1/2 top-[6vmin] -translate-x-1/2 px-4 py-1">
        <div className="flex items-baseline gap-2">
          <span className="font-display text-[0.5rem] font-bold uppercase tracking-[0.28em] text-text-muted/70">
            {t("game.scopeHeading")}
          </span>
          <span
            ref={headingRef}
            className="font-display text-base font-black tabular-nums text-neon-cyan [text-shadow:0_0_14px_currentColor]"
          >
            ---
          </span>
        </div>
      </HoloFrame>

      {/* Telemetría, izquierda */}
      <HoloFrame className="absolute left-[5vmin] top-1/2 -translate-y-1/2">
        <HoloReadout label={t("game.scopeDistance")} valueRef={distanceRef} />
        <HoloReadout label={t("game.scopeAltitude")} valueRef={altitudeRef} />
      </HoloFrame>

      {/* Estado del blanco, derecha */}
      <HoloFrame className="absolute right-[5vmin] top-1/2 -translate-y-1/2">
        <div className="px-3 py-1.5">
          <p className="font-display text-[0.5rem] font-bold uppercase leading-none tracking-[0.28em] text-text-muted/70">
            {t("game.scopeTarget")}
          </p>
          <span
            ref={targetRef}
            className="font-display mt-1 block text-sm font-black uppercase leading-none text-text-muted [text-shadow:0_0_14px_currentColor]"
          >
            --
          </span>
        </div>
        <div className="px-3 py-1.5">
          <p className="font-display text-[0.5rem] font-bold uppercase leading-none tracking-[0.28em] text-text-muted/70">
            {t("game.units")}
          </p>
          <span className="font-display mt-1 block text-lg font-black leading-none tabular-nums text-neon-cyan [text-shadow:0_0_14px_currentColor]">
            {presentCount}
          </span>
        </div>
      </HoloFrame>

      {/* Estado del sistema, abajo. Comparte banda con el aviso de controles y el botón de
          práctica, que también van centrados al pie; quien se aparta es el botón, que no se
          dibuja mientras la mira está puesta (ver el pie de Game.tsx). Se probó a colgarlo
          de la retícula y no vale: la retícula se mide en vmin, así que en una ventana
          apaisada baja justo a la banda del pie. */}
      <div className="absolute bottom-[6vmin] left-1/2 flex -translate-x-1/2 items-center gap-2">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-neon-magenta shadow-[0_0_8px_currentColor]" />
        <p className="font-display text-[0.55rem] font-bold uppercase tracking-[0.32em] text-neon-magenta/90 [text-shadow:0_0_12px_currentColor]">
          {t("game.scopeStatus")}
        </p>
      </div>
    </div>
  );
}

// Cambia en cada entrada y salida de la mira, nunca en el montaje inicial. Al usarlo
// como key, el destello se vuelve a montar y su animación arranca de cero: si no,
// solo se vería la primera vez. Empieza en 0 = todavía sin destello que mostrar.
function useAimFlashKey(aiming: boolean): number {
  const [key, setKey] = useState(0);
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    setKey((previous) => previous + 1);
  }, [aiming]);
  return key;
}

// Canvas propio de la partida: monta la ciudad GLB y conserva el descriptor
// lógico sincronizado para colisiones, cámaras y fallback de carga.
function GameScene() {
  const selfRole = useGameStore((s) => s.selfRole);
  const aiming = useGameStore((s) => s.aiming);
  const flashKey = useAimFlashKey(aiming);
  return (
    <div className="relative h-full w-full overflow-hidden bg-bg">
      <Canvas
        dpr={[1, 1.5]}
        camera={{ position: [CENTER_X, 4.5, bounds.maxZ + 5], fov: 60 }}
        style={{
          cursor: selfRole === "seeker" && aiming ? "crosshair" : "default",
          touchAction: "none"
        }}
      >
        <PerformanceMonitor>
          <AdaptiveDpr />
          <color attach="background" args={["#0d0520"]} />
          <fog attach="fog" args={["#2b1245", 10, 30]} />
          {/* Luz suave y envolvente, a proposito. Los modelos son de IA: sus normales estan
              sucias y una direccional fuerte marca cada faceta y saca reflejos desparejos.
              El grueso lo pone una hemisferica (cielo violeta arriba, rebote del asfalto
              abajo), que ilumina por igual desde todas las direcciones y no crea aristas.
              Las direccionales quedan de apoyo, a intensidad baja, solo para dar volumen. */}
          <hemisphereLight args={["#c9a6ff", "#3a2a5a", 1.7]} />
          <ambientLight intensity={0.5} />
          {/* Sol: calido y rasante, desde donde esta el disco (al fondo, -Z). Es la unica
              luz con direccion clara, para que las fachadas tengan un lado iluminado y otro
              en sombra sin llegar a marcar el facetado de la malla. */}
          <directionalLight position={[2, 5, -14]} intensity={1.15} color="#ffcf9b" />
          {/* Relleno frio por el lado contrario, muy suave: evita que la cara opuesta al sol
              se quede plana y muerta. */}
          <directionalLight position={[-6, 6, 8]} intensity={0.35} color="#8fd4ff" />
          <Backdrop />
          <LamppostLights />
          {/* El suelo va SIEMPRE, no como respaldo de carga: antes lo ponia el GLB de calle
              y, al quitarlo, la manzana se quedaba sin superficie en cuanto cargaba. */}
          <Floor />
          <Suspense fallback={null}>
            <CityMap />
          </Suspense>
          <Obstacles />
          <Collectibles />
          <Units />
          <SeekerCamera />
          {/* La nave la ven todos: el cazador la suya, y el resto la que llega por
              la red. Antes solo se montaba para el cazador, así que desde el suelo
              no había nada de lo que pudiera salir el láser. */}
          <Suspense fallback={null}>
            <ChaserShip />
          </Suspense>
          <AimLaser />
        </PerformanceMonitor>
      </Canvas>
      {selfRole === "seeker" && <ScopeOverlay visible={aiming} />}
      {selfRole === "seeker" && flashKey > 0 && (
        <div
          key={flashKey}
          className="animate-scope-flash pointer-events-none absolute inset-0 z-[6] bg-bg"
        />
      )}
    </div>
  );
}

export default GameScene;
