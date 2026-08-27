export const TOUCH_CAMERA_EVENT = "game:touch-camera";
export const TOUCH_SEEKER_SHOOT_EVENT = "game:touch-seeker-shoot";

export interface TouchCameraDetail {
  x: number;
  y: number;
}

export interface JoystickVector {
  knobX: number;
  knobY: number;
  x: number;
  y: number;
}

export function normalizeJoystick(
  rawX: number,
  rawY: number,
  radius: number,
  deadZone: number
): JoystickVector {
  const distance = Math.hypot(rawX, rawY);
  const scale = distance > radius ? radius / distance : 1;
  const knobX = rawX * scale;
  const knobY = rawY * scale;
  const axisX = Math.max(-1, Math.min(1, rawX / radius));
  const axisY = Math.max(-1, Math.min(1, rawY / radius));
  const x = Math.abs(axisX) < deadZone ? 0 : axisX;
  const y = Math.abs(axisY) < deadZone ? 0 : axisY;
  return { knobX, knobY, x, y };
}

export function setTouchCamera(x: number, y: number): void {
  window.dispatchEvent(
    new CustomEvent<TouchCameraDetail>(TOUCH_CAMERA_EVENT, {
      detail: { x, y }
    })
  );
}

export function shootTouchSeeker(): void {
  window.dispatchEvent(new Event(TOUCH_SEEKER_SHOOT_EVENT));
}
