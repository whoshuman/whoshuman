import { AdaptiveDpr, PerformanceMonitor, useGLTF } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import { getCssColor } from "../../features/home-3d/homeSceneUtils";
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
const CHARACTER_MODEL_URLS: string[] = [
  "/models/personajes/character-female-a.glb",
  "/models/personajes/character-female-b.glb",
  "/models/personajes/character-female-c.glb",
  "/models/personajes/character-female-d.glb",
  "/models/personajes/character-female-e.glb",
  "/models/personajes/character-female-f.glb",
  "/models/personajes/character-male-a.glb",
  "/models/personajes/character-male-b.glb",
  "/models/personajes/character-male-c.glb",
  "/models/personajes/character-male-d.glb",
  "/models/personajes/character-male-e.glb",
  "/models/personajes/character-male-f.glb"
];
const CHARACTER_SCALE = 0.48;
const SEEKER_AIM_DISTANCE = Math.max(MAP_W, MAP_D) * 0.7;
const SEEKER_OVERVIEW_DISTANCE = Math.max(MAP_W, MAP_D) * 1.35;
const SEEKER_AIM_SENSITIVITY = 0.002;
const CITY_MODEL_URL = "/models/beta-city-new.glb";
const CITY_OFFSET: [number, number, number] = [-8.5, 0, -0.3];

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
  const geometry = useMemo(() => new THREE.OctahedronGeometry(0.11, 0), []);
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#ffe66d",
        emissive: "#ff9f1c",
        emissiveIntensity: 1.4,
        metalness: 0.15,
        roughness: 0.25
      }),
    []
  );

  useFrame((_, delta) => {
    for (const item of group.current?.children ?? []) {
      item.rotation.y += delta * 1.4;
      item.rotation.x += delta * 0.7;
    }
  });

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material]
  );

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
  const otherCharacters = useRef<(THREE.InstancedMesh | null)[]>([]);
  const entityIds = useRef<string[][]>(CHARACTER_MODEL_URLS.map(() => []));
  const transform = useMemo(() => new THREE.Object3D(), []);
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const characterAssets = useMemo(
    () =>
      characterModels.map(({ scene: characterScene, animations }) => {
        const mixer = new THREE.AnimationMixer(characterScene);
        const idle = animations.find((clip) => clip.name === "idle");
        if (idle) {
          mixer.clipAction(idle).play();
          mixer.setTime(idle.duration * 0.25);
        }
        characterScene.updateMatrixWorld(true);
        const meshes: THREE.Mesh[] = [];
        characterScene.traverse((object) => {
          if ((object as THREE.Mesh).isMesh) meshes.push(object as THREE.Mesh);
        });

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
        mixer.stopAllAction();
        mixer.uncacheRoot(characterScene);
        const geometry = mergeGeometries(parts, false);
        parts.forEach((part) => part.dispose());
        if (!geometry) throw new Error("No se pudo combinar la geometría del personaje");
        geometry.scale(CHARACTER_SCALE, CHARACTER_SCALE, CHARACTER_SCALE);
        geometry.computeVertexNormals();
        geometry.computeBoundingSphere();

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
          material.map.magFilter = THREE.NearestFilter;
          material.map.minFilter = THREE.NearestMipmapLinearFilter;
          material.map.anisotropy = Math.min(4, gl.capabilities.getMaxAnisotropy());
          material.map.needsUpdate = true;
        }
        return { geometry, material };
      }),
    [characterModels, gl]
  );
  useEffect(
    () => () => {
      for (const asset of characterAssets) {
        asset.geometry.dispose();
        asset.material.dispose();
      }
    },
    [characterAssets]
  );

  useFrame(({ camera }) => {
    const entities = sampleWorld();
    const self = entities.find((entity) => entity.entityId === selfEntityId);

    if (selfRef.current) {
      selfRef.current.visible = selfRole !== "seeker" && !!self;
      if (selfRole !== "seeker" && self) {
        const asset = characterAssets[self.skinId];
        if (selfMeshRef.current && asset) {
          selfMeshRef.current.geometry = asset.geometry;
          selfMeshRef.current.material = asset.material;
        }
        selfRef.current.position.set(self.x, self.y, self.z);
        selfRef.current.rotation.y = self.rotationY;
        const back = 1.6;
        const height = 1.1;
        const targetX = self.x - Math.sin(self.rotationY) * back;
        const targetZ = self.z - Math.cos(self.rotationY) * back;
        camera.position.lerp(new THREE.Vector3(targetX, self.y + height, targetZ), 0.08);
        camera.lookAt(self.x, self.y + PLAYER_HEIGHT, self.z);
      }
    }

    const others = entities.filter((entity) => entity.entityId !== selfEntityId);
    const count = Math.min(others.length, MAX_OTHER_ENTITIES);
    const variantCounts = CHARACTER_MODEL_URLS.map(() => 0);
    for (const ids of entityIds.current) ids.length = 0;

    for (let i = 0; i < count; i += 1) {
      const entity = others[i];
      const variant = entity.skinId;
      const instance = variantCounts[variant]++;
      const mesh = otherCharacters.current[variant];
      entityIds.current[variant][instance] = entity.entityId;
      if (!mesh) continue;

      transform.position.set(entity.x, entity.y, entity.z);
      transform.rotation.set(0, entity.rotationY, 0);
      transform.updateMatrix();
      mesh.setMatrixAt(instance, transform.matrix);
    }

    for (let variant = 0; variant < otherCharacters.current.length; variant += 1) {
      const mesh = otherCharacters.current[variant];
      if (!mesh) continue;
      mesh.count = variantCounts[variant];
      mesh.instanceMatrix.needsUpdate = true;
    }
  });

  useEffect(() => {
    const handleShoot = (event: PointerEvent) => {
      if (event.button !== 0 || selfRole !== "seeker" || !aiming) return;
      const meshes = otherCharacters.current.filter(
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
      const targetEntityId = entityIds.current[variant]?.[hit.instanceId];
      if (targetEntityId) shoot(targetEntityId);
    };
    gl.domElement.addEventListener("pointerdown", handleShoot);
    return () => gl.domElement.removeEventListener("pointerdown", handleShoot);
  }, [aiming, camera, gl, raycaster, scene, selfRole, shoot]);

  return (
    <group>
      <group ref={selfRef} visible={false}>
        <mesh
          ref={selfMeshRef}
          geometry={characterAssets[0].geometry}
          material={characterAssets[0].material}
        />
      </group>
      {characterAssets.map((asset, variant) => (
        <instancedMesh
          key={CHARACTER_MODEL_URLS[variant]}
          ref={(mesh) => {
            otherCharacters.current[variant] = mesh;
          }}
          args={[asset.geometry, asset.material, MAX_OTHER_ENTITIES]}
          frustumCulled={false}
          userData={{ characterVariant: variant }}
        />
      ))}
    </group>
  );
}

