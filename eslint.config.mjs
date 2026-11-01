import obsidianmd from "eslint-plugin-obsidianmd";
import globals from "globals";
import { defineConfig } from "eslint/config";

export default defineConfig(
  {
    ignores: ["node_modules/**", ".test-build/**", "main.js", "tests/**", "test-vault/**", "validation/**", "esbuild.config.mjs", "eslint.config.mjs"],
  },
  {
    languageOptions: {
      globals: { ...globals.browser },
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
  },
  ...obsidianmd.configs.recommended,
);
