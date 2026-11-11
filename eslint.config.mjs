import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // React Compiler's set-state-in-effect flags every legitimate
      // "fetch-on-mount" async hook (the setState runs after an await).
      // Verified false positive across the 14 app hooks — see ERRORS.md
      // 2026-10-15 and the 2026-11-11 lint audit. Suppressed deliberately so
      // `npm run lint` can be warning-clean; real cascading renders are still
      // caught by React's runtime warnings and by the hook's own test suite.
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    // Local asset/measurement scripts are not shipped and are not TypeScript
    // modules; unused scratch variables there are not app defects.
    files: ["scripts/**/*.mjs"],
    rules: { "@typescript-eslint/no-unused-vars": "off" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Local scratch tooling (Node scripts, own conventions) — not app code.
    ".uiparse/**",
    // Standalone spike (own package.json, not part of the app lint).
    "savborne-spike/**",
    // Third-party asset packs (Kenney etc.) — reference material, not app code.
    "assets-raw/**",
    // Local motion-design workspace (own package, not part of the app lint).
    "ai-launch-videos/**",
  ]),
]);

export default eslintConfig;
