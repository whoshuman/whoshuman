// Colocacion de las piezas del mapa 'neon-block'. GENERADO desde las cajas reales de los
// GLB: no editar a mano. Sale de la misma generacion que maps/neon-block.json (el mapa que
// obedece el servidor), asi que no pueden discrepar; tocar solo esto crearia paredes
// invisibles donde no se ve nada.
//
// Coordenadas en unidades de juego. La manzana la parten dos calzadas: una perimetral y otra
// que la divide por la mitad; los edificios ocupan las dos medias manzanas que quedan.
// groundOffset apoya cada modelo en el suelo (los GLB salen centrados en su origen) y
// collider es el AABB en XZ mas la altura real de la pieza.

export type MapPieceCollider = {
  minX: number;
  minZ: number;
  maxX: number;
  maxZ: number;
  height: number;
};

export type MapPiece = {
  model: string;
  x: number;
  z: number;
  rotationY: number;
  scale: number;
  groundOffset: number;
  collider: MapPieceCollider | null;
};

export const MAP_MODEL_BASE = "/models/mapa/";

// Trazado de las calzadas: el suelo se dibuja con las mismas medidas con las que se coloco
// todo lo demas, para que los edificios caigan dentro de sus manzanas.
export const ROADS = { width: 0.45, halfX: 2.5, halfZ: 2 };