function SeekerCamera() {
  const selfRole = useGameStore((s) => s.selfRole);
  const aiming = useGameStore((s) => s.aiming);
  const setAiming = useGameStore((s) => s.setAiming);
  const { camera, gl } = useThree();
  const pressed = useRef({ left: false, right: false });
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
    if (selfRole !== "seeker" || !aiming) return;
    const moveAim = (event: MouseEvent) => {
      aimYaw.current -= event.movementX * SEEKER_AIM_SENSITIVITY;
      aimPitch.current = THREE.MathUtils.clamp(
        aimPitch.current - event.movementY * SEEKER_AIM_SENSITIVITY,
        -Math.PI / 2 + 0.1,
        -0.05
      );
      camera.rotation.set(aimPitch.current, aimYaw.current, 0, "YXZ");
    };
    document.addEventListener("mousemove", moveAim);
    return () => document.removeEventListener("mousemove", moveAim);
  }, [aiming, camera, selfRole]);

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
    const direction = Number(pressed.current.right) - Number(pressed.current.left);
    if (direction === 0) return;
    if (aiming) {
      aimYaw.current -= direction * delta * 1.2;
      camera.rotation.set(aimPitch.current, aimYaw.current, 0, "YXZ");
      return;
    }
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
        style={{ cursor: selfRole === "seeker" && aiming ? "crosshair" : "default" }}
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
        </PerformanceMonitor>
      </Canvas>
      {selfRole === "seeker" && aiming && <ScopeOverlay />}
    </div>
  );
}

export default GameScene;
