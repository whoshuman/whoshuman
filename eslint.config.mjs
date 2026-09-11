import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/.turbo/**",
      "**/coverage/**",
      "docs/**" // specs/herramientas internas (gitignored)
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    files: ["apps/**/*.{ts,tsx,mts,cts}", "packages/**/*.{ts,tsx,mts,cts}"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      }
    },
    rules: {
      // Permite `const { omitida, ...resto } = obj` para descartar un campo sin
      // que salte no-unused-vars por la variable extraida y no usada.
      "@typescript-eslint/no-unused-vars": ["error", { ignoreRestSiblings: true }]
    }
  },
  {
    files: ["**/*.{js,mjs,cjs}", "*.config.ts", "*.config.mts"],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: {
      globals: {
        process: "readonly",
        console: "readonly"
      }
    }
  },
  eslintConfigPrettier
);
