// Todo lo que se inyecta en cada página del navegador para grabar el tráiler y las capturas.
// Va como una función porque Playwright la serializa: no puede usar nada de fuera de su cuerpo.
//
// - Un gancho de React DevTools para llegar al store de react-three-fiber (cámara, escena).
//   Con él, el "director" lleva una cámara propia por la escena REAL de la partida.
// - Un espía de WebSocket que guarda el último snapshot del servidor: posiciones, orbes, rol.
// - Teclado y puntero sintéticos: el juego escucha en window/document y no mira isTrusted.
/* global window, document, requestAnimationFrame, cancelAnimationFrame, performance, navigator, MediaRecorder, PointerEvent, KeyboardEvent, MutationObserver, btoa, setTimeout, setInterval, clearInterval */
export function pageInit() {
  const roots = new Set();
  let rendererId = 0;
  window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    supportsFiber: true,
    isDisabled: false,
    renderers: new Map(),
    inject(renderer) {
      rendererId += 1;
      this.renderers.set(rendererId, renderer);
      return rendererId;
    },
    // En react-three-fiber el "contenedor" de la raíz es su store de zustand.
    onCommitFiberRoot(_id, root) {
      const container = root && root.containerInfo;
      if (container && typeof container.getState === "function") roots.add(container);
    },
    onCommitFiberUnmount() {},
    onPostCommitFiberRoot() {},
    onScheduleFiberRoot() {},
    setStrictMode() {},
    checkDCE() {}
  };

  const T = {
    state: null,
    selfEntityId: null,
    selfUserId: null,
    hud: "full",
    shots: [],
    // La escena es el canvas conectado más grande: hay otros de R3F por la app (la cabeza
    // 3D del avatar, por ejemplo) y el último en montarse no tiene por qué ser el bueno.
    three() {
      let best = null;
      let bestArea = 0;
      for (const store of roots) {
        const st = store.getState();
        const canvas = st.gl && st.gl.domElement;
        if (!canvas || !canvas.isConnected) continue;
        const area = canvas.clientWidth * canvas.clientHeight;
        if (area > bestArea) {
          best = { store, st };
          bestArea = area;
        }
      }
      return best;
    },
    role() {
      const score = T.state && T.state.scores.find((s) => s.userId === T.selfUserId);
      return score ? score.role : null;
    },
    entity(id) {
      return T.state ? T.state.entities.find((e) => e.entityId === id) : null;
    }
  };
  window.__trailer = T;

  // Espía de WebSocket: socket.io coge el constructor global al cargar su módulo, y este
  // script corre antes que cualquier script de la página.
  const NativeWebSocket = window.WebSocket;
  class SpyWebSocket extends NativeWebSocket {
    // Lo que sale hacia el servidor en los disparos, para saber si la bala llegó a salir.
    send(data) {
      if (typeof data === "string" && data.includes('"game:shoot"')) T.shots.push(data);
      return super.send(data);
    }
    constructor(...args) {
      super(...args);
      this.addEventListener("message", (event) => {
        if (typeof event.data !== "string") return;
        const at = event.data.indexOf('["game:state",');
        if (at >= 0) {
          try {
            T.state = JSON.parse(event.data.slice(at))[1];
          } catch {
            // Un snapshot roto no para la grabación.
          }
          return;
        }
        if (event.data.includes('"selfEntityId"')) {
          const entity = /"selfEntityId":"([^"]+)"/.exec(event.data);
          const user = /"selfUserId":"([^"]+)"/.exec(event.data);
          if (entity) T.selfEntityId = entity[1];
          if (user) T.selfUserId = user[1];
        }
      });
    }
  }
  window.WebSocket = SpyWebSocket;

  // Modos de HUD: "full" (tal cual), "light" (sin los botones de debug, abandonar, chat ni
  // la chuleta de teclas) y "clean" (solo la escena 3D).
  const css = `
    * { cursor: none !important; }
    .tr-hide { visibility: hidden !important; }
    html.tr-clean body * { visibility: hidden !important; }
    html.tr-clean canvas,
    html.tr-clean .fixed.inset-0.z-0,
    html.tr-clean .fixed.inset-0.z-0 * { visibility: visible !important; }
  `;
  const applyHud = () => {
    document.documentElement.classList.toggle("tr-clean", T.hud === "clean");
    if (T.hud === "full") return;
    for (const button of document.querySelectorAll("button")) {
      const text = (button.textContent || "").trim().toLowerCase();
      const iconOnly = text === "" && button.querySelector("svg");
      if (text.includes("[debug]") || text.includes("abandonar") || iconOnly) {
        button.classList.add("tr-hide");
      }
    }
    for (const kbd of document.querySelectorAll("kbd")) {
      const bar = kbd.closest("div.flex, div");
      if (bar && bar.parentElement) bar.parentElement.classList.add("tr-hide");
    }
  };
  T.setHud = (mode) => {
    T.hud = mode;
    for (const el of document.querySelectorAll(".tr-hide")) el.classList.remove("tr-hide");
    applyHud();
  };
  document.addEventListener("DOMContentLoaded", () => {
    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);
    new MutationObserver(() => {
      if (T.hud !== "full") applyHud();
    }).observe(document.body, { childList: true, subtree: true });
  });

  // ── Grabación ──
  // 30 fps fijos, lo mismo que el tráiler: a 60 el codificador iba justo y soltaba fotogramas
  // a trompicones, y eso se veía como tirones en los movimientos de cámara.
  T.record = async (name) => {
    if (!T.stream || !T.stream.active) {
      T.stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30, width: { ideal: 1920 }, height: { ideal: 1080 }, cursor: "never" },
        audio: false,
        preferCurrentTab: true
      });
    }
    const recorder = new MediaRecorder(T.stream, {
      mimeType: "video/webm;codecs=vp9",
      videoBitsPerSecond: 60_000_000
    });
    T.pending = [];
    recorder.ondataavailable = (event) => {
      T.pending.push(
        event.data.arrayBuffer().then((buffer) => {
          const bytes = new Uint8Array(buffer);
          let binary = "";
          for (let i = 0; i < bytes.length; i += 0x8000) {
            binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
          }
          return window.__trailerChunk(name, btoa(binary));
        })
      );
    };
    T.recorder = recorder;
    recorder.start(1000);
  };
  T.setDpr = (dpr) => {
    const three = T.three();
    if (three) three.st.setDpr(dpr);
  };
  T.stopRecording = () =>
    new Promise((resolve) => {
      T.recorder.onstop = () => setTimeout(() => Promise.all(T.pending).then(resolve), 300);
      T.recorder.stop();
    });

  // ── Teclado ──
  const held = new Set();
  T.key = (code, down) => {
    if (down === held.has(code)) return;
    if (down) held.add(code);
    else held.delete(code);
    window.dispatchEvent(new KeyboardEvent(down ? "keydown" : "keyup", { code, bubbles: true }));
  };
  T.tap = (code) => {
    window.dispatchEvent(new KeyboardEvent("keydown", { code, bubbles: true }));
    window.dispatchEvent(new KeyboardEvent("keyup", { code, bubbles: true }));
  };
  T.releaseAll = () => {
    for (const code of [...held]) T.key(code, false);
  };

  // ── Piloto del cyborg: va a la celda más cercana (o a un punto {x, z}) esquivando atascos ──
  const wrap = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));
  T.autopilot = (mode) => {
    clearInterval(T.pilotTimer);
    T.releaseAll();
    if (mode === "off") return;
    let lastPos = null;
    let lastMoveAt = performance.now();
    let escapeUntil = 0;
    T.arrived = false;
    T.pilotTimer = setInterval(() => {
      const me = T.entity(T.selfEntityId);
      if (!me || !T.state || T.role() !== "hider") return T.releaseAll();
      const now = performance.now();
      if (lastPos && Math.hypot(me.x - lastPos.x, me.z - lastPos.z) > 0.03) {
        lastPos = { x: me.x, z: me.z };
        lastMoveAt = now;
      }
      if (!lastPos) lastPos = { x: me.x, z: me.z };
      if (now - lastMoveAt > 1200 && now > escapeUntil) {
        escapeUntil = now + 700;
        lastMoveAt = now;
      }
      if (now < escapeUntil) {
        T.key("KeyW", true);
        T.key("KeyA", true);
        T.key("KeyD", false);
        return;
      }
      let target = null;
      if (typeof mode === "object") {
        if (Math.hypot(mode.x - me.x, mode.z - me.z) < 0.08) {
          T.arrived = true;
          return T.releaseAll();
        }
        target = mode;
      } else if (mode === "cells") {
        let best = Infinity;
        for (const cell of T.state.collectibles) {
          const d = Math.hypot(cell.x - me.x, cell.z - me.z);
          if (d < best) {
            best = d;
            target = cell;
          }
        }
      }
      if (!target) return T.releaseAll();
      // Rumbo del servidor: avanzar es (sin h, cos h) y la A suma giro.
      const diff = wrap(Math.atan2(target.x - me.x, target.z - me.z) - me.rotationY);
      T.key("KeyW", Math.abs(diff) < 1.7);
      T.key("KeyA", diff > 0.12);
      T.key("KeyD", diff < -0.12);
    }, 90);
  };

  // ── Director: cámara propia sobre la escena de verdad ──
  // Se suscribe al bucle de R3F con prioridad 0.5: corre DESPUÉS de las cámaras del juego
  // (prioridad 0) y antes de un EffectComposer (prioridad 1). Coloca la cámara activa y, si
  // nadie más pinta con prioridad, pinta él (con prioridad > 0 R3F deja de pintar solo).
  T.direct = (shot) => {
    T.cut();
    const three = T.three();
    if (!three) return false;
    const { store, st } = three;
    const camera = st.camera;
    const saved = {
      position: camera.position.clone(),
      quaternion: camera.quaternion.clone(),
      fov: camera.fov
    };
    const renderSelf = st.internal.priority === 0;
    const Vec = camera.position.constructor;
    const look = new Vec();
    const started = performance.now();
    const smooth = { pos: null, look: null };
    const ref = {
      current: (state) => {
        const u = Math.min(1, (performance.now() - started) / shot.duration);
        const frame = shot.at(u, T);
        if (frame) {
          if (shot.smoothing && smooth.pos) {
            smooth.pos.lerp(new Vec(...frame.pos), shot.smoothing);
            smooth.look.lerp(new Vec(...frame.look), shot.smoothing);
          } else {
            smooth.pos = new Vec(...frame.pos);
            smooth.look = new Vec(...frame.look);
          }
          camera.position.copy(smooth.pos);
          look.copy(smooth.look);
          camera.lookAt(look);
          if (frame.fov && camera.fov !== frame.fov) {
            camera.fov = frame.fov;
            camera.updateProjectionMatrix();
          }
        }
        if (renderSelf) state.gl.render(state.scene, camera);
      }
    };
    const unsubscribe = st.internal.subscribe(ref, 0.5, store);
    T.cut = () => {
      unsubscribe();
      camera.position.copy(saved.position);
      camera.quaternion.copy(saved.quaternion);
      camera.fov = saved.fov;
      camera.updateProjectionMatrix();
      T.cut = () => {};
    };
    return true;
  };
  T.cut = () => {};

  // ── Mira del cazador ──
  // La vista con mira gira con movementX/Y de pointermove (0.002 rad por píxel) y dispara
  // al centro. Se corrige el error angular hacia el blanco un poco en cada fotograma.
  T.aimTrack = (getPoint, gain) => {
    cancelAnimationFrame(T.aimRaf);
    // movementX/Y son enteros: lo que no llega a un píxel se guarda para el siguiente
    // fotograma. Sin esto, cerca del blanco la corrección se truncaba a 0 y la mira se
    // quedaba a un par de grados, lo justo para que la bala no tocara a nadie.
    const carry = { x: 0, y: 0 };
    const tick = () => {
      const three = T.three();
      const point = getPoint(T);
      if (three && point) {
        const camera = three.st.camera;
        const local = camera.position.clone().set(point.x, point.y, point.z).sub(camera.position);
        local.applyQuaternion(camera.quaternion.clone().invert());
        const yawError = Math.atan2(local.x, -local.z);
        const pitchError = Math.atan2(local.y, Math.hypot(local.x, local.z));
        const clamp = (v) => Math.max(-120, Math.min(120, v));
        carry.x += clamp((yawError / 0.002) * gain);
        carry.y += clamp((-pitchError / 0.002) * gain);
        const stepX = Math.trunc(carry.x);
        const stepY = Math.trunc(carry.y);
        carry.x -= stepX;
        carry.y -= stepY;
        document.dispatchEvent(
          new PointerEvent("pointermove", {
            bubbles: true,
            pointerType: "mouse",
            button: -1,
            movementX: stepX,
            movementY: stepY
          })
        );
        T.aimError = Math.hypot(yawError, pitchError);
      }
      T.aimRaf = requestAnimationFrame(tick);
    };
    T.aimRaf = requestAnimationFrame(tick);
  };
  T.aimStop = () => cancelAnimationFrame(T.aimRaf);
  T.visible = (point) => {
    const three = T.three();
    if (!three) return false;
    const { camera, raycaster, scene } = three.st;
    const origin = camera.position.clone();
    const direction = origin.clone().set(point.x, point.y, point.z).sub(origin);
    const distance = direction.length();
    raycaster.set(origin, direction.normalize());
    raycaster.far = distance - 0.05;
    const blocked = raycaster
      .intersectObjects(scene.children, true)
      .some((hit) => hit.object.userData && hit.object.userData.blocksShot);
    raycaster.far = Infinity;
    return !blocked;
  };
  // Un NPC (no el cyborg) que se vea desde la mira, lo más cerca posible de un punto.
  T.visibleDecoy = (avoidId, near) => {
    const candidates = T.state.entities
      .filter((e) => e.entityId !== avoidId)
      .sort(
        (p, q) => Math.hypot(p.x - near.x, p.z - near.z) - Math.hypot(q.x - near.x, q.z - near.z)
      );
    return candidates.find((e) => T.visible({ x: e.x, y: e.y + 0.16, z: e.z })) || candidates[0];
  };
  T.shoot = () => {
    const three = T.three();
    if (!three) return;
    T.shotLog = (T.shotLog || []).concat({ aimError: T.aimError, sent: T.shots.length });
    const canvas = three.st.gl.domElement;
    const init = { bubbles: true, pointerType: "mouse", button: 0, buttons: 1 };
    canvas.dispatchEvent(new PointerEvent("pointerdown", init));
    canvas.dispatchEvent(new PointerEvent("pointerup", { ...init, buttons: 0 }));
  };
}
