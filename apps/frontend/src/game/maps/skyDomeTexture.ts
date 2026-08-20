import { CanvasTexture, SRGBColorSpace } from "three";

// Cielo de la partida. Antes era una imagen HTML detrás del canvas, y eso lo dejaba clavado
// a la pantalla: al girar la cámara del cazador el mundo rotaba y el cielo no, que es lo que
// delataba que era un decorado plano. Ahora es una textura para una cúpula dentro de la
// escena, así que gira con la vista como cualquier otra cosa del mundo.
//
// Es un degradado vertical generado aquí y no una foto: una equirectangular de verdad
// necesitaría un asset preparado para eso, y una imagen plana estirada sobre una esfera se
// deforma en los polos. El degradado no tiene ese problema y pesa nada.

// Alto de la textura. El ancho es 2 px: el degradado solo varía en vertical, así que
// repetir columnas sería malgastar memoria.
const HEIGHT = 512;

export function createSkyDomeTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 2;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // De cenit a suelo: violeta profundo arriba, el naranja/magenta del atardecer a la altura
  // del horizonte y otra vez oscuro por debajo, donde ya asoma la rejilla.
  const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  gradient.addColorStop(0, "#160a33");
  gradient.addColorStop(0.34, "#3b1361");
  gradient.addColorStop(0.52, "#8e2a86");
  gradient.addColorStop(0.62, "#e0538c");
  gradient.addColorStop(0.7, "#ff9f5c");
  gradient.addColorStop(0.76, "#5b1f63");
  gradient.addColorStop(1, "#0d0520");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 2, HEIGHT);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;

  return texture;
}
