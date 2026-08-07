import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Rectángulo en el plano XZ (coordenadas del cliente, mapa recolocado en su offset). */
export interface Rect {
  minX: number;
  minZ: number;
  maxX: number;
  maxZ: number;
}

/** Un edificio: bloquea al jugador. */
export type Obstacle = Rect;
/** Área jugable: el jugador no puede salir de aquí. */
export type Bounds = Rect;

/** Rejilla de alturas del suelo sobre el área jugable. data fila-mayor; null = sin suelo (vacío). */
export interface Heightmap {
  minX: number; // origen X de la rejilla
  minZ: number; // origen Z de la rejilla
  cell: number; // tamaño de celda
  cols: number;
  rows: number;
  data: (number | null)[]; // data[r * cols + c] = altura en (minX + c*cell, minZ + r*cell)
}

/** Geometría de un mapa. Única fuente de verdad: se cambia el JSON, no el código. */
export interface MapDescriptor {
  bounds: Bounds;
  obstacles: Obstacle[];
  heightmap: Heightmap;
}

/** Altura del suelo en (x,z) por interpolación bilineal. null si alguna esquina no tiene suelo. */
export function sampleHeight(hm: Heightmap, x: number, z: number): number | null {
  const fx = (x - hm.minX) / hm.cell;
  const fz = (z - hm.minZ) / hm.cell;
  let c0 = Math.floor(fx);
  let r0 = Math.floor(fz);
  c0 = c0 < 0 ? 0 : c0 > hm.cols - 2 ? hm.cols - 2 : c0;
  r0 = r0 < 0 ? 0 : r0 > hm.rows - 2 ? hm.rows - 2 : r0;
  const at = (c: number, r: number) => hm.data[r * hm.cols + c];
  const h00 = at(c0, r0);
  const h10 = at(c0 + 1, r0);
  const h01 = at(c0, r0 + 1);
  const h11 = at(c0 + 1, r0 + 1);
  if (h00 == null || h10 == null || h01 == null || h11 == null) return null;
  const tx = fx - c0;
  const tz = fz - r0;
  const a = h00 + (h10 - h00) * tx;
  const b = h01 + (h11 - h01) * tx;
  return a + (b - a) * tz;
}

const validRect = (r: unknown): r is Rect => {
  const v = r as Partial<Rect> | null;
  return (
    typeof v === "object" &&
    v !== null &&
    typeof v.minX === "number" &&
    typeof v.minZ === "number" &&
    typeof v.maxX === "number" &&
    typeof v.maxZ === "number" &&
    v.minX < v.maxX &&
    v.minZ < v.maxZ
  );
};

const validHeightmap = (h: unknown): h is Heightmap => {
  const v = h as Partial<Heightmap> | null;
  return (
    typeof v === "object" &&
    v !== null &&
    typeof v.cell === "number" &&
    v.cell > 0 &&
    typeof v.cols === "number" &&
    typeof v.rows === "number" &&
    v.cols >= 2 &&
    v.rows >= 2 &&
    Array.isArray(v.data) &&
    v.data.length === v.cols * v.rows
  );
};

/** Carga maps/<name>.json. Si falta o es inválido lanza: un mapa mal configurado es fallo de despliegue. */
export function loadMap(name: string): MapDescriptor {
  const file = join(__dirname, "maps", `${name}.json`);
  const m = JSON.parse(readFileSync(file, "utf8")) as MapDescriptor;
  if (!validRect(m.bounds) || !Array.isArray(m.obstacles) || !validHeightmap(m.heightmap)) {
    throw new Error(`Invalid map descriptor: ${file}`);
  }
  return m;
}
