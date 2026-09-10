import assert from "node:assert/strict";

import { normalizeJoystick } from "./touchInput.ts";

assert.deepEqual(normalizeJoystick(0, 0, 40, 0.12), {
  knobX: 0,
  knobY: 0,
  x: 0,
  y: 0
});

assert.deepEqual(normalizeJoystick(80, 0, 40, 0.12), {
  knobX: 40,
  knobY: 0,
  x: 1,
  y: 0
});

// En diagonal el pomo se recorta al círculo (no al cuadrado): el vector sale de esa
// posición ya recortada, así que su magnitud nunca pasa de 1 (antes cada eje llegaba
// a 1 por separado, dando una magnitud de hasta √2).
const diagonal = normalizeJoystick(40, 40, 40, 0.12);
assert.ok(Math.abs(Math.hypot(diagonal.knobX, diagonal.knobY) - 40) < 0.000001);
assert.ok(Math.abs(Math.hypot(diagonal.x, diagonal.y) - 1) < 0.000001);
assert.ok(Math.abs(diagonal.x - diagonal.y) < 0.000001); // 45°: mismo peso en los dos ejes

// Zona muerta radial: un arrastre corto en diagonal se anula entero, no solo un eje.
const shortDiagonal = normalizeJoystick(3, 3, 40, 0.12);
assert.equal(shortDiagonal.x, 0);
assert.equal(shortDiagonal.y, 0);

assert.equal(normalizeJoystick(4, 0, 40, 0.12).x, 0);
