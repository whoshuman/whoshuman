import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, Color, ShaderMaterial } from "three";

type HomeSunProps = {
  color: string;
};

// El disco solar se dibuja en un shader en vez de en un canvas: las franjas horizontales
// (las "scanlines" que deshacen la mitad inferior) tienen que desplazarse en bucle, y con
// una textura habria que repintar el canvas y resubirlo a la GPU en cada fotograma.
const sunVertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const sunFragmentShader = /* glsl */ `
  varying vec2 vUv;
  uniform float uTime;

  // Degradado vertical clasico: blanco calido arriba, magenta abajo.
  vec3 sunGradient(float t) {
    vec3 c = mix(vec3(1.0, 0.965, 0.761), vec3(1.0, 0.882, 0.302), smoothstep(0.0, 0.32, t));
    c = mix(c, vec3(1.0, 0.624, 0.110), smoothstep(0.32, 0.55, t));
    c = mix(c, vec3(1.0, 0.365, 0.694), smoothstep(0.55, 0.78, t));
    return mix(c, vec3(1.0, 0.169, 0.839), smoothstep(0.78, 1.0, t));
  }

  void main() {
    // Recorta el cuadrado a un disco: la geometria es un plano, el circulo lo pone el alfa.
    vec2 centered = vUv * 2.0 - 1.0;
    float radius = length(centered);
    if (radius > 1.0) discard;

    // 0 en la coronilla, 1 en la base del disco.
    float depth = 1.0 - vUv.y;

    // Fase de las franjas. El exponente < 1 hace que la derivada baje segun se desciende,
    // asi que las bandas se separan hacia abajo (el sol se "deshace" por la base). Al ser
    // monotona, restarle el tiempo desplaza el tapiz sin costuras ni saltos.
    float phase = pow(max(depth, 0.0), 0.55) * 9.0 - uTime * 0.35;
    float band = fract(phase);

    // De la mitad del disco hacia arriba no se toca nada: el sol es solido y estatico ahi.
    // La animacion vive solo en la mitad inferior, donde el corte crece hasta la base.
    float cut = smoothstep(0.5, 1.0, depth) * 0.92;
    // Con cut = 0 el alfa es 1 exacto. Sin este corte, el smoothstep dejaba pasar una
    // banda tenue en movimiento tambien por la mitad de arriba.
    float stripe = cut > 0.0 ? smoothstep(cut, cut + 0.10, band) : 1.0;

    float alpha = stripe;
    // Difumina el canto del disco para que no recorte en escalera contra el cielo.
    alpha *= smoothstep(1.0, 0.985, radius);
    if (alpha < 0.01) discard;

    gl_FragColor = vec4(sunGradient(depth), alpha);
  }
`;

function HomeSun({ color }: HomeSunProps) {
  const materialRef = useRef<ShaderMaterial>(null);
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);

  useFrame((_, delta) => {
    if (materialRef.current) materialRef.current.uniforms.uTime.value += delta;
  });

  return (
    // Las montañas son un plano tumbado de 240 de fondo centrado en z -850 (de -970 a -730)
    // y con las cimas en su borde TRASERO. Por eso no basta con pasar de -850: a -880 el sol
    // aun tenia delante la parte baja del terreno y se dibujaba por encima de las crestas.
    // A -1000 queda detras de todo el relieve y las cimas le tapan la base de verdad.
    <group position={[0, 34, -1000]}>
      {/* Halo exterior difuso. Mas grande para que la corona se eleve sobre ciudad y montañas. */}
      <mesh position={[0, 0, -1.2]}>
        <circleGeometry args={[215, 64]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.1}
          depthWrite={false}
          fog={false}
          blending={AdditiveBlending}
        />
      </mesh>
      <mesh position={[0, 0, -0.8]}>
        <circleGeometry args={[165, 64]} />
        <meshBasicMaterial
          color={new Color("#ffb35c")}
          transparent
          opacity={0.18}
          depthWrite={false}
          fog={false}
          blending={AdditiveBlending}
        />
      </mesh>

      {/* Disco solar: degradado y franjas en movimiento. Un plano, no un circulo: el shader
          descarta lo que queda fuera del radio y asi las UV son un cuadrado limpio. */}
      <mesh>
        <planeGeometry args={[276, 276]} />
        <shaderMaterial
          ref={materialRef}
          uniforms={uniforms}
          vertexShader={sunVertexShader}
          fragmentShader={sunFragmentShader}
          transparent
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

export default HomeSun;
