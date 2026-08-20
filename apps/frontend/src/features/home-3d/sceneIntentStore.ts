import { create } from "zustand";

// Intención de cámara de la home. Antes viajaba como props hasta HomeScene, pero el canvas
// ya no vive dentro de la home: es único y lo monta AppLayout, así que la home publica aquí
// lo que quiere que haga la cámara y el rig lo lee.
export type SceneIntent = {
  // Viaje hacia la ciudad al pulsar JUGAR.
  isZoomed: boolean;
  // Giro a la derecha: edición de perfil.
  lookRight: boolean;
  // Media vuelta hacia la luna: pantalla del equipo.
  lookBack: boolean;
  // Picado cenital sobre el coche, tras el giro.
  carFocus: boolean;
  // Carril del coche, bajo la ficha del equipo seleccionada.
  carX: number;
  // Monta la carretera, la luna y el coche (solo en "sobre el proyecto").
  showRoad: boolean;
};

const RESTING: SceneIntent = {
  isZoomed: false,
  lookRight: false,
  lookBack: false,
  carFocus: false,
  carX: 0,
  showRoad: false
};

type SceneIntentState = SceneIntent & {
  setIntent: (intent: Partial<SceneIntent>) => void;
  // Al desmontarse la home, la escena vuelve a su estado de reposo: si no, el resto de
  // pantallas heredarían un giro o un zoom que ya no viene a cuento.
  resetIntent: () => void;
};

export const useSceneIntent = create<SceneIntentState>((set) => ({
  ...RESTING,
  setIntent: (intent) => set(intent),
  resetIntent: () => set(RESTING)
}));
