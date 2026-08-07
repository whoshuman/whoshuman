// Configuración de Jest para auth-service.
// Usa ts-jest para compilar TypeScript on-the-fly (con soporte de decoradores de NestJS).
/** @type {import('jest').Config} */
export default {
  preset: "ts-jest",
  testEnvironment: "node",
  rootDir: "src",
  testRegex: ".*\\.spec\\.ts$",
  moduleFileExtensions: ["ts", "js", "json"],
  // ts-jest usa el tsconfig del servicio (decoradores, strict, etc.).
  transform: {
    "^.+\\.ts$": ["ts-jest", { tsconfig: "<rootDir>/../tsconfig.json" }]
  }
};
