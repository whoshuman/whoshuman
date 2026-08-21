// ¿El foco está en algo donde el usuario está escribiendo? Los controles de la partida
// escuchan el teclado en `window`, así que sin esta comprobación se comen las teclas del
// chat: la "a" movía al personaje y, además, el preventDefault del giro de cámara impedía
// que la letra llegara a imprimirse en el campo.
//
// Se usa solo para IGNORAR pulsaciones (keydown). Las sueltas (keyup) deben procesarse
// siempre, o una tecla que se suelta con el chat ya abierto se quedaría marcada como
// pulsada y el personaje seguiría andando solo.
export function isTypingInField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;

  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}
