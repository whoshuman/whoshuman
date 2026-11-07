// Graba los planos del tráiler contra el stack local (`make dev` levantado en https://localhost).
//
//   pnpm --filter @whoshuman/trailer capture            todas las tomas
//   pnpm --filter @whoshuman/trailer capture home       solo las que empiezan por "home"
//
// Abre Chrome (el del sistema, con un perfil temporal limpio) con DOS jugadores en la misma
// sala: así hay un cazador y un cyborg de verdad y se puede grabar el disparo que acierta.
// Cada página se graba a sí misma con getDisplayMedia + MediaRecorder (la bandera
// --auto-accept-this-tab-capture se salta el diálogo) y los trozos llegan aquí por
// exposeFunction. Al acabar se pasan a MP4 de 30 fps con el ffmpeg que trae Remotion. La página
// que se graba renderiza al doble de resolución (supermuestreo) con la gráfica dedicada.
//
// Lo que se toca dentro de la página, sin cambiar nada del frontend:
// - Un gancho de React DevTools para llegar al store de react-three-fiber (cámara, escena).
//   Con él, el "director" lleva una cámara propia por la escena REAL de la partida: los
//   planos de cine salen del mundo de verdad, con la multitud moviéndose como en una partida.
// - Un espía de WebSocket que guarda el último snapshot del servidor: posiciones, celdas,
//   rol. Con eso se pilota al cyborg hacia las celdas y se apunta la mira del cazador.
// - Teclado y puntero sintéticos: el juego escucha en window/document y no mira isTrusted.
//
// Las cuentas se crean solas en la base LOCAL y se guardan en .capture-users.json (ignorado).
/* global window, document */
import { Buffer } from "node:buffer";
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import { chromium, request } from "playwright-core";

import { pageInit } from "./page-init.mjs";

const BASE_URL = process.env.TRAILER_BASE_URL ?? "https://localhost";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RAW_DIR = path.join(ROOT, "capture-raw");
const CLIPS_DIR = path.join(ROOT, "public", "clips");
const USERS_FILE = path.join(ROOT, ".capture-users.json");
const ONLY = process.argv[2] ?? "";

fs.mkdirSync(RAW_DIR, { recursive: true });
fs.mkdirSync(CLIPS_DIR, { recursive: true });

// ── ffmpeg ──────────────────────────────────────────────────────────────────────
// El de Remotion viene en un paquete por plataforma, colgado de @remotion/renderer. Es una
// compilación mínima (sin el filtro fps, por ejemplo), así que la cadencia va con -r.
function findFfmpeg() {
  const pkg = `@remotion/compositor-${process.platform}-${process.arch}${process.platform === "win32" ? "-msvc" : process.platform === "linux" ? "-gnu" : ""}`;
  try {
    const fromCli = createRequire(path.join(ROOT, "package.json")).resolve(
      "@remotion/cli/package.json"
    );
    const fromRenderer = createRequire(fromCli).resolve("@remotion/renderer/package.json");
    const compositor = createRequire(fromRenderer).resolve(`${pkg}/package.json`);
    return path.join(
      path.dirname(compositor),
      process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg"
    );
  } catch {
    return "ffmpeg";
  }
}
const FFMPEG = findFfmpeg();

function transcode(name) {
  const input = path.join(RAW_DIR, `${name}.webm`);
  const output = path.join(CLIPS_DIR, `${name}.mp4`);
  const result = spawnSync(
    FFMPEG,
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-i",
      input,
      "-r",
      "30",
      "-fps_mode",
      "cfr",
      "-c:v",
      "libx264",
      "-preset",
      "medium",
      "-crf",
      "16",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      output
    ],
    { stdio: "inherit" }
  );
  if (result.status !== 0) throw new Error(`ffmpeg falló con ${name}`);
  console.log(`  ✔ ${path.relative(ROOT, output)}`);
}

// ── Cuentas locales ─────────────────────────────────────────────────────────────
// Por el cliente HTTP de Playwright y no por fetch: el certificado local es autofirmado.
async function api(pathname, body) {
  const client = await request.newContext({ baseURL: BASE_URL, ignoreHTTPSErrors: true });
  try {
    const response = await client.post(pathname, { data: body });
    return { ok: response.ok(), data: await response.json().catch(() => null) };
  } finally {
    await client.dispose();
  }
}

