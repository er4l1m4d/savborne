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
      // Verified false positive — see ERRORS.md 2026-10-15. Downgraded from
      // error to warn so real cascading-render bugs still surface in review.
      "react-hooks/set-state-in-effect": "warn",
    },
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
  ]),
]);

export default eslintConfig;
