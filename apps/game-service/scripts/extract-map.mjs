// Genera un descriptor de mapa (maps/<name>.json) desde un GLB.
// Uso: node scripts/extract-map.mjs <archivo.glb> [--name beta-city] [--offset-x -8.5] [--offset-z -0.3] [--min-height 1] [--margin 1]
// Toma el AABB en XZ de cada malla "alta" (edificio) como obstáculo, y define el área jugable (bounds)
// como la caja de los edificios + un margen de calle (recortada al suelo real). Aplica el offset del cliente.
import { NodeIO, getBounds as bounds } from "@gltf-transform/core";
import { KHRDracoMeshCompression } from "@gltf-transform/extensions";
import draco3d from "draco3dgltf";
import * as THREE from "three";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const glb = args[0];
if (!glb) {
  console.error(
    "uso: node scripts/extract-map.mjs <archivo.glb> [--name n] [--offset-x n] [--offset-z n] [--min-height n]"
  );
  process.exit(1);
}
const flag = (k, d) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : d;
};
const name = flag("--name", "beta-city");
const offX = Number(flag("--offset-x", "-8.5"));
const offZ = Number(flag("--offset-z", "-0.3"));
const minH = Number(flag("--min-height", "1"));
const margin = Number(flag("--margin", "1")); // calle alrededor de los edificios
const cell = Number(flag("--cell", "0.25")); // resolución del heightmap

const io = new NodeIO().registerExtensions([KHRDracoMeshCompression]).registerDependencies({
  "draco3d.decoder": await draco3d.createDecoderModule()
});
const doc = await io.read(glb);
const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];

const obstacles = [];
let minGX = Infinity;
let maxGX = -Infinity;
let minGZ = Infinity;
let maxGZ = -Infinity;
const round = (n) => Math.round(n * 100) / 100;
for (const node of scene.listChildren()) walk(node);
function walk(node) {
  if (node.getMesh()) {
    const b = bounds(node); // world-space {min:[x,y,z], max:[x,y,z]}
    const h = b.max[1] - b.min[1];
    minGX = Math.min(minGX, b.min[0]);
    maxGX = Math.max(maxGX, b.max[0]);
    minGZ = Math.min(minGZ, b.min[2]);
    maxGZ = Math.max(maxGZ, b.max[2]);
    if (h >= minH) {
      obstacles.push({
        minX: round(b.min[0] + offX),
        minZ: round(b.min[2] + offZ),
        maxX: round(b.max[0] + offX),
        maxZ: round(b.max[2] + offZ)
      });
    }
  }
  for (const c of node.listChildren()) walk(c);
}

// suelo real (todas las mallas) en el frame del cliente, para recortar el área jugable
const groundMinX = minGX + offX;
const groundMaxX = maxGX + offX;
const groundMinZ = minGZ + offZ;
const groundMaxZ = maxGZ + offZ;
// área jugable = caja de los edificios + margen de calle, recortada al suelo real.
// Así el jugador no puede salir a los vacíos que rodean la ciudad (el bounding box global tiene outliers).
if (obstacles.length === 0) throw new Error("No se detectaron edificios (sube/baja --min-height)");
const playable = {
  minX: round(Math.max(Math.min(...obstacles.map((o) => o.minX)) - margin, groundMinX)),
  minZ: round(Math.max(Math.min(...obstacles.map((o) => o.minZ)) - margin, groundMinZ)),
  maxX: round(Math.min(Math.max(...obstacles.map((o) => o.maxX)) + margin, groundMaxX)),
  maxZ: round(Math.min(Math.max(...obstacles.map((o) => o.maxZ)) + margin, groundMaxZ))
};

// ---- heightmap: raycast hacia abajo sobre una rejilla del área jugable ----
// Construimos la geometría del GLB en three (world-space) y lanzamos rayos.
const meshes = [];
const raycaster = new THREE.Raycaster();
const DOWN = new THREE.Vector3(0, -1, 0);
function collect(node, parentWorld) {
  const local = new THREE.Matrix4().fromArray(node.getMatrix());
  const world = parentWorld.clone().multiply(local);
  const mesh = node.getMesh();
  // solo suelo/rampas para el raycast (excluimos edificios: sus tejados falsearían la altura del suelo).
  const isBuilding = mesh && bounds(node).max[1] - bounds(node).min[1] >= minH;
  if (mesh && !isBuilding) {
    for (const prim of mesh.listPrimitives()) {
      const posAttr = prim.getAttribute("POSITION");
      if (!posAttr) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute(
        "position",
        new THREE.BufferAttribute(Float32Array.from(posAttr.getArray()), 3)
      );
      const idx = prim.getIndices();
      if (idx) g.setIndex(new THREE.BufferAttribute(Uint32Array.from(idx.getArray()), 1));
      g.applyMatrix4(world);
      meshes.push(new THREE.Mesh(g));
    }
  }
  for (const c of node.listChildren()) collect(c, world);
}
for (const node of scene.listChildren()) collect(node, new THREE.Matrix4());

const cols = Math.round((playable.maxX - playable.minX) / cell) + 1;
const rows = Math.round((playable.maxZ - playable.minZ) / cell) + 1;
const data = [];
let hits = 0;
for (let r = 0; r < rows; r++) {
  for (let c = 0; c < cols; c++) {
    // punto de rejilla en frame server → nativo (deshaciendo el offset del cliente) para raycast
    const sx = playable.minX + c * cell;
    const sz = playable.minZ + r * cell;
    raycaster.set(new THREE.Vector3(sx - offX, 1000, sz - offZ), DOWN);
    const hit = raycaster.intersectObjects(meshes, false);
    if (hit.length) {
      data.push(round(hit[0].point.y));
      hits++;
    } else {
      data.push(null);
    }
  }
}
const heightmap = { minX: playable.minX, minZ: playable.minZ, cell, cols, rows, data };

const out = { bounds: playable, obstacles, heightmap };
const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "game", "maps");
mkdirSync(dir, { recursive: true });
const file = join(dir, `${name}.json`);
writeFileSync(file, JSON.stringify(out, null, 2) + "\n");

// self-check (ponytail): el JSON generado debe validar el esquema mínimo
console.assert(
  playable.minX < playable.maxX && playable.minZ < playable.maxZ,
  "bounds deben tener min < max"
);
for (const o of out.obstacles) {
  console.assert(o.minX < o.maxX && o.minZ < o.maxZ, "cada obstáculo debe tener min < max");
}
console.assert(data.length === cols * rows, "heightmap: data debe tener cols*rows celdas");
console.assert(hits > 0, "heightmap: ninguna celda con suelo (¿offset o geometría mal?)");
console.log(
  `escrito ${file} — ${obstacles.length} obstáculos, área jugable ` +
    `x[${playable.minX},${playable.maxX}] z[${playable.minZ},${playable.maxZ}]` +
    `, heightmap ${cols}×${rows} (${hits}/${cols * rows} con suelo)`
);