async function ensureUsers() {
  if (fs.existsSync(USERS_FILE)) return JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
  const users = [];
  for (const base of ["N30N", "GL1TCH"]) {
    const suffix = crypto.randomBytes(2).toString("hex");
    const user = {
      username: base,
      email: `trailer-${base.toLowerCase()}-${suffix}@whoshuman.local`,
      password: `Trailer-${crypto.randomBytes(9).toString("hex")}`
    };
    let result = await api("/api/auth/register", { ...user, language: "es" });
    // Nombre ya cogido (otra base local): se le añade el sufijo.
    if (!result.ok) {
      user.username = `${base}_${suffix}`;
      result = await api("/api/auth/register", { ...user, language: "es" });
    }
    if (!result.ok) throw new Error(`No se pudo registrar ${base}: ${JSON.stringify(result.data)}`);
    users.push(user);
  }
  fs.writeFileSync(USERS_FILE, `${JSON.stringify(users, null, 2)}\n`);
  return users;
}

// ── Utilidades de Node ──────────────────────────────────────────────────────────
function shouldRun(name) {
  return !ONLY || name.startsWith(ONLY);
}

let players = [];

// Supermuestreo de la página que se graba. En la escena del menú (con bloom) el doble ya no
// llega a 30 fps; la partida sí aguanta el doble.
const SUPERSAMPLE = { game: 2, menu: 1.5 };

async function record(page, name, seconds, during) {
  if (!shouldRun(name)) {
    if (during) await during(0);
    return;
  }
  console.log(`● ${name}`);
  fs.rmSync(path.join(RAW_DIR, `${name}.webm`), { force: true });
  await page.bringToFront();
  // La que se graba renderiza al doble (supermuestreo: bordes limpios al bajar a 1080p) y la
  // otra a la mitad, para dejarle la GPU entera a la buena.
  for (const player of players) {
    await evalT(
      player,
      (dpr) => window.__trailer.setDpr(dpr),
      player === page ? SUPERSAMPLE[page.url().includes("/game") ? "game" : "menu"] : 0.5
    );
  }
  await sleep(300);
  await page.evaluate((n) => window.__trailer.record(n), name);
  const started = Date.now();
  if (during) await during(seconds);
  const left = seconds * 1000 - (Date.now() - started);
  if (left > 0) await sleep(left);
  await page.evaluate(() => window.__trailer.stopRecording());
  recorded.push(name);
}
// Se convierten al final: hacerlo entre toma y toma se comía el reloj de la ronda.
const recorded = [];

async function login(page, user) {
  await page.goto(`${BASE_URL}/login`);
  await page.fill('input[type="email"]', user.email);
  await page.fill('input[type="password"]', user.password);
  await page.keyboard.press("Enter");
  await page.waitForURL("**/lobby**", { timeout: 20000 });
}

const setHud = (page, mode) => page.evaluate((m) => window.__trailer.setHud(m), mode);
const evalT = (page, fn, arg) => page.evaluate(fn, arg);

