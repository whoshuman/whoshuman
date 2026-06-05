type HomeGridProps = {
  colorMain: string;
  colorSecondary: string;
};

// Rejilla del suelo. El tamano grande ayuda a dar sensacion de carretera infinita.
function HomeGrid({ colorMain, colorSecondary }: HomeGridProps) {
  return <gridHelper position={[0, -50, 0]} args={[2000, 200, colorMain, colorSecondary]} />;
}

export default HomeGrid;
