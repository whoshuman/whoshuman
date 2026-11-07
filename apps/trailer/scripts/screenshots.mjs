// Capturas fijas del juego para acompañar al vídeo en LinkedIn:
//
//   pnpm --filter @whoshuman/trailer screenshots
//
// Salen en 4:5 (1080×1350, el formato que más ocupa en el feed) a `out/capturas/`. No se
// sacan del tráiler: el vídeo ya viene comprimido dos veces. Se toman dentro de una partida
// de verdad, con la ventana en vertical a 2160×2700, el motor renderizando a 3240×4050 y una
// reducción final a 1080×1350. Tres pasadas de supermuestreo: quedan mucho más limpias.
//
// Igual que `capture.mjs`: dos jugadores en una sala, el "director" coloca la cámara en la
// escena real y el HUD se enseña solo donde cuenta algo (la sala y la mira).
/* global window, document */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright-core";

import { pageInit } from "./page-init.mjs";

const BASE_URL = process.env.TRAILER_BASE_URL ?? "https://localhost";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "out", "capturas");
const USERS_FILE = path.join(ROOT, ".capture-users.json");
const ONLY = process.argv[2] ?? "";
const WIDTH = 1080;
const HEIGHT = 1350;

fs.mkdirSync(OUT_DIR, { recursive: true });

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

/** Baja la captura a 1080×1350 y la guarda en JPEG. El PNG grande se tira. */
function downscale(name) {
  const source = path.join(OUT_DIR, `${name}.png`);
  const output = path.join(OUT_DIR, `${name}.jpg`);
  const result = spawnSync(
    FFMPEG,
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-i",
      source,
      "-vf",
      `scale=${WIDTH}:${HEIGHT}:flags=lanczos`,
      "-q:v",
      "2",
      output
    ],
    { stdio: "inherit" }
  );
  if (result.status !== 0) throw new Error(`ffmpeg falló con ${name}`);
  fs.rmSync(source, { force: true });
  console.log(`  ✔ ${path.relative(ROOT, output)}`);
}

const evalT = (page, fn, arg) => page.evaluate(fn, arg);
const setHud = (page, mode) => page.evaluate((m) => window.__trailer.setHud(m), mode);
const waitFor = (page, fn, arg, timeout = 30000) =>
  page.waitForFunction(fn, arg, { timeout, polling: 200 });

// `screenshots 04,06` repite solo esas.
const shouldRun = (name) => !ONLY || ONLY.split(",").some((prefix) => name.startsWith(prefix));

async function shot(page, name) {
  if (!shouldRun(name)) return;
  await page.bringToFront();
  // El motor, a 3× el tamaño en píxeles CSS: la reducción posterior hace de antialias.
  await evalT(page, () => window.__trailer.setDpr(3));
  await sleep(900);
  await page.screenshot({ path: path.join(OUT_DIR, `${name}.png`), type: "png" });
  await evalT(page, () => window.__trailer.setDpr(1));
  downscale(name);
}

/** Coloca la cámara del director en una pose fija (sin movimiento) y deja el cuadro limpio. */
async function pose(page, body) {
  await setHud(page, "clean");
  await evalT(page, () => {
    window.__trailer._side = undefined;
    window.__trailer._orbAxis = undefined;
  });
  await page.evaluate(
    (at) =>
      window.__trailer.direct({ duration: 600000, smoothing: 0, at: new Function("u", "T", at) }),
    body
  );
  await sleep(500);
}

const users = JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
const browser = await chromium.launch({
  channel: "chrome",
  headless: false,
  args: [
    `--window-size=${WIDTH},${HEIGHT}`,
    "--force_high_performance_gpu",
    "--ignore-gpu-blocklist",
    "--disable-renderer-backgrounding",
    "--disable-background-timer-throttling",
    "--disable-backgrounding-occluded-windows"
  ]
});

async function newPlayer() {
  const context = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 2,
    ignoreHTTPSErrors: true
  });
  await context.addInitScript(pageInit);
  return context.newPage();
}

const [a, b] = [await newPlayer(), await newPlayer()];

async function login(page, user) {
  await page.goto(`${BASE_URL}/login`);
  await page.fill('input[type="email"]', user.email);
  await page.fill('input[type="password"]', user.password);
  await page.keyboard.press("Enter");
  await page.waitForURL("**/lobby**", { timeout: 20000 });
}