// Planos de cámara para la manzana de la partida (unidades de juego: la manzana va de
// -2.5 a 2.5 en X y de -2 a 2 en Z, la calzada central corre a lo largo de Z por x=0 y el
// sol queda al fondo, hacia -Z). Cada uno es un cuerpo de función que recibe (u, T) con u de 0
// a 1 y devuelve { pos, look, fov }: tienen que viajar como texto a la página. Lo que un plano
// fija en su primer fotograma (T._side, T._orbAxis) se borra antes de empezar.
const SHOTS = {
  // A ras de suelo por la calzada central, metiéndose en la multitud con el sol de frente.
  streetDolly: {
    duration: 9000,
    at: `const e = u * u * (3 - 2 * u);
         return { pos: [0.02, 0.13 + e * 0.05, 2.7 - e * 2.1], look: [0, 0.16, -2.5], fov: 42 };`
  },
  // Grúa: arranca entre los NPC y sube hasta ver la manzana entera.
  craneReveal: {
    duration: 9000,
    at: `const e = u * u * (3 - 2 * u);
         return { pos: [1.95 + e * 1.4, 0.12 + e * 2.3, 1.85 + e * 1.9], look: [0.5 - e * 0.5, 0.15, 0.3 - e * 0.3], fov: 40 };`
  },
  // Órbita lenta y alta alrededor de la manzana.
  orbit: {
    duration: 9000,
    at: `const a = 0.45 + u * 0.9;
         return { pos: [Math.sin(a) * 3.6, 1.25, Math.cos(a) * 3.6], look: [0, 0.15, 0], fov: 38 };`
  },
  // La nave del cazador: tres cuartos por detrás, con la manzana al fondo.
  shipHero: {
    duration: 7000,
    smoothing: 0.15,
    at: `const s = T.state && T.state.seeker; if (!s) return null;
         const toCity = Math.atan2(-s.x, -s.z); const a = toCity + Math.PI + 0.75 - u * 0.45;
         return { pos: [s.x + Math.sin(a) * 0.8, s.y + 0.05 - u * 0.1, s.z + Math.cos(a) * 0.8],
                  look: [s.x * 0.8, s.y * 0.75, s.z * 0.8], fov: 50 };`
  },
  // Travelling lateral junto al cyborg (T.follow), por su lado de fuera: así lo que queda
  // detrás es la ciudad y no el vacío. El lado se decide en el primer fotograma y no cambia.
  trackSide: {
    duration: 7000,
    smoothing: 0.06,
    at: `const e = T.entity(T.follow) || (T.state && T.state.entities[0]); if (!e) return null;
         const h = e.rotationY; const fx = Math.sin(h), fz = Math.cos(h), rx = Math.cos(h), rz = -Math.sin(h);
         if (T._side === undefined) T._side = e.x * rx + e.z * rz > 0 ? 1 : -1;
         const s = T._side;
         return { pos: [e.x + rx * s * 0.8 + fx * 0.25, 0.3, e.z + rz * s * 0.8 + fz * 0.25],
                  look: [e.x + fx * 0.2, 0.15, e.z + fz * 0.2], fov: 40 };`
  },
  // Dron que sigue al cyborg desde detrás y por encima de los árboles.
  trackHigh: {
    duration: 7000,
    smoothing: 0.05,
    at: `const e = T.entity(T.follow) || (T.state && T.state.entities[0]); if (!e) return null;
         const h = e.rotationY;
         return { pos: [e.x - Math.sin(h) * 1.0, 0.95, e.z - Math.cos(h) * 1.0],
                  look: [e.x + Math.sin(h) * 0.45, 0.08, e.z + Math.cos(h) * 0.45], fov: 40 };`
  },
  // Primer plano del orbe (T.orb) a ras de suelo, de perfil respecto a por dónde llega el cyborg.
  orbCloseup: {
    duration: 60000,
    smoothing: 0.1,
    at: `const o = T.orb; if (!o) return null; const e = T.entity(T.follow);
         if (!T._orbAxis) { const dx = e ? e.x - o.x : 1, dz = e ? e.z - o.z : 0, d = Math.hypot(dx, dz) || 1; T._orbAxis = [dx / d, dz / d]; }
         const ax = T._orbAxis[0], az = T._orbAxis[1];
         return { pos: [o.x - az * 0.6 - ax * 0.15, 0.22, o.z + ax * 0.6 - az * 0.15],
                  look: [o.x + ax * 0.3, 0.13, o.z + az * 0.3], fov: 42 };`
  },
  // Casi cenital sobre la multitud, girando despacio: ¿cuál de todos es humano?
  crowdTop: {
    duration: 8000,
    at: `const a = 0.3 + u * 0.7;
         return { pos: [Math.sin(a) * 0.45, 2.7 - u * 0.5, Math.cos(a) * 0.45], look: [0, 0, 0], fov: 48 };`
  },
  // Home: vuelo por la avenida desde la pose de portada hasta la ciudad (la escena del menú va
  // en sus propias unidades: ver cameraPoses.ts del frontend).
  worldFlight: {
    duration: 8000,
    at: `const e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
         const z = 60 - e * 88; const y = -16 - e * 5;
         return { pos: [0, y, z], look: [0, y - 9, z - 40], fov: 55 };`
  }
};

async function direct(page, shotName) {
  const shot = SHOTS[shotName];
  await evalT(page, () => {
    window.__trailer._side = undefined;
    window.__trailer._orbAxis = undefined;
  });
  return page.evaluate(
    ({ duration, smoothing, at }) =>
      window.__trailer.direct({ duration, smoothing, at: new Function("u", "T", at) }),
    shot
  );
}

