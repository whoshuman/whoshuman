export type CityBuilding = {
  // Coordenadas locales dentro del grupo de ciudad.
  x: number;
  z: number;
  // Dimensiones del prisma principal.
  width: number;
  height: number;
  depth: number;
  // Variante visual del remate superior.
  roof: "flat" | "antenna" | "spire" | "sign";
};

// Mapa procedural de edificios. Mantenerlo como datos facilita ajustar skyline sin tocar JSX.
export const cityBuildings: CityBuilding[] = [
  { x: -154, z: -34, width: 8, height: 20, depth: 9, roof: "antenna" },
  { x: -138, z: -26, width: 8, height: 20, depth: 9, roof: "antenna" },
  { x: -124, z: -28, width: 11, height: 28, depth: 10, roof: "flat" },
  { x: -110, z: -38, width: 10, height: 34, depth: 10, roof: "sign" },
  { x: -98, z: -24, width: 9, height: 24, depth: 9, roof: "spire" },
  { x: -86, z: -16, width: 9, height: 28, depth: 10, roof: "antenna" },
  { x: -72, z: -8, width: 10, height: 24, depth: 10, roof: "flat" },
  { x: -58, z: -3, width: 13, height: 38, depth: 12, roof: "sign" },
  { x: -42, z: -7, width: 10, height: 50, depth: 11, roof: "spire" },
  { x: -27, z: -1, width: 15, height: 32, depth: 13, roof: "antenna" },
  { x: -10, z: -8, width: 12, height: 66, depth: 12, roof: "spire" },
  { x: 6, z: -2, width: 16, height: 74, depth: 14, roof: "antenna" },
  { x: 25, z: -9, width: 12, height: 54, depth: 11, roof: "sign" },
  { x: 42, z: -4, width: 14, height: 42, depth: 12, roof: "antenna" },
  { x: 60, z: -10, width: 10, height: 30, depth: 10, roof: "flat" },
  { x: 75, z: -5, width: 9, height: 22, depth: 9, roof: "spire" },
  { x: 88, z: -14, width: 8, height: 32, depth: 9, roof: "antenna" },
  { x: 102, z: -24, width: 10, height: 26, depth: 10, roof: "sign" },
  { x: 116, z: -24, width: 11, height: 36, depth: 11, roof: "antenna" },
  { x: 130, z: -28, width: 9, height: 24, depth: 9, roof: "flat" },
  { x: 144, z: -30, width: 8, height: 30, depth: 9, roof: "spire" },
  { x: 158, z: -38, width: 9, height: 22, depth: 9, roof: "antenna" },
  { x: -78, z: 15, width: 14, height: 20, depth: 14, roof: "flat" },
  { x: -52, z: 12, width: 18, height: 26, depth: 15, roof: "sign" },
  { x: -24, z: 16, width: 20, height: 34, depth: 16, roof: "antenna" },
  { x: 4, z: 14, width: 22, height: 42, depth: 18, roof: "sign" },
  { x: 33, z: 16, width: 18, height: 30, depth: 15, roof: "flat" },
  { x: 58, z: 12, width: 16, height: 24, depth: 14, roof: "antenna" },
  { x: 82, z: 14, width: 12, height: 22, depth: 13, roof: "sign" },
  { x: -112, z: -62, width: 16, height: 18, depth: 15, roof: "flat" },
  { x: -88, z: -58, width: 14, height: 24, depth: 14, roof: "sign" },
  { x: -68, z: -72, width: 18, height: 16, depth: 18, roof: "flat" },
  { x: -36, z: -76, width: 16, height: 22, depth: 17, roof: "antenna" },
  { x: -4, z: -74, width: 20, height: 28, depth: 19, roof: "sign" },
  { x: 30, z: -76, width: 17, height: 20, depth: 17, roof: "flat" },
  { x: 64, z: -72, width: 16, height: 18, depth: 16, roof: "sign" },
  { x: 104, z: -60, width: 15, height: 20, depth: 15, roof: "flat" },
  { x: 126, z: -66, width: 13, height: 26, depth: 14, roof: "antenna" }
];
