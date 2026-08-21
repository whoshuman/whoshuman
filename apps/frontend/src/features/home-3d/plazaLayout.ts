import { MathUtils } from "three";

// Composicion de la plaza cyberpunk. Las coordenadas son "unidades de plaza": HomePlaza monta
// todo dentro de un grupo que aplica la posicion y la escala en el mundo, asi el layout se
// puede leer y retocar sin pensar en donde cae el paisaje retrowave.
// Eje Z positivo = lado de la camara (la entrada); Z negativo = fondo de la plaza.

// Modelos servidos desde public/models/plaza/. Los GLB vienen normalizados a ~1.9 unidades por
// el exportador, asi que el multiplicador es lo unico que separa un kiosko de una torre.
// Las torres van por encima del brief (9/10/11): vistas desde la camara del menu, que esta a
// ras de plaza y a 80 unidades de la primera fila, esas alturas se leian como maquetas.
export const PLAZA_MODELS = {
  tower: { url: "/models/plaza/tall-building-1.glb", scale: 15 },
  ziggurat: { url: "/models/plaza/tall-building-2.glb", scale: 17 },
  twinTowers: { url: "/models/plaza/tall-building-3.glb", scale: 19 },
  arcade: { url: "/models/plaza/low-building-1.glb", scale: 3.5 },
  noodleStand: { url: "/models/plaza/low-building-2.glb", scale: 3 },
  kiosk: { url: "/models/plaza/kiosk.glb", scale: 2.2 },
  entranceArch: { url: "/models/plaza/entrance-arch.glb", scale: 4.5 },
  fountain: { url: "/models/plaza/fountain.glb", scale: 4 }
} as const;

export type PlazaModelKey = keyof typeof PLAZA_MODELS;

export type PlazaPiece = {
  model: PlazaModelKey;
  x: number;
  z: number;
  scale: number;
  rotationY: number;
};

// Lado del plano de suelo y repeticiones de la baldosa (una baldosa = 4x4 unidades).
export const PLAZA_FLOOR_SIZE = 80;
export const PLAZA_FLOOR_REPEAT = 20;

// Edificios bajos de la zona de entrada, alternando arcade / puesto de fideos / kiosko.
const LOW_BUILDING_SPOTS: Array<Pick<PlazaPiece, "model" | "x" | "z">> = [
  { model: "arcade", x: -5.9, z: 10.1 },
  { model: "noodleStand", x: -13.8, z: 15 },
  { model: "kiosk", x: -7.5, z: 18 },
  { model: "noodleStand", x: 6.5, z: 10.1 },
  { model: "kiosk", x: 11, z: 15.3 },
  { model: "arcade", x: 6, z: 21.2 }
];

// Torres del perimetro: dos filas laterales que se alejan en diagonal y un fondo cerrado.
const TALL_BUILDING_SPOTS: Array<Pick<PlazaPiece, "model" | "x" | "z">> = [
  { model: "tower", x: -16, z: -5 },
  { model: "ziggurat", x: -25, z: -18 },
  { model: "twinTowers", x: -33, z: -30 },
  { model: "ziggurat", x: 16, z: -5 },
  { model: "twinTowers", x: 25, z: -18 },
  { model: "tower", x: 33, z: -30 },
  { model: "twinTowers", x: -17, z: -38 },
  { model: "tower", x: 0, z: -38 },
  { model: "ziggurat", x: 16, z: -38 }
];

// Anillo de construccion baja alrededor del corredor central. Densifica la plaza sin invadir
// el vacio del medio: cada pieza se apoya en la linea de fachada que ya marcaban las torres
// (x ~ +-11) o rellena los huecos entre ellas y por detras, hacia el borde del pavimento.
const LOW_RING_SPOTS: Array<Pick<PlazaPiece, "model" | "x" | "z">> = [
  // Flanco izquierdo, de la entrada al fondo.
  { model: "kiosk", x: -14.9, z: 8 },
  { model: "arcade", x: -21.1, z: 5 },
  { model: "kiosk", x: -13, z: -14.5 },
  { model: "noodleStand", x: -14.2, z: -20.6 },
  { model: "kiosk", x: -13, z: -26.9 },
  { model: "noodleStand", x: -19.4, z: -31 },
  // Flanco derecho.
  { model: "noodleStand", x: 15.6, z: 9.2 },
  { model: "kiosk", x: 17, z: 3 },
  { model: "kiosk", x: 13.3, z: -13 },
  { model: "noodleStand", x: 14.1, z: -20.9 },
  { model: "kiosk", x: 13, z: -27.1 },
  { model: "arcade", x: 21, z: -28 },
  // Segunda linea por fuera de las torres: da fondo al skyline y tapa los huecos entre ellas.
  { model: "kiosk", x: -27, z: -3 },
  { model: "arcade", x: -27, z: -40 },
  { model: "kiosk", x: 27, z: -3 },
  { model: "noodleStand", x: 28, z: -42 },
  // Explanada de la entrada, por fuera de los puestos que ya flanqueaban el arco.
  { model: "kiosk", x: -20, z: 17.2 },
  { model: "arcade", x: -22, z: 11.4 },
  { model: "noodleStand", x: 18, z: 16.8 },
  { model: "arcade", x: 22.4, z: 10.2 }
];

// Generador con semilla fija: la variacion de tamano y giro se calcula una vez y sale igual en
// cada carga, asi la plaza no "baila" al recargar ni cambia entre la home y el fondo global.
function createRandom(seed: number) {
  let state = seed;

  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

const random = createRandom(20260819);

// Devuelve un valor centrado en 0 dentro de +-range (grados de giro o fraccion de escala).
function jitter(range: number) {
  return (random() * 2 - 1) * range;
}

export const plazaPieces: PlazaPiece[] = [
  // El arco marca el acceso: centrado, en el borde cercano y mirando hacia el fondo (-Z).
  { model: "entranceArch", x: 0, z: 15, scale: PLAZA_MODELS.entranceArch.scale, rotationY: 0 },
  // Fuente: punto focal en el centro del vacio, alineada con el arco en x=0. La z pedida
  // (-2) era para el layout original; con el fondo ya separado a z -38, el centro entre
  // arco y fondo cae en -11, que es donde se lee centrada de verdad.
  { model: "fountain", x: 0, z: -11, scale: PLAZA_MODELS.fountain.scale, rotationY: 0 },
  ...LOW_BUILDING_SPOTS.map((spot) => ({
    ...spot,
    scale: PLAZA_MODELS[spot.model].scale,
    rotationY: MathUtils.degToRad(jitter(10))
  })),
  ...TALL_BUILDING_SPOTS.map((spot) => ({
    ...spot,
    // +-15% de escala para que las tres torres repetidas no se lean como copias.
    scale: PLAZA_MODELS[spot.model].scale * (1 + jitter(0.15)),
    rotationY: MathUtils.degToRad(jitter(8))
  })),
  ...LOW_RING_SPOTS.map((spot) => ({
    ...spot,
    scale: PLAZA_MODELS[spot.model].scale,
    rotationY: MathUtils.degToRad(jitter(10))
  }))
];
