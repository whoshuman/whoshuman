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

const diagonal = normalizeJoystick(40, 40, 40, 0.12);
assert.ok(Math.abs(Math.hypot(diagonal.knobX, diagonal.knobY) - 40) < 0.000001);
assert.equal(diagonal.x, 1);
assert.equal(diagonal.y, 1);
assert.equal(normalizeJoystick(4, 0, 40, 0.12).x, 0);
