# Tráiler

Tráiler del juego montado con [Remotion](https://www.remotion.dev/), con la música del menú
("Cold Fire", de Neozoic) y planos grabados del juego de verdad. Salen dos versiones del mismo
montaje:

| Composición        | Formato     | Para qué                                              |
| ------------------ | ----------- | ----------------------------------------------------- |
| `TrailerFeed`      | 1080 × 1350 | Publicar en LinkedIn: textos arriba y abajo, créditos |
| `TrailerCinematic` | 1920 × 1080 | En crudo: solo imagen, música y logo, sin textos      |

## Rehacerlo

1. Levantar el stack: `make dev-d` (tiene que responder en https://localhost).
2. Grabar los planos: `pnpm --filter @whoshuman/trailer capture`. Abre dos Chrome con dos
   jugadores en la misma sala y juega tres rondas solo: crear la sala y entrar los dos, el
   cyborg entre la multitud, el robo de un orbe, el disparo que acierta y los planos de cine
   con una cámara propia sobre la escena real. Tarda unos 8 minutos. `capture <prefijo>`
   repite solo las tomas que empiezan así (p. ej. `hunter-hit`).
   La página que se graba renderiza al doble de resolución y se captura a 1080p30: el
   supermuestreo limpia los bordes y la cadencia fija quita los tirones.
3. Renderizar: `pnpm --filter @whoshuman/trailer render` → `out/`.
4. Capturas fijas para acompañar al vídeo: `pnpm --filter @whoshuman/trailer screenshots`
   → `out/capturas/` en 4:5 (1080×1350). Se toman dentro de una partida, no del vídeo, con
   la ventana en vertical y el motor renderizando al triple. `screenshots 04,06` repite solo
   esas dos.

`pnpm --filter @whoshuman/trailer studio` abre el editor de Remotion para ver el montaje.

Los clips (`public/clips`), las capturas en bruto y los MP4 finales no se suben: pesan cientos
de MB y se regeneran con los pasos de arriba. Las dos cuentas de prueba se crean solas en la
base local y se guardan en `.capture-users.json` (ignorado).

## Dónde se toca

- `src/timeline.ts`: qué plano va en cada momento, los textos, los créditos y la rejilla de
  la música (135,3 BPM). Todos los cortes caen en línea de compás.
- `scripts/capture.mjs`: las tomas y los movimientos de cámara (`SHOTS`).
- La URL de la demo se pasa como prop: mientras sea `null`, el cierre dice "Enlace en el post".

  ```bash
  pnpm exec remotion render src/index.ts TrailerFeed out/whoshuman-trailer-4x5.mp4 \
    --props='{"layout":"feed","demoUrl":"whoshuman.example"}'
  ```

Remotion es gratis para particulares y equipos de hasta 3 personas; para una empresa más
grande pide licencia (ver remotion.dev/license).
