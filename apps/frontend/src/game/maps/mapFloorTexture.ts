import { CanvasTexture, SRGBColorSpace } from "three";

import { ROADS } from "./neonBlockLayout";

// Suelo de la manzana dibujado en un canvas, no con un GLB. El modelo de calle que venía en
// los assets tenía 0,73 u de grosor y, apoyado en y=0, dejaba su superficie POR ENCIMA del
// suelo jugable: personajes y células aparecían enterrados debajo. Un plano a altura 0 no
// tiene ese problema y además es lo que quería el encargo (superficie lisa para que nadie
// se mueva a tirones sobre un relieve irregular).
//
// Trazado: calzada por todo el perímetro y una CRUZ en el centro (calle en X y calle en Z),
// el mismo que trae dibujado el GLB de la losa. Entre ellas quedan los cuatro cuadrantes
// donde se apoyan los edificios.

// Píxeles por unidad de juego. A 128 la línea más fina (2 px) mide ~1,5 cm de mundo.
const PX_PER_UNIT = 128;

export function createMapFloorTexture(colorMain: string, colorSecondary: string) {
  const { width: road, halfX, halfZ } = ROADS;
  const w = Math.round(halfX * 2 * PX_PER_UNIT);
  const h = Math.round(halfZ * 2 * PX_PER_UNIT);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const u = PX_PER_UNIT;
  const roadPx = road * u;

  // Manzana: hormigón oscuro con una trama tenue, para que no sea un plano liso muerto.
  ctx.fillStyle = "#0b0a16";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "rgba(255,255,255,0.03)";
  ctx.lineWidth = 1;
  for (let x = 0; x < w; x += u / 2) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 0; y < h; y += u / 2) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  // Calzada: perimetral (anillo) + la que parte la manzana por la mitad (banda central).
  const bands: Array<[number, number, number, number]> = [
    [0, 0, w, roadPx], // perimetral norte
    [0, h - roadPx, w, roadPx], // perimetral sur
    [0, 0, roadPx, h], // perimetral oeste
    [w - roadPx, 0, roadPx, h], // perimetral este
    [0, h / 2 - roadPx / 2, w, roadPx], // central en X
    [w / 2 - roadPx / 2, 0, roadPx, h] // central en Z: las dos forman la cruz de la losa
  ];
  ctx.fillStyle = "#141222";
  for (const [x, y, bw, bh] of bands) ctx.fillRect(x, y, bw, bh);

  // Bordillos neón en los cantos de cada calzada: es lo que dibuja el trazado a la vista.
  ctx.strokeStyle = colorMain;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 2;
  for (const [x, y, bw, bh] of bands) ctx.strokeRect(x, y, bw, bh);
  ctx.globalAlpha = 1;

  // Línea discontinua en el eje de cada calzada, como marca vial.
  ctx.strokeStyle = colorSecondary;
  ctx.globalAlpha = 0.7;
  ctx.lineWidth = 3;
  ctx.setLineDash([u * 0.18, u * 0.16]);
  const centerline = (x1: number, y1: number, x2: number, y2: number) => {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  };
  centerline(0, roadPx / 2, w, roadPx / 2);
  centerline(0, h - roadPx / 2, w, h - roadPx / 2);
  centerline(roadPx / 2, 0, roadPx / 2, h);
  centerline(w - roadPx / 2, 0, w - roadPx / 2, h);
  centerline(0, h / 2, w, h / 2);
  centerline(w / 2, 0, w / 2, h);
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  // Sin anisotropía el asfalto se convierte en moiré al verse casi de canto.
  texture.anisotropy = 8;

  return texture;
}
