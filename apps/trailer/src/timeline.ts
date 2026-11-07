// Guion del tráiler: qué plano va en cada momento y qué dice. Todo cae sobre la rejilla de
// la música ("Cold Fire", de Neozoic, la misma del menú del juego): 135,3 BPM, compás de
// 1,774 s. Los números salen de analizar la pista (energía por bandas y autocorrelación del
// bombo), no de oído: si algún corte suena raro, se mueve aquí y nada más.
//
// La música va SEGUIDA y DESDE EL PRINCIPIO de la canción, como al pulsar JUGAR en el juego:
// a los 0,3 s suena el botón y arranca la pista. Su primer compás lo ocupa la apertura en
// negro (el nombre encendiéndose), y el contenido entra en el compás 1. De ahí en adelante
// cada corte cae en línea de compás.

export const FPS = 30;

const BEAT = 0.44345;
const BAR = 4 * BEAT;
// El primer compás de la canción empieza a los 35 ms.
const PHASE = 0.035;

/** Cuándo suena el botón JUGAR y entra la canción. */
export const MUSIC_AT = 0.3;
/** La canción se usa entera desde su inicio. */
export const MUSIC_FROM = 0;

/** Segundos del tráiler donde empieza el compás n del contenido (el 0 es el 1 de la canción). */
const songBar = (n: number) => MUSIC_AT + PHASE + (n + 1) * BAR;

/** Fin de la apertura en negro: dura el primer compás de la canción. */
export const PRE = songBar(0);

/** El título, a los 4 compases: el corte de la intro al juego. */
export const CUT = songBar(4);
/** Segundos del tráiler donde empieza el compás j contado desde el título. */
export const barB = (j: number) => CUT + j * BAR;
/** Donde cae el logo final. */
export const HIT = barB(16);
/** Fin del tráiler, con la música ya fundida. */
export const END = barB(21);
/** El disparo que acierta, en el primer tiempo de un compás. */
export const SHOT = barB(12);

export const sec = (seconds: number) => Math.round(seconds * FPS);

export type Shot = {
  clip: string;
  from: number;
  to: number;
  /** Segundo del clip por el que entra. */
  clipStart: number;
  /** "full" llena el cuadro también en 4:5; "window" va en la ventana 16:9 del centro. */
  frame: "full" | "window";
  rate?: number;
  /** Acercar una zona del clip: escala y punto de anclaje (0..1). Para interfaces pequeñas. */
  zoom?: { scale: number; x: number; y: number };
};

// En hunter-hit el disparo suena a los 8,40 s del clip: se hace coincidir con SHOT.
const HIT_CLIP_SHOT = 8.4;
// En cine-orb el cyborg se lleva el orbe a los 2,60 s del clip. Justo después le pasa un NPC
// pegado a la cámara, así que el plano se corta a los 2,85.
const ORB_CLIP_GRAB = 2.6;
/** El momento en que desaparece el orbe: ahí suena el efecto del juego. */
export const ORB_GRAB = barB(8) + ORB_CLIP_GRAB;

export const SHOTS: Shot[] = [
  { clip: "cine-top", from: songBar(0), to: songBar(2), clipStart: 0.3, frame: "full" },
  { clip: "cine-street", from: songBar(2), to: CUT, clipStart: 1.2, frame: "full" },
  { clip: "home-flight", from: CUT, to: barB(2), clipStart: 1.6, frame: "full" },
  // La sala: el panel de la interfaz es pequeño en 1080p, así que se acerca.
  {
    clip: "lobby-room",
    from: barB(2),
    to: barB(4),
    // Hasta 7,15 s: después la pantalla se va a negro al cargar la partida.
    clipStart: 3.6,
    frame: "window",
    zoom: { scale: 1.45, x: 0.44, y: 0.36 }
  },
  { clip: "cine-ship", from: barB(4), to: barB(6), clipStart: 0.8, frame: "window" },
  { clip: "cine-track-side", from: barB(6), to: barB(8), clipStart: 0.4, frame: "window" },
  { clip: "cine-orb", from: barB(8), to: barB(8) + 2.85, clipStart: 0, frame: "window" },
  { clip: "cyborg-cells-2", from: barB(8) + 2.85, to: barB(10), clipStart: 6.0, frame: "window" },
  {
    clip: "hunter-hit",
    from: barB(10),
    to: barB(13),
    clipStart: HIT_CLIP_SHOT - (SHOT - barB(10)),
    frame: "window"
  },
  {
    clip: "hunter-overview",
    from: barB(13),
    to: barB(13) + 2 * BEAT,
    clipStart: 1.0,
    frame: "window"
  },
  {
    clip: "hunter-scope",
    from: barB(13) + 2 * BEAT,
    to: barB(14),
    clipStart: 2.5,
    frame: "window"
  },
  { clip: "cine-crane", from: barB(14), to: HIT, clipStart: 2.0, frame: "window" },
  // Fondo del cierre: más largo que el clip, así que va algo más lento.
  { clip: "cine-orbit", from: HIT, to: END, clipStart: 0, frame: "full", rate: 0.85 }
];

