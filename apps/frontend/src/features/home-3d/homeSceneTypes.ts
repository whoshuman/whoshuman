export type HomeSceneProps = {
  isZoomed: boolean;
  // Gira la camara hacia la derecha (pantalla de edicion de perfil).
  lookRight?: boolean;
  // Gira la camara 180 grados (pantalla del equipo / sobre el proyecto).
  lookBack?: boolean;
};

// Props comunes para componentes que necesitan la paleta neon completa.
export type NeonPaletteProps = {
  colorCyan: string;
  colorGreen: string;
  colorMagenta: string;
  colorOrange: string;
};
