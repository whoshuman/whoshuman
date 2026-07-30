import { AdaptiveDpr, PerformanceMonitor, useGLTF } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import type { GameEntityState } from "@whoshuman/shared-types";
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

import { getCssColor } from "../../features/home-3d/homeSceneUtils";
import {
  TOUCH_CAMERA_EVENT,
  TOUCH_SEEKER_SHOOT_EVENT,
  type TouchCameraDetail
} from "../input/touchInput";
import betaCity from "../maps/beta-city.json";
import { useGameStore } from "../store/gameStore";
import {
  AIM_LOCK_RADIUS,
  WORLD_UNITS_TO_METERS,
  aimTelemetry
} from "../systems/aimTelemetry";
import { sampleSeeker, sampleWorld } from "../systems/interpolation";

// COPIA del mapa lógico del servidor (game-service/src/game/maps/beta-city.json).
// El server es la única verdad de colisiones: lo que se pinta aquí debe coincidir
// con lo que él simula. Si backend cambia el mapa, re-copiar el JSON.
const { bounds, obstacles } = betaCity;
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
const TURN_STEP_RADIUS = 0.12;
// El clip idle dura 2.03s en los cuatro modelos: 12 fotogramas a 6 fps lo dejan en
// un bucle de 2s, prácticamente su velocidad original.
const IDLE_FRAME_COUNT = 12;
const IDLE_FPS = 6;
// Umbral de "se mueve", al cuadrado. Muy bajo a propósito: las posiciones vienen de
// interpolar snapshots, así que una entidad parada da diferencia exactamente 0 y no
// hay ruido del que protegerse. Con el umbral anterior (1e-6) un NPC rozando una
// pared al 10% de velocidad se clasificaba como quieto y se deslizaba en pose idle.
const MOVEMENT_EPSILON_SQ = 1e-8;
const ROTATION_EPSILON = 0.0005;
// Tope de ciclos por segundo del clip de andar. El jugador va a 3 u/s (8× los NPC) y
// pediría 7.8 ciclos/s: un borrón con solo 8 fotogramas horneados. Se le deja en 2,
// poco más del doble de la cadencia de autor, que se lee como correr sin parecer que
// va acelerado.
const SPRINT_MAX_CYCLES_PER_SECOND = 2;

interface Motion {
  x: number;
  z: number;
  rotationY: number;
  phase: number; // 0..1 dentro del ciclo de caminar, propio de cada entidad
  idleOffset: number; // desfase fijo del idle, para que no respiren todos a la vez
  moving: boolean;
}

