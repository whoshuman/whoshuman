// Lee tokens CSS del design system para usarlos dentro de Three.js.
// Esto evita duplicar colores entre Tailwind/CSS y los materiales de la escena.
export function getCssColor(variableName: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(variableName).trim();
}