export type Caption = {
  from: number;
  to: number;
  kicker?: string;
  text: string;
  sub?: string;
  /** "overlay" va encima del vídeo (planos a pantalla completa); "bands", en las franjas. */
  place: "overlay" | "bands";
  accent?: "magenta" | "cyan";
};

// Solo en la versión de publicación (4:5). La 16:9 va en crudo, sin textos.
export const CAPTIONS: Caption[] = [
  {
    from: songBar(0) + 0.25,
    to: songBar(2) - 0.1,
    text: "Una ciudad llena de NPC.",
    place: "overlay"
  },
  {
    from: songBar(2) + 0.1,
    to: CUT - 0.05,
    text: "Algunos no son lo que parecen.",
    place: "overlay"
  },
  {
    from: barB(2) + 0.1,
    to: barB(4) - 0.1,
    kicker: "// Multijugador",
    text: "Únete a una sala con tus amigos.",
    sub: "Hasta 8 jugadores por partida.",
    place: "bands"
  },
  {
    from: barB(4) + 0.1,
    to: barB(6) - 0.1,
    kicker: "// El cazador",
    text: "Uno de vosotros es el cazador.",
    place: "bands"
  },
  {
    from: barB(6) + 0.1,
    to: barB(8) - 0.1,
    kicker: "// Los cyborgs",
    text: "Los demás se esconden entre la multitud.",
    place: "bands"
  },
  {
    from: barB(8) + 0.1,
    to: barB(10) - 0.1,
    text: "Y roban orbes de energía…",
    sub: "…cuando el cazador no mira. +25 por orbe.",
    place: "bands"
  },
  {
    from: barB(10) + 0.1,
    to: SHOT - 0.05,
    text: "Vigila. Sospecha.",
    sub: "Si le das a un NPC, pierdes 25 puntos.",
    place: "bands"
  },
  {
    from: SHOT,
    to: barB(13) - 0.05,
    text: "¡Cazado!",
    sub: "+100 · Cyborg eliminado",
    place: "bands",
    accent: "magenta"
  },
  {
    from: barB(13),
    to: barB(14) - 0.05,
    text: "3 rondas · 90 segundos",
    sub: "Los papeles rotan en cada ronda.",
    place: "bands"
  }
];

/** Tarjeta técnica, sobre la grúa: de barB(14) al golpe. */
export const TECH = {
  from: barB(14),
  to: HIT,
  kicker: "// Bajo el capó",
  text: "Multijugador en tiempo real",
  chips: [
    "Servidor autoritativo",
    "8 microservicios",
    "NATS",
    "Socket.IO",
    "React Three Fiber",
    "PostgreSQL"
  ]
};

// Nombres y papeles tal cual salen en la página del equipo del juego (AboutTeam.tsx).
export const TEAM = [
  { name: "Sergio Marin", role: "Frontend" },
  { name: "Daniel Escamil", role: "Backend & 3D" },
  { name: "Edu Zhan", role: "Product Owner & Backend" },
  { name: "Juan Delorme", role: "Product Manager & Frontend" },
  { name: "Luis David Diaz", role: "Arquitecto & Backend" }
];

export const CAMPUS = "42 Madrid";
