# Guía rápida para desarrollo — qué hay y dónde tocar

Todo el demo está en **`index.html`** (un solo archivo, comentado). Aquí tienes
el mapa de sus secciones y los cambios más típicos, por si tenéis que ajustarlo.

## Estructura de `index.html` (de arriba a abajo)

| Sección | Qué hace | Dónde |
|---|---|---|
| **CONFIG** | Constantes que se tocan a mano | bloque `===== CONFIG =====` al inicio del `<script>` |
| **Escena / cámara / renderer** | Lienzo 3D, tone mapping, fondo | justo después de CONFIG |
| **Luces** | Luz de día (cielo + sol + relleno) | `HemisphereLight`, `AmbientLight`, `sun`, `fill` |
| **Carga GLTF** | `GLTFLoader` + `DRACOLoader` | `loader` |
| **Suelo / colisión** | Qué cuenta como pisable + raycast | `FLOOR_PAT`, `collidables`, `groundHeight()` |
| **Personaje** | Malla + animaciones | `makeCharacter()`, `setAnim()`, `physics()` |
| **NPCs (IA)** | Rutas de waypoints y paseo | `randomGroundPoint()`, `makePath()`, `npcUpdate()` |
| **Control jugador** | WASD, saltar, correr | `playerUpdate()` |
| **Poseer / cambiar** | Tomar el control de un NPC | `possess()`, `possessNearest()` (tecla **F**) |
| **Cámara 3ª/1ª persona** | Seguimiento orbital | `updateCamera()` (tecla **V**) |
| **Input** | Teclado / ratón / rueda | bloque `---- Input ----` |
| **Bucle** | Update por frame + render | `animate()` |
| **Arranque** | Carga ciudad + personajes y coloca todo | `loadCity()`, `loadModel()`, bloque final |

## Cambios típicos

- **Cambiar de personaje jugable:** edita `MODELS[0]` en CONFIG (o el array entero).
  Los 12 están en `personajes/`.
- **Nº de NPCs:** `NPC_COUNT`.
- **Velocidades / salto / gravedad:** `WALK_SPEED`, `RUN_SPEED`, `JUMP_V`, `GRAVITY`, `NPC_SPEED`.
- **Tamaño de los personajes:** `CHAR_SCALE` (o en vivo con las teclas `[` `]`).
- **Iluminación / mood:** los valores de `HemisphereLight` / `sun` / `fill` y
  `scene.background`. Ahora es luz de día; aquí se cambiaría a noche/cyberpunk.
- **Cambiar el mapa:** la constante `CITY` (apunta a `beta-city.glb`).

## Cómo funciona la colisión (importante)

- Solo es **pisable** lo que su nombre empieza por `road|tile|driveway|path`
  (ver `FLOOR_PAT`). Edificios, árboles y props **no** → no te subes a ellos.
- La altura del suelo se calcula con un **raycast hacia abajo** (`groundHeight`).
- **Aún NO hay colisión con paredes** (se atraviesan los edificios). Sería el
  siguiente paso si lo necesitáis.

## Animaciones disponibles (personajes Kenney)

Cada personaje trae **31 clips**. En el demo se usan `idle`, `walk`, `sprint`,
`jump`, `fall`. Otros listos para usar: `crouch`, `sit`, `die`, `pick-up`,
`emote-yes/no`, `holding-*`, `attack-melee/kick-*`, `interact-*`, `wheelchair-*`.
Se reproducen con `THREE.AnimationMixer` (ver `setAnim()`).

## Integración en React Three Fiber

- El mapa es un GLB normal: `useGLTF('beta-city.glb')`.
- La lógica de movimiento, IA de NPCs y animación es **agnóstica de framework**:
  `AnimationMixer`, raycast de suelo e IA se trasladan tal cual a R3F.

## Pendiente (no bloquea las pruebas)

- Colisión con paredes de edificios.
- Multijugador en red.
- Bake de iluminación de mayor calidad (ahora luz en tiempo real).
- Hay un **tile suelto** flotando fuera del mapa (sobrante del `.blend`), inofensivo.
