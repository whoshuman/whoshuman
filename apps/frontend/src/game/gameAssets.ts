// Manifiesto de los GLB que necesita la partida. Vive fuera de GameScene a proposito: la
// escena de juego viaja en un chunk diferido que no se descarga hasta navegar a /game, asi
// que una lista encerrada alli no la puede leer nadie por adelantado. Aqui la lee tambien
// el lobby, que es justo donde hay tiempo muerto que aprovechar mientras se llena la sala.

import { useGLTF } from "@react-three/drei";

import { MAP_MODEL_URLS } from "./maps/neonBlockLayout";

// Debe coincidir con CHARACTER_SKIN_COUNT del game-service: el server manda skinId y
// GameScene indexa este array directamente, asi que el orden es parte del contrato.
export const CHARACTER_MODEL_URLS: string[] = [
  "/models/personajes/neon-vixen.glb",
  "/models/personajes/cubist-warrior.glb",
  "/models/personajes/purple-visor.glb",
  "/models/personajes/pixel-voyager.glb"
];

export const CELL_MODEL_URL = "/models/energy-cell.glb";
export const CHASER_MODEL_URL = "/models/chaser.glb";
// La plataforma donde nacen las células. No va en MAP_MODEL_URLS porque no es una pieza del
// layout generado: sus posiciones salen del JSON del mapa, que es lo que obedece el servidor.
export const PAD_MODEL_URL = "/models/mapa/cell-pad.glb";

// Todo lo que la partida acaba pidiendo: la manzana, las cuatro pieles, el coleccionable,
// los pads y la nave del cazador.
export const GAME_MODEL_URLS: readonly string[] = [
  ...MAP_MODEL_URLS,
  ...CHARACTER_MODEL_URLS,
  CELL_MODEL_URL,
  PAD_MODEL_URL,
  CHASER_MODEL_URL
];

// useGLTF.preload deja en cache la escena ya parseada, indexada por URL: cuando GameScene
// monte y pida el mismo fichero se lo encuentra hecho, sin red ni parseo. Llamarla de mas
// no cuesta, la cache de drei responde a la segunda sin volver a bajar nada.
export function preloadGameModels() {
  for (const url of GAME_MODEL_URLS) useGLTF.preload(url);
}
