// Colocacion de las piezas del mapa 'neon-block'. GENERADO desde las cajas reales de los
// GLB: no editar a mano. Sale de la misma generacion que maps/neon-block.json (el mapa que
// obedece el servidor), asi que no pueden discrepar; tocar solo esto crearia paredes
// invisibles donde no se ve nada.
//
// Coordenadas en unidades de juego. La manzana la parten dos calzadas: una perimetral y otra
// que la divide por la mitad; los edificios ocupan las dos medias manzanas que quedan.
// groundOffset apoya cada modelo en el suelo (los GLB salen centrados en su origen) y
// collider es el AABB en XZ mas la altura real de la pieza.
//
// UNICO retoque a mano sobre lo generado: el `scaleZ` de la losa de calle. La generacion
// da una escala uniforme por pieza y la losa es cuadrada, asi que sobresalia del mapa por
// el norte y el sur. Si se vuelve a generar este archivo, hay que reponerlo.

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
  // Escala propia en Z. Solo la usa la losa de calle (ver abajo); si falta, `scale` vale
  // para los tres ejes, que es lo que quieren edificios, arboles y farolas.
  scaleZ?: number;
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
    // La losa del GLB es CUADRADA: a escala uniforme cubre 5x5 y la manzana es de 5x4.
    // Sobraban 0.5 de suelo por el norte y otros 0.5 por el sur, y ahi se veia calzada
    // que el servidor no deja pisar — el area jugable acaba en z=±2. Se aplasta en Z lo
    // justo para que el canto de la losa coincida con el del mapa.
    scaleZ: (2.6267 * ROADS.halfZ) / ROADS.halfX,
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
  }
  // Los 7 "cell-pad.glb" que había aquí marcaban las posiciones fijas de las
  // antiguas collectibleSpawns (ver game-session.ts). Ahora las células nacen en
  // cualquier punto transitable del mapa, así que un pad clavado en el suelo ya
  // no señala nada real: se quita en vez de dejarlo mintiendo.
];

export const MAP_MODEL_URLS = [...new Set(mapPieces.map((p) => p.model))].map(
  (m) => MAP_MODEL_BASE + m
);
