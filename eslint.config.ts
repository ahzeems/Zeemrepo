import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

// The size limits are ECC's coding-style ceilings (.claude/rules/ecc/common/coding-style.md),
// enforced here because a rule only holds if a check runs it.
export const MAX_FILE_LINES = 800;
export const MAX_FUNCTION_LINES = 50;
export const MAX_DEPTH = 4;

export default defineConfig(
  { ignores: ["node_modules/**", "scripts/fixtures/**", ".worktrees/**"] },
  {
    files: ["scripts/**/*.ts", "eslint.config.ts"],
    extends: [js.configs.recommended, tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        project: ["./tsconfig.json"],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-floating-promises": ["error", { ignoreVoid: false }],
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/consistent-type-assertions": ["error", { assertionStyle: "never" }],
      "@typescript-eslint/ban-ts-comment": ["error", {
        "ts-expect-error": true, "ts-ignore": true, "ts-nocheck": true, "ts-check": false,
      }],
      "max-lines": ["error", { max: MAX_FILE_LINES, skipBlankLines: false, skipComments: false }],
      "max-lines-per-function": ["error", { max: MAX_FUNCTION_LINES, skipBlankLines: true, skipComments: true, IIFEs: true }],
      "max-depth": ["error", MAX_DEPTH],
    },
  },
  {
    // Tests group cases inside test() callbacks, which are long by nature; the
    // 800-line file ceiling still applies to them.
    files: ["scripts/**/*.test.ts"],
    rules: { "max-lines-per-function": "off" },
  },
);