try {
  await login(a, users[0]);
  await login(b, users[1]);

  // 1. La sala con los dos jugadores dentro: la prueba de que es multijugador.
  for (const page of [a, b]) await page.goto(`${BASE_URL}/lobby`);
  await sleep(2500);
  await setHud(a, "light");
  await a.getByText("CREAR SALA").first().click();
  const code = (await a.locator("p.text-3xl").first().innerText()).trim();
  await a.locator("button", { hasText: "→" }).last().click();
  await b.getByText("UNIRSE A SALA").first().click();
  await b.fill("#room-code", code);
  await b.locator("button", { hasText: "→" }).last().click();
  await waitFor(a, (name) => document.body.innerText.includes(name), users[1].username);
  await a.getByRole("button", { name: /^listo$/i }).click();
  await sleep(1200);
  await shot(a, "01-sala");

  // 2. A la partida.
  await b.getByRole("button", { name: /^listo$/i }).click();
  await Promise.all([a.waitForURL("**/game**"), b.waitForURL("**/game**")]);
  for (const page of [a, b]) {
    await waitFor(
      page,
      () => window.__trailer.state && window.__trailer.selfUserId && window.__trailer.three()
    );
  }
  await sleep(3000);
  const roleOf = (page) => evalT(page, () => window.__trailer.role());
  const [hunter, cyborg] = (await roleOf(a)) === "seeker" ? [a, b] : [b, a];
  const cyborgId = await evalT(cyborg, () => window.__trailer.selfEntityId);
  await evalT(hunter, (id) => (window.__trailer.follow = id), cyborgId);
  await evalT(cyborg, () => window.__trailer.autopilot("cells"));

  // 3. Planos de la ciudad, con la cámara del director (sin interfaz).
  await pose(hunter, `return { pos: [0.02, 0.2, 1.5], look: [0, 0.17, -2.2], fov: 42 };`);
  await shot(hunter, "02-ciudad");

  await pose(hunter, `return { pos: [0.4, 2.2, 0.4], look: [0, 0, 0], fov: 46 };`);
  await shot(hunter, "03-multitud");

  await pose(
    hunter,
    `const s = T.state && T.state.seeker; if (!s) return null;
     const toCity = Math.atan2(-s.x, -s.z); const a = toCity + Math.PI + 0.5;
     // De lejos y mirando entre la nave y la manzana: en vertical entra la nave arriba y la
     // ciudad debajo, sin que la nave se salga por el canto.
     return { pos: [s.x + Math.sin(a) * 1.15, s.y + 0.12, s.z + Math.cos(a) * 1.15],
              look: [s.x * 0.45, s.y * 0.5, s.z * 0.45], fov: 56 };`
  );
  await shot(hunter, "04-cazador");

  await pose(
    hunter,
    `const e = T.entity(T.follow) || (T.state && T.state.entities[0]); if (!e) return null;
     const h = e.rotationY; const fx = Math.sin(h), fz = Math.cos(h), rx = Math.cos(h), rz = -Math.sin(h);
     if (T._side === undefined) T._side = e.x * rx + e.z * rz > 0 ? 1 : -1;
     const s = T._side;
     return { pos: [e.x + rx * s * 0.75 + fx * 0.3, 0.3, e.z + rz * s * 0.75 + fz * 0.3],
              look: [e.x + fx * 0.1, 0.16, e.z + fz * 0.1], fov: 40 };`
  );
  await shot(hunter, "05-cyborg");

  // 4. El orbe: el cyborg va a por uno y se fotografía cuando ya está encima.
  if (shouldRun("06-orbe")) {
    const orb = await evalT(cyborg, () => {
      const T = window.__trailer;
      const me = T.entity(T.selfEntityId);
      const cells = T.state.collectibles
        .map((c) => ({ x: c.x, z: c.z, d: Math.hypot(c.x - me.x, c.z - me.z) }))
        .sort((p, q) => p.d - q.d);
      return cells[0] ?? null;
    });
    if (orb) {
      await evalT(cyborg, (point) => window.__trailer.autopilot(point), orb);
      await evalT(hunter, (o) => (window.__trailer.orb = o), orb);
      await pose(
        hunter,
        `const o = T.orb; if (!o) return null; const e = T.entity(T.follow);
         if (!T._orbAxis) { const dx = e ? e.x - o.x : 1, dz = e ? e.z - o.z : 0, d = Math.hypot(dx, dz) || 1; T._orbAxis = [dx / d, dz / d]; }
         const ax = T._orbAxis[0], az = T._orbAxis[1];
         // Más atrás y más alta: pegada al orbe se metía dentro del cyborg al llegar.
         return { pos: [o.x - az * 0.95 - ax * 0.25, 0.32, o.z + ax * 0.95 - az * 0.25],
                  look: [o.x + ax * 0.15, 0.12, o.z + az * 0.15], fov: 38 };`
      );
      await waitFor(
        cyborg,
        ({ x, z }) => {
          const T = window.__trailer;
          const me = T.entity(T.selfEntityId);
          return Boolean(me) && Math.hypot(me.x - x, me.z - z) < 1.0;
        },
        orb,
        25000
      ).catch(() => {});
      await shot(hunter, "06-orbe");
    }
    await evalT(cyborg, () => window.__trailer.autopilot("cells"));
  }

  // 5. La mira del cazador, con su HUD: aquí la interfaz ES la foto.
  if (shouldRun("07-mira")) {
    await evalT(hunter, () => window.__trailer.cut());
    await setHud(hunter, "light");
    await hunter.bringToFront();
    await evalT(hunter, () => window.__trailer.tap("KeyF"));
    await sleep(1600);
    await evalT(
      hunter,
      (id) => {
        const T = window.__trailer;
        const target = T.entity(id) ?? T.state.entities[0];
        T.aimTrack((t) => {
          const e = t.entity(target.entityId ?? id);
          return e && { x: e.x, y: e.y + 0.16, z: e.z };
        }, 0.07);
      },
      cyborgId
    );
    await sleep(3000);
    await shot(hunter, "07-mira");
    await evalT(hunter, () => window.__trailer.aimStop());
  }

  // 6. El cyborg desde su propia cámara, con el HUD de la partida.
  await setHud(cyborg, "light");
  await sleep(1500);
  await shot(cyborg, "08-partida");
} finally {
  await browser.close();
}