async function cinematic(page, name, shotName) {
  if (!shouldRun(name)) return;
  await setHud(page, "clean");
  await direct(page, shotName);
  await record(page, name, SHOTS[shotName].duration / 1000 - 0.3);
  await evalT(page, () => window.__trailer.cut());
}

async function waitFor(page, fn, arg, timeout = 30000) {
  await page.waitForFunction(fn, arg, { timeout, polling: 200 });
}

// El cyborg va a por un orbe concreto y se graba desde que está cerca hasta que lo coge.
// "cyborg": con su propia cámara y su HUD. "cine": primer plano del orbe con el director,
// sobre la página del cazador.
async function stealOrb(hunter, cyborg, name, mode) {
  if (!shouldRun(name)) return;
  const orb = await evalT(cyborg, () => {
    const T = window.__trailer;
    const me = T.entity(T.selfEntityId);
    if (!me) return null;
    const cells = T.state.collectibles
      .map((c) => ({ x: c.x, z: c.z, d: Math.hypot(c.x - me.x, c.z - me.z) }))
      .sort((p, q) => p.d - q.d);
    // Ni pegado (no daría tiempo a verlo llegar) ni en la otra punta.
    return cells.find((c) => c.d > 1.0 && c.d < 2.6) ?? cells[0] ?? null;
  });
  if (!orb) return;
  await evalT(cyborg, (point) => window.__trailer.autopilot(point), orb);
  const target = mode === "cine" ? hunter : cyborg;
  if (mode === "cine") {
    const id = await evalT(cyborg, () => window.__trailer.selfEntityId);
    await evalT(
      hunter,
      ({ o, follow }) => {
        window.__trailer.orb = o;
        window.__trailer.follow = follow;
      },
      { o: orb, follow: id }
    );
    await setHud(hunter, "clean");
    await direct(hunter, "orbCloseup");
  }
  await waitFor(
    cyborg,
    ({ x, z }) => {
      const T = window.__trailer;
      const me = T.entity(T.selfEntityId);
      return Boolean(me) && Math.hypot(me.x - x, me.z - z) < 1.3;
    },
    orb,
    20000
  ).catch(() => {});
  await record(target, name, 1, async () => {
    await waitFor(
      cyborg,
      ({ x, z }) =>
        !window.__trailer.state.collectibles.some((c) => Math.hypot(c.x - x, c.z - z) < 0.05),
      orb,
      10000
    ).catch(() => {});
    await sleep(1600);
  });
  if (mode === "cine") await evalT(hunter, () => window.__trailer.cut());
  await evalT(cyborg, () => window.__trailer.autopilot("cells"));
}

// ── Guion ───────────────────────────────────────────────────────────────────────
const users = await ensureUsers();
const browser = await chromium.launch({
  channel: "chrome",
  headless: false,
  args: [
    "--auto-accept-this-tab-capture",
    "--window-size=1920,1080",
    // La gráfica dedicada: con la integrada no da para el supermuestreo.
    "--force_high_performance_gpu",
    "--ignore-gpu-blocklist",
    "--disable-renderer-backgrounding",
    "--disable-background-timer-throttling",
    "--disable-backgrounding-occluded-windows"
  ]
});

async function newPlayer() {
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    ignoreHTTPSErrors: true
  });
  await context.addInitScript(pageInit);
  const page = await context.newPage();
  await page.exposeFunction("__trailerChunk", (name, base64) => {
    fs.appendFileSync(path.join(RAW_DIR, `${name}.webm`), Buffer.from(base64, "base64"));
  });
  return page;
}

const [a, b] = [await newPlayer(), await newPlayer()];
players = [a, b];

