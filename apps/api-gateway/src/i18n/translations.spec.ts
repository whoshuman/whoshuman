// Test de PARIDAD de traducciones.
//
// Garantiza que todos los idiomas tengan exactamente las mismas claves, en todos los
// namespaces (errors.json, validation.json...). Así, si alguien añade una clave nueva
// a un idioma y se olvida de los demás, este test FALLA y lo avisa antes de mergear.
//
// Es un test puramente de ficheros: lee los JSON del disco, no arranca NestJS.

import * as fs from "node:fs";
import * as path from "node:path";

// Carpeta donde viven las traducciones (este mismo directorio: src/i18n).
const I18N_DIR = __dirname;

// Idioma de referencia contra el que se comparan los demás (el por defecto).
const REFERENCE_LANG = "es";

/** Lista las subcarpetas de idioma (es, en, fr...). */
function getLanguages(): string[] {
  return fs
    .readdirSync(I18N_DIR)
    .filter((entry) => fs.statSync(path.join(I18N_DIR, entry)).isDirectory());
}

/** Lista los archivos de namespace (errors.json, validation.json...) de un idioma. */
function getNamespaces(lang: string): string[] {
  return fs
    .readdirSync(path.join(I18N_DIR, lang))
    .filter((file) => file.endsWith(".json"))
    .sort();
}

/** Carga un archivo de traducción como objeto. */
function loadTranslation(lang: string, namespace: string): Record<string, string> {
  const filePath = path.join(I18N_DIR, lang, namespace);
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as Record<string, string>;
}

const languages = getLanguages();
const referenceNamespaces = getNamespaces(REFERENCE_LANG);

describe("Paridad de traducciones i18n", () => {
  it("existe el idioma de referencia y al menos otro idioma", () => {
    expect(languages).toContain(REFERENCE_LANG);
    expect(languages.length).toBeGreaterThanOrEqual(2);
  });

  // Para cada idioma que NO es el de referencia, comprobamos que todo cuadra.
  for (const lang of languages.filter((l) => l !== REFERENCE_LANG)) {
    describe(`idioma "${lang}" vs "${REFERENCE_LANG}"`, () => {
      it("tiene los mismos archivos de namespace", () => {
        expect(getNamespaces(lang)).toEqual(referenceNamespaces);
      });

      for (const namespace of referenceNamespaces) {
        describe(namespace, () => {
          const referenceKeys = Object.keys(loadTranslation(REFERENCE_LANG, namespace)).sort();

          it("tiene exactamente las mismas claves (ni de más ni de menos)", () => {
            const langKeys = Object.keys(loadTranslation(lang, namespace)).sort();
            expect(langKeys).toEqual(referenceKeys);
          });

          it("no tiene ningún valor vacío", () => {
            const translation = loadTranslation(lang, namespace);
            for (const [key, value] of Object.entries(translation)) {
              expect(typeof value).toBe("string");
              expect(value.trim().length).toBeGreaterThan(0);
              // Pista en el mensaje de error si algo falla.
              if (value.trim().length === 0) {
                throw new Error(`Valor vacío en ${lang}/${namespace} → "${key}"`);
              }
            }
          });
        });
      }
    });
  }

  // El idioma de referencia tampoco debe tener valores vacíos.
  describe(`idioma de referencia "${REFERENCE_LANG}"`, () => {
    for (const namespace of referenceNamespaces) {
      it(`${namespace} no tiene valores vacíos`, () => {
        const translation = loadTranslation(REFERENCE_LANG, namespace);
        for (const value of Object.values(translation)) {
          expect(value.trim().length).toBeGreaterThan(0);
        }
      });
    }
  });
});
