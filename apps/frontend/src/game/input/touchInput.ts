export const TOUCH_SEEKER_LOOK_EVENT = "game:touch-seeker-look";
export const TOUCH_SEEKER_SHOOT_EVENT = "game:touch-seeker-shoot";

export interface TouchSeekerLookDetail {
  movementX: number;
  movementY: number;
}

export function moveTouchSeeker(movementX: number, movementY: number): void {
  window.dispatchEvent(
    new CustomEvent<TouchSeekerLookDetail>(TOUCH_SEEKER_LOOK_EVENT, {
      detail: { movementX, movementY }
    })
  );
}

export function shootTouchSeeker(): void {
  window.dispatchEvent(new Event(TOUCH_SEEKER_SHOOT_EVENT));
}
