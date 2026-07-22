import { AdaptiveDpr, PerformanceMonitor } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

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
const PLAYER_RADIUS = 0.09;
const MAX_OTHER_ENTITIES = 71; // 64 NPC + hasta 7 jugadores distintos del cliente
const SEEKER_AIM_DISTANCE = Math.max(MAP_W, MAP_D) * 0.7;
const SEEKER_OVERVIEW_DISTANCE = Math.max(MAP_W, MAP_D) * 1.35;
const SEEKER_AIM_SENSITIVITY = 0.002;

// Edificios: los AABB del server, tal cual, como cajas neón. UNA geometría y UN
// material compartidos entre las 10 cajas (regla: nunca gastar recursos dos veces).
function Obstacles() {
  const geometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#120a2a",
        emissive: new THREE.Color(getCssColor("--color-neon-cyan")),
        emissiveIntensity: 0.08
      }),
    []
  );
  const edges = useMemo(() => new THREE.EdgesGeometry(geometry), [geometry]);
  const lineMaterial = useMemo(
    () => new THREE.LineBasicMaterial({ color: getCssColor("--color-neon-cyan") }),
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
            <mesh geometry={geometry} material={material} />
            <lineSegments geometry={edges} material={lineMaterial} />
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

// El cliente solo conoce su propia entidad. Todas las demás se renderizan juntas:
// no existe ningún dato que permita distinguir humano de NPC.
function Units() {
  const selfEntityId = useGameStore((s) => s.selfEntityId);
  const selfRole = useGameStore((s) => s.selfRole);
  const aiming = useGameStore((s) => s.aiming);
  const shoot = useGameStore((s) => s.shoot);
  const { camera, gl } = useThree();
  const selfRef = useRef<THREE.Group>(null);
  const otherBodies = useRef<THREE.InstancedMesh>(null);
  const otherNoses = useRef<THREE.InstancedMesh>(null);
  const entityIds = useRef<string[]>([]);
  const transform = useMemo(() => new THREE.Object3D(), []);
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const yAxis = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const noseRotation = useMemo(
    () => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2),
    []
  );

  const capsule = useMemo(
    () => new THREE.CapsuleGeometry(PLAYER_RADIUS, PLAYER_HEIGHT - PLAYER_RADIUS * 2, 4, 12),
    []
  );
  const selfMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: getCssColor("--color-neon-magenta"),
        emissive: new THREE.Color(getCssColor("--color-neon-magenta")),
        emissiveIntensity: 0.5
      }),
    []
  );
  const otherMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: getCssColor("--color-neon-cyan"),
        emissive: new THREE.Color(getCssColor("--color-neon-cyan")),
        emissiveIntensity: 0.35
      }),
    []
  );
  // Cono de "mirada": marca hacia dónde apunta cada unidad.
  const nose = useMemo(() => new THREE.ConeGeometry(PLAYER_RADIUS * 0.5, 0.12, 8), []);

  useFrame(({ camera }) => {
    const entities = sampleWorld();
    const self = entities.find((entity) => entity.entityId === selfEntityId);

    if (selfRef.current) {
      selfRef.current.visible = selfRole !== "seeker" && !!self;
      if (selfRole !== "seeker" && self) {
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
    entityIds.current = others.slice(0, count).map((entity) => entity.entityId);
    if (otherBodies.current && otherNoses.current) {
      otherBodies.current.count = count;
      otherNoses.current.count = count;
      for (let i = 0; i < count; i += 1) {
        const entity = others[i];
        transform.position.set(entity.x, entity.y + PLAYER_HEIGHT / 2, entity.z);
        transform.rotation.set(0, entity.rotationY, 0);
        transform.updateMatrix();
        otherBodies.current.setMatrixAt(i, transform.matrix);

        transform.position.set(
          entity.x + Math.sin(entity.rotationY) * PLAYER_RADIUS * 1.4,
          entity.y + PLAYER_HEIGHT * 0.75,
          entity.z + Math.cos(entity.rotationY) * PLAYER_RADIUS * 1.4
        );
        transform.quaternion.setFromAxisAngle(yAxis, entity.rotationY).multiply(noseRotation);
        transform.updateMatrix();
        otherNoses.current.setMatrixAt(i, transform.matrix);
      }
      otherBodies.current.instanceMatrix.needsUpdate = true;
      otherNoses.current.instanceMatrix.needsUpdate = true;
    }
  });

  useEffect(() => {
    const handleShoot = (event: PointerEvent) => {
      if (event.button !== 0 || selfRole !== "seeker" || !aiming) return;
      const meshes = [otherBodies.current, otherNoses.current].filter(
        (mesh): mesh is THREE.InstancedMesh => mesh !== null
      );
      raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
      const hit = raycaster.intersectObjects(meshes)[0];
      if (hit?.instanceId === undefined) return;
      const targetEntityId = entityIds.current[hit.instanceId];
      if (targetEntityId) shoot(targetEntityId);
    };
    gl.domElement.addEventListener("pointerdown", handleShoot);
    return () => gl.domElement.removeEventListener("pointerdown", handleShoot);
  }, [aiming, camera, gl, raycaster, selfRole, shoot]);

  return (
    <group>
      <group ref={selfRef} visible={false}>
        <mesh geometry={capsule} material={selfMaterial} position={[0, PLAYER_HEIGHT / 2, 0]} />
        <mesh
          geometry={nose}
          material={selfMaterial}
          position={[0, PLAYER_HEIGHT * 0.75, PLAYER_RADIUS * 1.4]}
          rotation={[Math.PI / 2, 0, 0]}
        />
      </group>
      <instancedMesh
        ref={otherBodies}
        args={[capsule, otherMaterial, MAX_OTHER_ENTITIES]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={otherNoses}
        args={[nose, otherMaterial, MAX_OTHER_ENTITIES]}
        frustumCulled={false}
      />
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

// Canvas propio de la partida: escena ligera generada del mapa lógico. NO monta
// la ciudad GLB pesada (regla: nunca la misma escena pesada en dos canvases; y
// además sus muros no coinciden con las colisiones que simula el server).
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
          <Floor />
          <Obstacles />
          <Units />
          <SeekerCamera />
        </PerformanceMonitor>
      </Canvas>
      {selfRole === "seeker" && aiming && <ScopeOverlay />}
    </div>
  );
}

export default GameScene;
