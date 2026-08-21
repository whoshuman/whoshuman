import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from "three";

// El pack de modelos no traia floor-tile.glb, asi que la baldosa de la plaza se dibuja en un
// canvas (misma tecnica que HomeSun) y se repite sobre el plano. Al usar los colores del
// design system la plaza encaja con la rejilla neon del paisaje en lugar de parecer un parche.
export function createPlazaFloorTexture(colorMain: string, colorSecondary: string) {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // Base violeta muy oscura: el suelo no debe competir con los neones de los edificios.
  ctx.fillStyle = "#0b0320";
  ctx.fillRect(0, 0, size, size);

  // Junta luminosa de la baldosa. El halo exterior simula el rebote del neon en el pavimento.
  ctx.strokeStyle = colorMain;
  ctx.globalAlpha = 0.22;
  ctx.lineWidth = 14;
  ctx.strokeRect(0, 0, size, size);
  ctx.globalAlpha = 1;
  ctx.lineWidth = 4;
  ctx.strokeRect(0, 0, size, size);

  // Cruz interior magenta: rompe la monotonia al repetir la textura 20x20.
  ctx.strokeStyle = colorSecondary;
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(size / 2, size * 0.34);
  ctx.lineTo(size / 2, size * 0.66);
  ctx.moveTo(size * 0.34, size / 2);
  ctx.lineTo(size * 0.66, size / 2);
  ctx.stroke();

  // Marca de registro en las esquinas, tipo señaletica de plaza.
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = colorMain;
  const mark = size * 0.06;
  ctx.fillRect(mark, mark, mark, mark);
  ctx.fillRect(size - mark * 2, mark, mark, mark);
  ctx.fillRect(mark, size - mark * 2, mark, mark);
  ctx.fillRect(size - mark * 2, size - mark * 2, mark, mark);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  // Sin anisotropia el pavimento se convierte en moire al verse casi de canto desde la camara.
  texture.anisotropy = 8;

  return texture;
}
