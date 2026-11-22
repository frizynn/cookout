// @ts-check
// General code lint. Package boundaries are NOT checked here; they live in
// .dependency-cruiser.cjs (`pnpm lint:boundaries`). See CODING_STANDARDS.md.
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["**/dist/**", "**/node_modules/**", ".claude/**"] },
  js.configs.recommended,
  tseslint.configs.strict,
  {
    languageOptions: { globals: globals.node },
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: "ExportAllDeclaration",
          message:
            "No barrel files: export what you mean by name, from the file that defines it (CODING_STANDARDS.md).",
        },
        {
          selector: "NewExpression[callee.name='Date'][arguments.length=0]",
          message: "Use the injected clock (CODING_STANDARDS.md).",
        },
      ],
      // Clocks, ID sources and timers are injected (CODING_STANDARDS.md).
      // The one start-up file that wires the real ones disables these with
      // an eslint-disable comment that says why.
      "no-restricted-properties": [
        "error",
        { object: "Date", property: "now", message: "Use the injected clock (CODING_STANDARDS.md)." },
        { object: "Math", property: "random", message: "Use the injected ID source (CODING_STANDARDS.md)." },
        { object: "crypto", property: "randomUUID", message: "Use the injected ID source (CODING_STANDARDS.md)." },
      ],
      "no-restricted-globals": [
        "error",
        { name: "setTimeout", message: "Use the injected timer (CODING_STANDARDS.md)." },
        { name: "setInterval", message: "Use the injected timer (CODING_STANDARDS.md)." },
      ],
    },
  },
  {
    files: ["**/tests/**", "**/*.test.ts", "*.config.*", ".dependency-cruiser.cjs"],
    rules: {
      "no-restricted-properties": "off",
      "no-restricted-globals": "off",
      "no-restricted-syntax": [
        "error",
        { selector: "ExportAllDeclaration", message: "No barrel files (CODING_STANDARDS.md)." },
      ],
    },
  },
  {
    files: ["**/*.cjs"],
    languageOptions: { sourceType: "commonjs" },
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
);
