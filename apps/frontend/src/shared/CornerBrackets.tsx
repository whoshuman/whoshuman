import type { CSSProperties } from "react";

type Corner = "tl" | "tr" | "bl" | "br";

type CornerBracketsProps = {
  // Color del corchete (cualquier valor CSS: hex, rgb o var(--token)).
  color: string;
  // Esquinas a dibujar; por defecto las cuatro.
  corners?: Corner[];
};

// Clases de posicion + bordes por esquina (patron sharp del design system, sin border-radius).
const CORNER_CLASS: Record<Corner, string> = {
  tl: "left-0 top-0 border-l-2 border-t-2",
  tr: "right-0 top-0 border-r-2 border-t-2",
  bl: "bottom-0 left-0 border-b-2 border-l-2",
  br: "bottom-0 right-0 border-b-2 border-r-2"
};

// Corchetes neon en las esquinas de un panel. Reemplaza los <span> repetidos por todo el codigo.
// El contenedor padre debe ser position:relative.
function CornerBrackets({ color, corners = ["tl", "tr", "bl", "br"] }: CornerBracketsProps) {
  const style: CSSProperties = { borderColor: color };

  return (
    <>
      {corners.map((corner) => (
        <span key={corner} className={`absolute h-3 w-3 ${CORNER_CLASS[corner]}`} style={style} />
      ))}
    </>
  );
}

export default CornerBrackets;
