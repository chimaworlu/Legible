import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Deno runtime (Supabase Edge Functions) — not part of this Node/
    // Next.js project; uses npm:/.ts-extension imports and Deno globals
    // this config doesn't know about.
    "supabase/functions/**",
  ]),
]);

export default eslintConfig;
