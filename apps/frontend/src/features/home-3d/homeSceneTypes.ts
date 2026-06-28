export type HomeSceneProps = {
  isZoomed: boolean;
  // Gira la camara hacia la derecha (pantalla de edicion de perfil).
  lookRight?: boolean;
  // Gira la camara 180 grados (pantalla del equipo / sobre el proyecto).
  lookBack?: boolean;
  // Tras el giro, baja a vista cenital cercana sobre el coche.
  carFocus?: boolean;
};

// Props comunes para componentes que necesitan la paleta neon completa.
export type NeonPaletteProps = {
  colorCyan: string;
  colorGreen: string;
  colorMagenta: string;
  colorOrange: string;
};
