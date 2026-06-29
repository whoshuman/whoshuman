# Who's Human — Demo de mapa + personajes (entrega para desarrollo)

Demo **autocontenida y jugable** de la ciudad 3D con personajes animados,
NPCs que pasean por rutas y control en 1ª/3ª persona. Sirve como **referencia**
para integrar el mapa y el movimiento de personajes en el stack del proyecto
(React + Three.js / React Three Fiber).

---

## 1. Cómo verlo funcionando (1 minuto)

Necesita un **servidor local** (los `.glb` no cargan desde `file://`).

```bash
# desde esta carpeta (entrega-mapa/)
python -m http.server 8000
# luego abre: http://localhost:8000/index.html
```

Alternativas: extensión **Live Server** de VS Code, o `npx serve`.

Three.js y el decoder DRACO se cargan desde CDN → hace falta internet.

### Controles
| Tecla | Acción |
|-------|--------|
| **W A S D** | Mover (haz click primero para capturar el ratón) |
| **Ratón** | Cámara orbital |
| **Shift** | Correr |
| **Espacio** | Saltar |
| **F** | Poseer el NPC más cercano (el que dejas pasa a ser NPC) |
| **V** | Alternar 1ª / 3ª persona |
| **Rueda** | Zoom |
| **`[` `]`** | Tamaño del personaje en vivo |
| **Esc** | Liberar el ratón |

---

## 2. Qué hay en la carpeta

```
index.html                 Demo jugable (todo el código está aquí, comentado)
beta-city.glb              Ciudad (materiales originales, ~43 MB)
personajes/
  character-male-a..f.glb   6 personajes masculinos
  character-female-a..f.glb 6 personajes femeninos
  Textures/colormap.png     textura compartida por los 12
fuente/
  beta-city.blend           mapa fuente en Blender (NO hace falta para el demo)
```

> `fuente/beta-city.blend` es el archivo de Blender del mapa. No se necesita para
> ejecutar el demo; se incluye por si el equipo de assets lo quiere.

### El mapa — `beta-city.glb`
- Ciudad de estilo low-poly (base: Kenney City Kit + edificios propios).
- **Iluminación de día en tiempo real** (cielo + sol), look limpio y uniforme
  como el render de referencia (`beta-mapa.png`). Sin zonas oscuras ni costuras.
- Más adelante se hará un **bake** de mayor calidad para el look final; por ahora
  la luz va en tiempo real para que se vea consistente en cualquier máquina.
- Escala: la ciudad es pequeña en unidades de mundo (~18 de ancho). Los
  personajes se escalan a ~0.4 para encajar.

### Los personajes — `personajes/*.glb`
- Pack **Kenney Mini Characters**: 12 modelos, **rigeados y animados**.
- **31 clips de animación** cada uno. Los usados en la demo:
  `idle`, `walk`, `sprint`, `jump`, `fall`. Otros disponibles:
  `crouch`, `sit`, `die`, `pick-up`, `emote-yes/no`, `holding-*`,
  `attack-melee/kick-*`, `interact-*`, `wheelchair-*`.
- Todos comparten esqueleto y textura → cambiar de personaje = cambiar de malla.

---

## 3. Cómo funciona el movimiento (para integrarlo)

Todo está en `index.html`, comentado. Piezas clave:

- **Carga**: `GLTFLoader` + `DRACOLoader` (la ciudad usa compresión Draco).
- **Personaje** = objeto con `THREE.AnimationMixer`; se reproducen los clips por
  nombre y se cruzan con `fadeIn/fadeOut`. Los NPCs se crean clonando el modelo
  con `SkeletonUtils.clone()` (cargar una vez, instanciar muchos).
- **Suelo / gravedad**: `Raycaster` hacia abajo contra las mallas de suelo
  (las que su nombre empieza por `road|tile|driveway|path`). El personaje se
  apoya en la calle y NO puede subirse a edificios (solo el suelo es "pisable").
- **NPCs**: cada uno tiene una ruta de *waypoints* aleatorios sobre el suelo;
  caminan de uno a otro con pausas. (No esquivan entre ellos todavía.)
- **Poseer**: el jugador puede tomar el control de cualquier NPC (tecla F).
- **Cámara**: 3ª persona orbital (pointer-lock); `V` cambia a 1ª persona.

### Notas para el port a React Three Fiber
- El mapa es un GLB normal: `useGLTF('beta-city-baked.glb')`.
- Como la luz va horneada (materiales *emissive*), pon `toneMapping` neutro y
  `emissiveIntensity = 1.0` para verlo fiel (ver el bloque de carga en `index.html`).
- El sistema de movimiento/animación es agnóstico de framework: la lógica de
  `AnimationMixer`, raycast de suelo e IA de NPCs se traslada tal cual.

---

## 4. Estado y siguientes pasos

- ✅ Mapa horneado funcional + personajes animados + NPCs + control.
- ✅ Suelo con lightmap continuo (sin costuras entre celdas).
- ⏳ **Pendiente (lo hace el equipo de assets):** un re-bake del mapa a más
  calidad para que se vea aún mejor; el GLB se actualizará in situ.
- ⏳ Pendiente de juego: colisión con paredes de edificios y multijugador en red.

> Limitaciones actuales: solo hay colisión con el suelo (se atraviesan paredes);
> la demo es local en un navegador (todavía no es multijugador en red).
