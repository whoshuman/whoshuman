import { AdaptiveDpr, PerformanceMonitor } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

import { getCssColor } from "../../features/home-3d/homeSceneUtils";
import { useAuthStore } from "../../shared/authStore";
import betaCity from "../maps/beta-city.json";
import { useGameStore } from "../store/gameStore";
import { samplePlayers } from "../systems/interpolation";

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

// Todas las unidades del match. El roster es fijo por partida (viene del
// match-found), así que React monta una cápsula por jugador UNA vez; a partir
// de ahí todo es imperativo en useFrame — cero re-renders por tick.
function Players() {
  const selfId = useAuthStore((s) => s.user?.id);
  const roles = useGameStore((s) => s.roles);
  const roster = useMemo(() => Object.keys(roles), [roles]);
  const refs = useRef(new Map<string, THREE.Group>());

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
  const seekerRing = useMemo(() => new THREE.TorusGeometry(PLAYER_RADIUS * 1.9, 0.015, 8, 24), []);
  const seekerMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: getCssColor("--color-sun-orange")
      }),
    []
  );
  // Cono de "mirada": marca hacia dónde apunta cada unidad.
  const nose = useMemo(() => new THREE.ConeGeometry(PLAYER_RADIUS * 0.5, 0.12, 8), []);

  useFrame(({ camera }) => {
    const players = samplePlayers();
    const present = new Set(players.map((p) => p.userId));

    for (const userId of roster) {
      const group = refs.current.get(userId);
      if (!group) continue;
      const state = players.find((p) => p.userId === userId);
      // No present (aún sin game:join procesado, o se fue): oculto.
      group.visible = !!state;
      if (!state) continue;
      group.position.set(state.x, state.y, state.z);
      group.rotation.y = state.rotationY;

      if (userId === selfId) {
        // Cámara en tercera persona: detrás y por encima del propio jugador,
        // según su heading. Lerp para suavizar (patrón HomeCameraRig).
        const back = 1.6;
        const height = 1.1;
        const targetX = state.x - Math.sin(state.rotationY) * back;
        const targetZ = state.z - Math.cos(state.rotationY) * back;
        camera.position.lerp(new THREE.Vector3(targetX, state.y + height, targetZ), 0.08);
        camera.lookAt(state.x, state.y + PLAYER_HEIGHT, state.z);
      }
    }
    void present;
  });

  return (
    <group>
      {roster.map((userId) => (
        <group
          key={userId}
          visible={false}
          ref={(node) => {
            if (node) refs.current.set(userId, node);
            else refs.current.delete(userId);
          }}
        >
          <mesh
            geometry={capsule}
            material={userId === selfId ? selfMaterial : otherMaterial}
            position={[0, PLAYER_HEIGHT / 2, 0]}
          />
          {/* Nariz: cono apuntando a +Z local (heading 0 del server mira a +Z). */}
          <mesh
            geometry={nose}
            material={userId === selfId ? selfMaterial : otherMaterial}
            position={[0, PLAYER_HEIGHT * 0.75, PLAYER_RADIUS * 1.4]}
            rotation={[Math.PI / 2, 0, 0]}
          />
          {/* Anillo naranja bajo el Cazador: dato real del match-found. */}
          {roles[userId] === "seeker" && (
            <mesh
              geometry={seekerRing}
              material={seekerMaterial}
              position={[0, 0.02, 0]}
              rotation={[-Math.PI / 2, 0, 0]}
            />
          )}
        </group>
      ))}
    </group>
  );
}

// Canvas propio de la partida: escena ligera generada del mapa lógico. NO monta
// la ciudad GLB pesada (regla: nunca la misma escena pesada en dos canvases; y
// además sus muros no coinciden con las colisiones que simula el server).
function GameScene() {
  return (
    <Canvas dpr={[1, 1.5]} camera={{ position: [CENTER_X, 3, bounds.maxZ + 3], fov: 60 }}>
      <PerformanceMonitor>
        <AdaptiveDpr />
        <color attach="background" args={["#050014"]} />
        <fog attach="fog" args={["#050014", 8, 22]} />
        <ambientLight intensity={0.7} />
        <directionalLight position={[4, 8, 2]} intensity={0.8} />
        <Floor />
        <Obstacles />
        <Players />
      </PerformanceMonitor>
    </Canvas>
  );
}

export default GameScene;