export const mapPieces: MapPiece[] = [
  {
    model: "street-simple.glb",
    x: 0,
    z: 0,
    rotationY: 0,
    scale: 2.6267,
    groundOffset: -0.0729,
    collider: null
  },
  {
    model: "building-a-cyan-roof.glb",
    x: -1.15,
    z: -0.89,
    rotationY: 0,
    scale: 0.5758,
    groundOffset: 0.4711,
    collider: {
      minX: -1.7,
      minZ: -1.39,
      maxX: -0.6,
      maxZ: -0.39,
      height: 0.942
    }
  },
  {
    model: "building-c-pink-neon.glb",
    x: 1.15,
    z: -0.89,
    rotationY: 0,
    scale: 0.6499,
    groundOffset: 0.5776,
    collider: {
      minX: 0.55,
      minZ: -1.39,
      maxX: 1.75,
      maxZ: -0.39,
      height: 1.164
    }
  },
  {
    model: "building-b-screen-roof.glb",
    x: 1.1,
    z: 0.89,
    rotationY: 0,
    scale: 0.8763,
    groundOffset: 0.8345,
    collider: {
      minX: 0.6,
      minZ: 0.36,
      maxX: 1.6,
      maxZ: 1.41,
      height: 1.668
    }
  },
  {
    model: "lowpoly-tree.glb",
    x: -1.7,
    z: 0.89,
    rotationY: 2.3,
    scale: 0.4597,
    groundOffset: 0.4378,
    collider: {
      minX: -1.8,
      minZ: 0.79,
      maxX: -1.6,
      maxZ: 0.99,
      height: 0.875
    }
  },
  {
    model: "lowpoly-tree.glb",
    x: -0.95,
    z: 0.89,
    rotationY: 5.893,
    scale: 0.4597,
    groundOffset: 0.4378,
    collider: {
      minX: -1.05,
      minZ: 0.79,
      maxX: -0.85,
      maxZ: 0.99,
      height: 0.875
    }
  },
  {
    model: "lowpoly-tree.glb",
    x: -1.35,
    z: 0.47,
    rotationY: 5.516,
    scale: 0.4597,
    groundOffset: 0.4378,
    collider: {
      minX: -1.45,
      minZ: 0.37,
      maxX: -1.25,
      maxZ: 0.57,
      height: 0.875
    }
  },
  {
    model: "neon-sign-clean.glb",
    x: -0.44,
    z: -0.84,
    rotationY: 0.05,
    scale: 0.3941,
    groundOffset: 0.3752,
    collider: {
      minX: -0.48,
      minZ: -0.88,
      maxX: -0.39,
      maxZ: -0.79,
      height: 0.75
    }
  },
  {
    model: "neon-sign-clean.glb",
    x: 0.5,
    z: 0.56,
    rotationY: -0.121,
    scale: 0.3941,
    groundOffset: 0.3752,
    collider: {
      minX: 0.46,
      minZ: 0.51,
      maxX: 0.55,
      maxZ: 0.6,
      height: 0.75
    }
  },
  {
    model: "neon-lamppost.glb",
    x: -1.8,
    z: -1.35,
    rotationY: -2.214,
    scale: 0.5253,
    groundOffset: 0.5003,
    collider: {
      minX: -1.84,
      minZ: -1.39,
      maxX: -1.76,
      maxZ: -1.31,
      height: 1
    }
  },
  {
    model: "neon-lamppost.glb",
    x: 0.45,
    z: -0.45,
    rotationY: 2.356,
    scale: 0.5253,
    groundOffset: 0.5003,
    collider: {
      minX: 0.41,
      minZ: -0.49,
      maxX: 0.49,
      maxZ: -0.41,
      height: 1
    }
  },
  {
    model: "neon-lamppost.glb",
    x: -1.6,
    z: 1.3,
    rotationY: -0.888,
    scale: 0.5253,
    groundOffset: 0.5003,
    collider: {
      minX: -1.64,
      minZ: 1.26,
      maxX: -1.56,
      maxZ: 1.34,
      height: 1
    }
  },
  {
    model: "neon-lamppost.glb",
    x: 1.8,
    z: 1.3,
    rotationY: 0.945,
    scale: 0.5253,
    groundOffset: 0.5003,
    collider: {
      minX: 1.76,
      minZ: 1.26,
      maxX: 1.84,
      maxZ: 1.34,
      height: 1
    }
  },
  {
    model: "neon-lamppost.glb",
    x: 0.45,
    z: 0.95,
    rotationY: 0.442,
    scale: 0.5253,
    groundOffset: 0.5003,
    collider: {
      minX: 0.41,
      minZ: 0.91,
      maxX: 0.49,
      maxZ: 0.99,
      height: 1
    }
  },
  {
    model: "neon-lamppost.glb",
    x: -0.5,
    z: -1.35,
    rotationY: -2.787,
    scale: 0.5253,
    groundOffset: 0.5003,
    collider: {
      minX: -0.54,
      minZ: -1.39,
      maxX: -0.46,
      maxZ: -1.31,
      height: 1
    }
  },
  {
    model: "cell-pad.glb",
    x: -0.22,
    z: 0.68,
    rotationY: 5.73,
    scale: 0.0722,
    groundOffset: 0.0085,
    collider: null
  },
  {
    model: "cell-pad.glb",
    x: 2.28,
    z: -1.82,
    rotationY: 0.428,
    scale: 0.0722,
    groundOffset: 0.0085,
    collider: null
  },
  {
    model: "cell-pad.glb",
    x: -2.32,
    z: -1.82,
    rotationY: 5.6,
    scale: 0.0722,
    groundOffset: 0.0085,
    collider: null
  },
  {
    model: "cell-pad.glb",
    x: 2.28,
    z: 1.78,
    rotationY: 1.616,
    scale: 0.0722,
    groundOffset: 0.0085,
    collider: null
  },
  {
    model: "cell-pad.glb",
    x: -2.32,
    z: 1.78,
    rotationY: 1.061,
    scale: 0.0722,
    groundOffset: 0.0085,
    collider: null
  },
  {
    model: "cell-pad.glb",
    x: -0.02,
    z: -1.62,
    rotationY: 3.061,
    scale: 0.0722,
    groundOffset: 0.0085,
    collider: null
  },
  {
    model: "cell-pad.glb",
    x: 1.58,
    z: -0.02,
    rotationY: 5.295,
    scale: 0.0722,
    groundOffset: 0.0085,
    collider: null
  }
];

export const MAP_MODEL_URLS = [...new Set(mapPieces.map((p) => p.model))].map(
  (m) => MAP_MODEL_BASE + m
);
