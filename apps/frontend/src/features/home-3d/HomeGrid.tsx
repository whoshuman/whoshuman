type HomeGridProps = {
  colorMain: string;
  colorSecondary: string;
  colorFloor: string;
};

// Rejilla del suelo. El tamano grande ayuda a dar sensacion de carretera infinita.
function HomeGrid({ colorMain, colorSecondary, colorFloor }: HomeGridProps) {
  return (
    <group>
      {/* Suelo opaco justo debajo de la rejilla: impide ver a traves de los huecos de las
          lineas (las montanas que pasan por debajo dejan de verse). polygonOffset lo empuja
          un pelin hacia atras para que las lineas neon queden siempre por encima sin z-fight. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -50.2, 0]}>
        <planeGeometry args={[2000, 2000]} />
        <meshBasicMaterial
          color={colorFloor}
          polygonOffset
          polygonOffsetFactor={1}
          polygonOffsetUnits={1}
        />
      </mesh>
      <gridHelper position={[0, -50, 0]} args={[2000, 200, colorMain, colorSecondary]} />
    </group>
  );
}

export default HomeGrid;