// Acumula el recorrido de una entidad y avanza su fase de caminar en proporción a
// él. Cada una lleva la suya, así que dos personajes a distinta velocidad pisan a
// distinto ritmo y el que se queda bloqueado deja de mover los pies.
// Girar cuenta como recorrido aunque no haya desplazamiento: es lo que hace un NPC
// al desencajarse de otro, y así se le ve dar pasos para encararse en vez de
// deslizarse rígido en la pose de idle.
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
      rotationY: entity.rotationY,
      // Fase inicial dispersa: si todos arrancasen en 0, la multitud entera pisaría
      // al unísono como un desfile.
      phase: Math.random(),
      idleOffset: Math.random(),
      moving: false
    };
    motions.set(entity.entityId, first);
    return first;
  }

  const distanceSq = (entity.x - previous.x) ** 2 + (entity.z - previous.z) ** 2;
  // por el arco corto: el heading del servidor no está normalizado
  const spin = entity.rotationY - previous.rotationY;
  const turn = Math.abs(Math.atan2(Math.sin(spin), Math.cos(spin)));

  previous.x = entity.x;
  previous.z = entity.z;
  previous.rotationY = entity.rotationY;
  previous.moving = distanceSq > MOVEMENT_EPSILON_SQ || turn > ROTATION_EPSILON;
  if (previous.moving) {
    const travelled = Math.sqrt(distanceSq) + turn * TURN_STEP_RADIUS;
    const step = Math.min(
      travelled / SPRINT_CYCLE_DISTANCE,
      SPRINT_MAX_CYCLES_PER_SECOND * delta
    );
    previous.phase = (previous.phase + step) % 1;
  }
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
function patchMorphMaterial(material: THREE.Material, uniform?: { value: number }): void {
  const declaration = uniform
    ? "uniform float uMorph;\n#define MORPH uMorph"
    : "attribute float aMorph;\n#define MORPH aMorph";
  // three.js cachea los programas compilados por los parámetros del material, y dos
  // clones con onBeforeCompile distinto darían la misma clave: reutilizaría el shader
  // del otro. Hoy no chocan porque la clave incluye si la malla es instanciada, pero
  // eso es suerte; declararlo es lo que exige la API.
  material.customProgramCacheKey = () => (uniform ? "morph-uniform" : "morph-attribute");
  material.onBeforeCompile = (shader) => {
    if (uniform) shader.uniforms.uMorph = uniform;
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>\nattribute vec3 nextPosition;\nattribute vec3 nextNormal;\n${declaration}`
      )
      .replace(
        "#include <beginnormal_vertex>",
        "#include <beginnormal_vertex>\nobjectNormal = normalize(mix(objectNormal, nextNormal, MORPH));"
      )
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\ntransformed = mix(transformed, nextPosition, MORPH);"
      );
  };
}

// Empareja cada pose con la siguiente (la última con la primera, que el ciclo cierra).
// Comparte los BufferAttribute de las horneadas en vez de copiarlos: lo único nuevo es
// el atributo por instancia con su avance dentro del fotograma.
function buildMorphSet(frames: THREE.BufferGeometry[]): THREE.BufferGeometry[] {
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
    geometry.setAttribute(
      "aMorph",
      new THREE.InstancedBufferAttribute(new Float32Array(MAX_OTHER_ENTITIES), 1)
    );
    // El bulto no cambia entre poses vecinas; reusarla evita recalcularla por fotograma.
    geometry.boundingSphere = frame.boundingSphere;
    return geometry;
  });
}
// Debe coincidir con CHARACTER_SKIN_COUNT del game-service: el server manda skinId
// y aquí se indexa este array directamente.
const CHARACTER_MODEL_URLS: string[] = [
  "/models/personajes/neon-vixen.glb",
  "/models/personajes/cubist-warrior.glb",
  "/models/personajes/purple-visor.glb",
  "/models/personajes/pixel-voyager.glb"
];
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
// Lo que tarda la cámara en entrar y salir de la mira. Muy corto a propósito: es un
// golpe de zoom, no un viaje. Debe ir acorde con la animación scope-flash del CSS.
const AIM_TRANSITION_SECONDS = 0.16;
// Cada cuánto se refrescan las cifras del visor. A 60 Hz los dígitos bailan y no hay
// quien los lea; ~12 Hz se ve vivo y legible.
const SCOPE_REFRESH_MS = 80;
const TOUCH_CAMERA_SPEED = 1.8;
const TOUCH_SEEKER_AIM_SPEED = 0.65;
const HIDER_CAMERA_DISTANCE = 1.8;
const CITY_MODEL_URL = "/models/beta-city-new.glb";
const CITY_OFFSET: [number, number, number] = [-8.5, 0, -0.3];
const CELL_MODEL_URL = "/models/energy-cell.glb";
// El modelo mide 0.12 de alto; x1.7 lo deja en ~0.2, el mismo bulto que tenía el
// octaedro que hacía de marcador y algo más de medio personaje.
const CELL_SCALE = 1.7;
const CHASER_MODEL_URL = "/models/chaser.glb";
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
const CHASER_SCREEN_DOWN = 0.36;
// Apuntando se manda detrás de la cámara: ahí no tapa la mira.
const CHASER_BACK_OFFSET = 1.15;
const CHASER_DOWN_OFFSET = 0.3;
// Aleteo. El modelo es una malla rígida de una pieza (sin huesos, sin animaciones y
// sin las alas como objetos aparte), así que las góndolas se doblan en el vertex
// shader. Miden |x| 0.29-0.48 y las separa del fuselaje un estrechamiento en
// |x| 0.24-0.29: ahí va la bisagra, y el doblez entra progresivamente entre
// RAMP_IN y RAMP_OUT para que no se marque un pliegue en el borde.
const CHASER_WING_HINGE = 0.24;
const CHASER_WING_RAMP_IN = 0.2;
const CHASER_WING_RAMP_OUT = 0.3;
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

function CityMap() {
  const { scene } = useGLTF(CITY_MODEL_URL);
  return <primitive object={scene} position={CITY_OFFSET} />;
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
      {obstacles.map((rect, index) => {
        const w = rect.maxX - rect.minX;
        const d = rect.maxZ - rect.minZ;
        const x = (rect.minX + rect.maxX) / 2;
        const z = (rect.minZ + rect.maxZ) / 2;
        return (
          <group key={index} position={[x, BUILDING_HEIGHT / 2, z]} scale={[w, BUILDING_HEIGHT, d]}>
            <mesh geometry={geometry} material={material} userData={{ blocksShot: true }} />
          </group>
        );
      })}
    </group>
  );
}

function Floor() {
  const gridColor = useMemo(() => getCssColor("--color-neon-cyan"), []);
  return (
    <group position={[CENTER_X, 0, CENTER_Z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <planeGeometry args={[MAP_W, MAP_D]} />
        <meshBasicMaterial color="#050014" />
      </mesh>
      <gridHelper args={[Math.max(MAP_W, MAP_D), 24, gridColor, "#1a1140"]} />
    </group>
  );
}

function Collectibles() {
  const collectibles = useGameStore((state) => state.collectibles);
  const group = useRef<THREE.Group>(null);
  const { scene } = useGLTF(CELL_MODEL_URL);
  // Una sola geometría y un solo material para las 8 células: el GLB se carga una vez
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

  useFrame((_, delta) => {
    for (const item of group.current?.children ?? []) {
      item.rotation.y += delta * 1.4;
      item.rotation.x += delta * 0.7;
    }
  });

  // El material lo gestiona la caché de useGLTF; aquí solo es nuestra la geometría.
  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <group ref={group}>
      {collectibles.map((item) => (
        <mesh
          key={item.collectibleId}
          geometry={geometry}
          material={material}
          position={[item.x, item.y, item.z]}
        />
      ))}
    </group>
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
        const selfMorph = { value: 0 };
        const selfMaterial = material.clone();
        patchMorphMaterial(selfMaterial, selfMorph);

        return {
          idleGeometries: buildMorphSet(idleFrames),
          sprintGeometries: buildMorphSet(sprintFrames),
          // Las horneadas quedan como dueñas de los datos: las de morfeo solo las
          // referencian, así que se liberan aquí y no allí.
          bakedGeometries: [...idleFrames, ...sprintFrames],
          material,
          selfMaterial,
          selfMorph
        };
      }),
    [characterModels, gl]
  );
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
          if (motion.moving) {
            const exact = motion.phase * SPRINT_FRAME_COUNT;
            const frame = Math.min(SPRINT_FRAME_COUNT - 1, Math.floor(exact));
            selfMeshRef.current.geometry = asset.sprintGeometries[frame];
            asset.selfMorph.value = exact - frame;
          } else {
            const exact = ((idleCycles + motion.idleOffset) % 1) * IDLE_FRAME_COUNT;
            const frame = Math.min(IDLE_FRAME_COUNT - 1, Math.floor(exact));
            selfMeshRef.current.geometry = asset.idleGeometries[frame];
            asset.selfMorph.value = exact - frame;
          }
          selfMeshRef.current.material = asset.selfMaterial;
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
        const horizontalDistance = Math.cos(hiderCameraPitch.current) * HIDER_CAMERA_DISTANCE;
        cameraDestination.set(
          self.x - Math.sin(yaw) * horizontalDistance,
          self.y + PLAYER_HEIGHT + Math.sin(hiderCameraPitch.current) * HIDER_CAMERA_DISTANCE,
          self.z - Math.cos(yaw) * horizontalDistance
        );
        cameraTarget.set(self.x, self.y + PLAYER_HEIGHT, self.z);
        camera.position.lerp(cameraDestination, 0.08);
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
        aimOffset
          .set(entity.x, entity.y + PLAYER_HEIGHT / 2, entity.z)
          .sub(camera.position);
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
      if (motion.moving) {
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
    }

    for (let variant = 0; variant < CHARACTER_MODEL_URLS.length; variant += 1) {
      // La geometría de cada malla es fija; aquí solo cambia cuántos la usan y su
      // avance dentro del fotograma.
      const flush = (mesh: THREE.InstancedMesh | null, used: number) => {
        if (!mesh) return;
        mesh.count = used;
        mesh.instanceMatrix.needsUpdate = true;
        mesh.geometry.getAttribute("aMorph").needsUpdate = true;
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
      if (hit?.object.userData.blocksShot || hit?.instanceId === undefined) return;
      const variant = hit.object.userData.characterVariant as number;
      // Cada malla sabe de qué ciclo y fotograma es, que es lo que identifica al
      // grupo donde se apuntó esa instancia.
      const frame = hit.object.userData.frame as number;
      const ids = hit.object.userData.sprinting
        ? sprintingEntityIds.current
        : idleEntityIds.current;
      const targetEntityId = ids[variant]?.[frame]?.[hit.instanceId];
      if (targetEntityId) shoot(targetEntityId);
    };
    const handleShoot = (event: PointerEvent) => {
      if (event.button !== 0 || event.pointerType === "touch") return;
      shootAtCrosshair();
    };
    gl.domElement.addEventListener("pointerdown", handleShoot);
    window.addEventListener(TOUCH_SEEKER_SHOOT_EVENT, shootAtCrosshair);
    return () => {
      gl.domElement.removeEventListener("pointerdown", handleShoot);
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
  const aiming = useGameStore((s) => s.aiming);
  const selfRole = useGameStore((s) => s.selfRole);
  const sendAimPose = useGameStore((s) => s.sendAimPose);
  const isSeeker = selfRole === "seeker";
  const ref = useRef<THREE.Group>(null);
  const direction = useMemo(() => new THREE.Vector3(), []);
  const aimPoint = useMemo(() => new THREE.Vector3(), []);

  // El uniform del aleteo, compartido con el shader y actualizado en cada frame.
  const flap = useMemo(() => ({ value: 0 }), []);

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
        shader.uniforms.uFlap = flap;
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
  }, [scene, flap]);
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

  useFrame(({ camera, clock }) => {
    const ship = ref.current;
    if (!ship) return;
    flap.value = Math.sin(clock.elapsedTime * CHASER_FLAP_SPEED) * CHASER_FLAP_ANGLE;

    // Para el resto de jugadores la nave es una entidad más del mundo: su pose llega
    // por la red, porque quien la mueve es la cámara del cazador.
    if (!isSeeker) {
      const seeker = sampleSeeker();
      ship.visible = !!seeker;
      if (!seeker) return;
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

    ship.visible = true;
    camera.getWorldDirection(direction);
    if (aiming) {
      // Apuntando se sale del encuadre: por delante taparía la mira.
      ship.position
        .copy(camera.position)
        .addScaledVector(direction, -CHASER_BACK_OFFSET)
        .setY(camera.position.y - CHASER_DOWN_OFFSET);
    } else {
      // La cámara la mueve otro useFrame, así que su matriz puede ir un fotograma
      // por detrás; sin esto la nave arrastraría al girar.
      camera.updateMatrixWorld();
      ship.position
        .set(0, -CHASER_SCREEN_DOWN, -CHASER_SCREEN_FORWARD)
        .applyMatrix4(camera.matrixWorld);
    }
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
    // Orden YXZ: primero encara el rumbo y luego baja el morro sobre su propio eje.
    // Con el orden por defecto (XYZ) la inclinación se aplicaría en ejes de mundo y
    // se convertiría en alabeo en cuanto la nave girase.
    ship.rotation.set(pitch, Math.atan2(direction.x, direction.z), 0, "YXZ");
  });

  return <primitive ref={ref} object={scene} scale={CHASER_SCALE} />;
}

const AIM_EPSILON = 1e-6;

// Slab test: distancia al primer corte del rayo con una caja alineada a los ejes.
// null si no la corta.
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
    const startAiming = (event: PointerEvent) => {
      if (event.button !== 2) return;
      event.preventDefault();
      setAiming(true);
      void gl.domElement.requestPointerLock();
    };
    const stopAiming = (event?: PointerEvent) => {
      if (event && event.button !== 2) return;
      setAiming(false);
      if (document.pointerLockElement === gl.domElement) document.exitPointerLock();
    };
    const cancelAiming = () => setAiming(false);
    const preventMenu = (event: MouseEvent) => event.preventDefault();
    const lockChanged = () => {
      if (document.pointerLockElement !== gl.domElement && useGameStore.getState().aiming) {
        setAiming(false);
      }
    };
    gl.domElement.addEventListener("pointerdown", startAiming);
    gl.domElement.addEventListener("contextmenu", preventMenu);
    window.addEventListener("pointerup", stopAiming);
    window.addEventListener("blur", cancelAiming);
    document.addEventListener("pointerlockchange", lockChanged);
    return () => {
      gl.domElement.removeEventListener("pointerdown", startAiming);
      gl.domElement.removeEventListener("contextmenu", preventMenu);
      window.removeEventListener("pointerup", stopAiming);
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
    const moveAim = (event: MouseEvent) => {
      // aimReady: hasta que el zoom no acaba, la cámara la manda la transición.
      if (aiming && aimReady.current) applyAimMovement(event.movementX, event.movementY);
    };
    document.addEventListener("mousemove", moveAim);
    return () => document.removeEventListener("mousemove", moveAim);
  }, [aiming, camera, selfRole]);

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

    const direction = THREE.MathUtils.clamp(
      Number(pressed.current.right) - Number(pressed.current.left) + touchCamera.current.x,
      -1,
      1
    );

    if (blend === 0) {
      if (direction !== 0) orbitYaw.current += direction * delta * 1.2;
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
    if (direction === 0 && touchCamera.current.y === 0) return;
    aimYaw.current -= direction * delta * TOUCH_SEEKER_AIM_SPEED;
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
        const degrees = Math.round((((heading * 180) / Math.PI) % 360 + 360) % 360);
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

      {/* Estado del sistema, abajo */}
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
    <div className="relative h-full w-full overflow-hidden">
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
          <color attach="background" args={["#050014"]} />
          <fog attach="fog" args={["#050014", 8, 22]} />
          <ambientLight intensity={0.7} />
          <directionalLight position={[4, 8, 2]} intensity={0.8} />
          <Suspense fallback={<Floor />}>
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
