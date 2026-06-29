// Configuración de Jest para game-service. Usa ts-jest para compilar TS on-the-fly.
/** @type {import('jest').Config} */
export default {
  preset: "ts-jest",
  testEnvironment: "node",
  rootDir: "src",
  testRegex: ".*\\.spec\\.ts$",
  setupFiles: ["<rootDir>/jest.setup.ts"],
  moduleFileExtensions: ["ts", "js", "json"],
  transform: {
    "^.+\\.ts$": ["ts-jest", { tsconfig: "<rootDir>/../tsconfig.json" }]
  }
};
