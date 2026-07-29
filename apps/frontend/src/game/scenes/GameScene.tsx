import { AdaptiveDpr, PerformanceMonitor, useGLTF } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef } from "react";
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
import { sampleWorld } from "../systems/interpolation";

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
const SPRINT_FPS = 16;
const MOVEMENT_EPSILON_SQ = 0.000001;
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
const SEEKER_OVERVIEW_DISTANCE = Math.max(MAP_W, MAP_D) * 1.35;
const SEEKER_AIM_SENSITIVITY = 0.002;
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
// Va detrás de la cámara (y algo por debajo): así el cazador no se tapa su propia
// vista, pero desde el suelo la nave sí queda a la vista.
const CHASER_BACK_OFFSET = 1.15;
const CHASER_DOWN_OFFSET = 0.3;

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
  const idleCharacters = useRef<(THREE.InstancedMesh | null)[]>([]);
  const sprintingCharacters = useRef<(THREE.InstancedMesh | null)[]>([]);
  const idleEntityIds = useRef<string[][]>(CHARACTER_MODEL_URLS.map(() => []));
  const sprintingEntityIds = useRef<string[][]>(CHARACTER_MODEL_URLS.map(() => []));
  const previousPositions = useRef(new Map<string, { x: number; z: number }>());
  const touchCamera = useRef({ x: 0, y: 0 });
  const hiderCameraYaw = useRef(0);
  const hiderCameraPitch = useRef(0.45);
  const transform = useMemo(() => new THREE.Object3D(), []);
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
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
        const idleGeometry = bakeGeometry(idle, (idle?.duration ?? 0) * 0.25);
        const sprintGeometries = Array.from({ length: SPRINT_FRAME_COUNT }, (_, frame) =>
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
        return { idleGeometry, sprintGeometries, material };
      }),
    [characterModels, gl]
  );
  useEffect(
    () => () => {
      for (const asset of characterAssets) {
        asset.idleGeometry.dispose();
        asset.sprintGeometries.forEach((geometry) => geometry.dispose());
        asset.material.dispose();
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
    const sprintFrame = Math.floor(clock.elapsedTime * SPRINT_FPS) % SPRINT_FRAME_COUNT;

    if (selfRef.current) {
      selfRef.current.visible = selfRole !== "seeker" && !!self;
      if (selfRole !== "seeker" && self) {
        const asset = characterAssets[self.skinId];
        const previous = previousPositions.current.get(self.entityId);
        const isMoving =
          !!previous &&
          (self.x - previous.x) ** 2 + (self.z - previous.z) ** 2 > MOVEMENT_EPSILON_SQ;
        previousPositions.current.set(self.entityId, { x: self.x, z: self.z });
        if (selfMeshRef.current && asset) {
          selfMeshRef.current.geometry = isMoving
            ? asset.sprintGeometries[sprintFrame]
            : asset.idleGeometry;
          selfMeshRef.current.material = asset.material;
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
    const idleCounts = CHARACTER_MODEL_URLS.map(() => 0);
    const sprintingCounts = CHARACTER_MODEL_URLS.map(() => 0);
    for (const ids of idleEntityIds.current) ids.length = 0;
    for (const ids of sprintingEntityIds.current) ids.length = 0;

    for (let i = 0; i < count; i += 1) {
      const entity = others[i];
      const variant = entity.skinId;
      const previous = previousPositions.current.get(entity.entityId);
      const isMoving =
        !!previous &&
        (entity.x - previous.x) ** 2 + (entity.z - previous.z) ** 2 > MOVEMENT_EPSILON_SQ;
      previousPositions.current.set(entity.entityId, { x: entity.x, z: entity.z });
      const counts = isMoving ? sprintingCounts : idleCounts;
      const ids = isMoving ? sprintingEntityIds.current : idleEntityIds.current;
      const mesh = isMoving
        ? sprintingCharacters.current[variant]
        : idleCharacters.current[variant];
      const instance = counts[variant]++;
      ids[variant][instance] = entity.entityId;
      if (!mesh) continue;

      transform.position.set(entity.x, entity.y, entity.z);
      transform.rotation.set(0, entity.rotationY, 0);
      transform.updateMatrix();
      mesh.setMatrixAt(instance, transform.matrix);
    }

    for (let variant = 0; variant < CHARACTER_MODEL_URLS.length; variant += 1) {
      const idleMesh = idleCharacters.current[variant];
      if (idleMesh) {
        idleMesh.count = idleCounts[variant];
        idleMesh.instanceMatrix.needsUpdate = true;
      }
      const sprintingMesh = sprintingCharacters.current[variant];
      if (sprintingMesh) {
        sprintingMesh.geometry = characterAssets[variant].sprintGeometries[sprintFrame];
        sprintingMesh.count = sprintingCounts[variant];
        sprintingMesh.instanceMatrix.needsUpdate = true;
      }
    }
  });

  useEffect(() => {
    const shootAtCrosshair = () => {
      if (selfRole !== "seeker" || !aiming) return;
      const meshes = [...idleCharacters.current, ...sprintingCharacters.current].filter(
        (mesh): mesh is THREE.InstancedMesh => mesh !== null
      );
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
      const entityIds = hit.object.userData.sprinting
        ? sprintingEntityIds.current
        : idleEntityIds.current;
      const targetEntityId = entityIds[variant]?.[hit.instanceId];
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
          geometry={characterAssets[0].idleGeometry}
          material={characterAssets[0].material}
        />
      </group>
      {characterAssets.map((asset, variant) => (
        <group key={CHARACTER_MODEL_URLS[variant]}>
          <instancedMesh
            ref={(mesh) => {
              idleCharacters.current[variant] = mesh;
            }}
            args={[asset.idleGeometry, asset.material, MAX_OTHER_ENTITIES]}
            frustumCulled={false}
            userData={{ characterVariant: variant, sprinting: false }}
          />
          <instancedMesh
            ref={(mesh) => {
              sprintingCharacters.current[variant] = mesh;
            }}
            args={[asset.sprintGeometries[0], asset.material, MAX_OTHER_ENTITIES]}
            frustumCulled={false}
            userData={{ characterVariant: variant, sprinting: true }}
          />
        </group>
      ))}
    </group>
  );
}

// La nave del cazador. No tiene lógica de vuelo propia: se cuelga de la cámara que
// ya sobrevuela el mapa, siempre con el morro (+Z del modelo, igual que el rotationY
// del resto de entidades) mirando adonde apunta la cámara.
function ChaserShip() {
  const { scene } = useGLTF(CHASER_MODEL_URL);
  const ref = useRef<THREE.Group>(null);
  const direction = useMemo(() => new THREE.Vector3(), []);

  // El disparo lanza un raycast contra toda la escena: la nave no debe entrar
  // siquiera en el test de intersección.
  useEffect(() => {
    scene.traverse((object) => {
      object.raycast = () => {};
    });
  }, [scene]);

  useFrame(({ camera }) => {
    const ship = ref.current;
    if (!ship) return;
    camera.getWorldDirection(direction);
    ship.position
      .copy(camera.position)
      .addScaledVector(direction, -CHASER_BACK_OFFSET)
      .setY(camera.position.y - CHASER_DOWN_OFFSET);
    // Solo yaw: la nave vuela siempre nivelada aunque la cámara mire hacia abajo.
    ship.rotation.y = Math.atan2(direction.x, direction.z);
  });

  return <primitive ref={ref} object={scene} scale={CHASER_SCALE} />;
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
  const target = useMemo(() => new THREE.Vector3(CENTER_X, 0.4, CENTER_Z), []);
  const yAxis = useMemo(() => new THREE.Vector3(0, 1, 0), []);

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

  useEffect(() => {
    if (selfRole !== "seeker") return;
    if (!aiming) target.set(CENTER_X, 0.4, CENTER_Z);
    const offset = camera.position.clone().sub(target);
    if (offset.lengthSq() === 0) offset.set(0, 1, 1);
    camera.position
      .copy(target)
      .add(offset.setLength(aiming ? SEEKER_AIM_DISTANCE : SEEKER_OVERVIEW_DISTANCE));
    camera.lookAt(target);
    camera.rotation.reorder("YXZ");
    aimPitch.current = camera.rotation.x;
    aimYaw.current = camera.rotation.y;
  }, [aiming, camera, selfRole, target]);

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
      if (aiming) applyAimMovement(event.movementX, event.movementY);
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
    const direction = THREE.MathUtils.clamp(
      Number(pressed.current.right) - Number(pressed.current.left) + touchCamera.current.x,
      -1,
      1
    );
    if (aiming) {
      if (direction === 0 && touchCamera.current.y === 0) return;
      aimYaw.current -= direction * delta * TOUCH_SEEKER_AIM_SPEED;
      aimPitch.current = THREE.MathUtils.clamp(
        aimPitch.current - touchCamera.current.y * delta * TOUCH_SEEKER_AIM_SPEED,
        -Math.PI / 2 + 0.1,
        -0.05
      );
      camera.rotation.set(aimPitch.current, aimYaw.current, 0, "YXZ");
      return;
    }
    if (direction === 0) return;
    camera.position
      .sub(target)
      .applyAxisAngle(yAxis, direction * delta * 1.2)
      .add(target);
    camera.lookAt(target);
  });

  return null;
}

function ScopeOverlay() {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-[5]"
      style={{
        background:
          "radial-gradient(circle at center, transparent 0 27vmin, rgba(2, 0, 14, 0.94) 28vmin)"
      }}
    >
      <div className="absolute left-1/2 top-1/2 h-[56vmin] w-[56vmin] -translate-x-1/2 -translate-y-1/2 rounded-full border border-neon-cyan/70 shadow-[inset_0_0_28px_rgba(36,245,255,0.12)]">
        <span className="absolute left-1/2 top-1/2 h-px w-14 -translate-x-1/2 -translate-y-1/2 bg-neon-cyan/80" />
        <span className="absolute left-1/2 top-1/2 h-14 w-px -translate-x-1/2 -translate-y-1/2 bg-neon-cyan/80" />
        <span className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-neon-magenta bg-bg" />
      </div>
    </div>
  );
}

// Canvas propio de la partida: monta la ciudad GLB y conserva el descriptor
// lógico sincronizado para colisiones, cámaras y fallback de carga.
function GameScene() {
  const selfRole = useGameStore((s) => s.selfRole);
  const aiming = useGameStore((s) => s.aiming);
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
          {selfRole === "seeker" && (
            <Suspense fallback={null}>
              <ChaserShip />
            </Suspense>
          )}
        </PerformanceMonitor>
      </Canvas>
      {selfRole === "seeker" && aiming && <ScopeOverlay />}
    </div>
  );
}

export default GameScene;