// El guion va en una función para poder cortar en cuanto no quede nada que grabar.
async function shoot() {
  // 1. La home: vuelo por el mundo retrowave de la portada, sin interfaz.
  await a.goto(`${BASE_URL}/`);
  await sleep(5000);
  await cinematic(a, "home-flight", "worldFlight");

  // 2. La sala, grabada desde la pantalla de A: crea la sala, entra su amigo y los dos se
  //    marcan listos. La grabación sigue en la carga de la partida. Aunque no se grabe, los
  //    pasos se dan igual: sin sala no hay partida.
  await login(a, users[0]);
  await login(b, users[1]);
  for (const page of [a, b]) await page.goto(`${BASE_URL}/lobby`);
  await sleep(3000);
  await setHud(a, "light");
  await record(a, "lobby-room", 12, async (seconds) => {
    const pause = (ms) => (seconds ? sleep(ms) : Promise.resolve());
    await pause(1000);
    await a.getByText("CREAR SALA").first().click();
    const code = (await a.locator("p.text-3xl").first().innerText()).trim();
    await pause(1800);
    await a.locator("button", { hasText: "→" }).last().click();
    await b.getByText("UNIRSE A SALA").first().click();
    await b.fill("#room-code", code);
    await pause(1500);
    await b.locator("button", { hasText: "→" }).last().click();
    // Con MATCHMAKING_MIN_PLAYERS=1 (lo de local), un "listo" con uno solo dentro ya arranca.
    // Si B llega antes de que la sala termine de crearse, su "unirse" se pierde: otro intento.
    const inRoom = () =>
      waitFor(a, (name) => document.body.innerText.includes(name), users[1].username, 8000);
    await inRoom().catch(async () => {
      await b.goto(`${BASE_URL}/lobby`);
      await b.getByText("UNIRSE A SALA").first().click();
      await b.fill("#room-code", code);
      await b.locator("button", { hasText: "→" }).last().click();
      await inRoom().catch(async (error) => {
        // Para ver qué pasó: cómo estaban las dos pantallas cuando se atascó.
        await a.screenshot({ path: path.join(RAW_DIR, "fallo-sala-a.png") });
        await b.screenshot({ path: path.join(RAW_DIR, "fallo-sala-b.png") });
        throw error;
      });
    });
    console.log(`  sala ${code} con los dos jugadores`);
    await pause(1600);
    await a.getByRole("button", { name: /^listo$/i }).click();
    await pause(1000);
    await b.getByRole("button", { name: /^listo$/i }).click();
  });
  await Promise.all([a.waitForURL("**/game**"), b.waitForURL("**/game**")]);
  for (const page of [a, b]) {
    await waitFor(
      page,
      () => window.__trailer.state && window.__trailer.selfUserId && window.__trailer.three()
    );
    await setHud(page, "light");
  }
  await sleep(2500);

  const roleOf = (page) => evalT(page, () => window.__trailer.role());
  let [hunter, cyborg] = (await roleOf(a)) === "seeker" ? [a, b] : [b, a];
  const cyborgEntity = await evalT(cyborg, () => window.__trailer.selfEntityId);
  console.log(`Ronda 1: cazador=${hunter === a ? "A" : "B"}`);

  // 3. Ronda 1: el cyborg entre la multitud, un orbe robado y el disparo que acierta. El
  //    disparo acaba la ronda (el cazador ha encontrado a todos), así que va al final.
  await evalT(cyborg, () => window.__trailer.autopilot("cells"));
  await record(cyborg, "cyborg-cells", 10);
  await stealOrb(hunter, cyborg, "cyborg-orb", "cyborg");

  // El disparo: mira, pasea por la multitud, falla con un NPC y acierta al cyborg. Antes, el
  // cyborg se va al borde de la manzana que da a la nave: si queda detrás de un edificio, la
  // bala se estrella en la pared. Ahí se queda quieto, que es además lo que hace un NPC.
  if (shouldRun("hunter-hit")) {
    const ship = await evalT(hunter, () => window.__trailer.state.seeker);
    const length = Math.hypot(ship.x, ship.z) || 1;
    const spot = {
      x: Math.max(-2.2, Math.min(2.2, (ship.x / length) * 1.75)),
      z: Math.max(-1.75, Math.min(1.75, (ship.z / length) * 1.75))
    };
    await evalT(cyborg, (point) => window.__trailer.autopilot(point), spot);
    await waitFor(cyborg, () => window.__trailer.arrived, null, 15000).catch(() => {});
    await evalT(cyborg, () => window.__trailer.autopilot("off"));
  }
  await record(hunter, "hunter-hit", 13, async (seconds) => {
    if (!seconds) return;
    await evalT(hunter, () => window.__trailer.tap("KeyF"));
    await sleep(1400);
    // Primero un NPC que se vea, junto al cyborg: el fallo que cuesta puntos.
    await evalT(
      hunter,
      (id) => {
        const T = window.__trailer;
        T.decoy = T.visibleDecoy(id, T.entity(id)).entityId;
        T.aimTrack((t) => {
          const e = t.entity(t.decoy);
          return e && { x: e.x, y: e.y + 0.16, z: e.z };
        }, 0.06);
      },
      cyborgEntity
    );
    await sleep(2600);
    await evalT(hunter, () => window.__trailer.shoot());
    await sleep(1400);
    await evalT(
      hunter,
      (id) =>
        window.__trailer.aimTrack((t) => {
          const e = t.entity(id);
          return e && { x: e.x, y: e.y + 0.16, z: e.z };
        }, 0.07),
      cyborgEntity
    );
    await sleep(2800);
    await evalT(hunter, () => window.__trailer.shoot());
    await sleep(400);
    await evalT(hunter, () => window.__trailer.aimStop());
  });
  await evalT(hunter, () => window.__trailer.aimStop());
  console.log(
    "  disparos:",
    JSON.stringify(
      await evalT(hunter, () => ({
        log: window.__trailer.shotLog,
        shots: window.__trailer.shots.length,
        scores: window.__trailer.state.scores.map((s) => `${s.username}:${s.score}`)
      }))
    )
  );

  // Espera a que empiece la ronda siguiente y devuelve [cazador, cyborg].
  async function nextRound(round) {
    await waitFor(
      a,
      (r) => window.__trailer.state && window.__trailer.state.round.current >= r,
      round,
      100000
    );
    await waitFor(a, () => window.__trailer.state.round.phase === "playing", null, 30000);
    await sleep(1500);
    const pair = (await roleOf(a)) === "seeker" ? [a, b] : [b, a];
    console.log(`Ronda ${round}: cazador=${pair[0] === a ? "A" : "B"}`);
    await evalT(pair[1], () => window.__trailer.autopilot("cells"));
    for (const page of [a, b]) await setHud(page, "light");
    return pair;
  }

  if (
    !["cine-", "cyborg-cells-2", "cyborg-orb-2", "hunter-scope", "hunter-overview"].some(shouldRun)
  ) {
    return;
  }

  // 4. Ronda 2: los planos de cine, con la cámara del director sobre la página del cazador
  //    mientras el cyborg sigue a lo suyo entre la multitud.
  [hunter, cyborg] = await nextRound(2);
  await stealOrb(hunter, cyborg, "cine-orb", "cine");
  const follow = await evalT(cyborg, () => window.__trailer.selfEntityId);
  await evalT(hunter, (id) => (window.__trailer.follow = id), follow);
  await cinematic(hunter, "cine-ship", "shipHero");
  await cinematic(hunter, "cine-top", "crowdTop");
  await cinematic(hunter, "cine-street", "streetDolly");
  await cinematic(hunter, "cine-track-side", "trackSide");
  await cinematic(hunter, "cine-track-high", "trackHigh");
  await cinematic(hunter, "cine-crane", "craneReveal");
  await cinematic(hunter, "cine-orbit", "orbit");
  await setHud(hunter, "light");

  // 5. Ronda 3: más juego desde los dos lados.
  [hunter, cyborg] = await nextRound(3);
  await record(hunter, "hunter-overview", 8, async (seconds) => {
    if (!seconds) return;
    await evalT(hunter, () => window.__trailer.key("KeyD", true));
    await sleep(7600);
    await evalT(hunter, () => window.__trailer.key("KeyD", false));
  });
  await record(cyborg, "cyborg-cells-2", 10);
  await stealOrb(hunter, cyborg, "cyborg-orb-2", "cyborg");
  await record(hunter, "hunter-scope", 10, async (seconds) => {
    if (!seconds) return;
    await evalT(hunter, () => window.__trailer.tap("KeyF"));
    await sleep(1400);
    await evalT(hunter, () => {
      const T = window.__trailer;
      const npc = T.visibleDecoy(null, { x: 0, z: 0 });
      T.aimTrack((t) => {
        const e = t.entity(npc.entityId);
        return e && { x: e.x, y: e.y + 0.16, z: e.z };
      }, 0.05);
    });
    await sleep(4500);
    await evalT(hunter, () => window.__trailer.shoot());
  });
  await evalT(hunter, () => window.__trailer.aimStop());
  await evalT(cyborg, () => window.__trailer.autopilot("off"));
}

try {
  await shoot();
} finally {
  await browser.close();
  for (const name of recorded) transcode(name);
}
