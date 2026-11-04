import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

const config = [
  { ignores: ["node_modules/**", ".next/**", "next-env.d.ts", "coverage/**", "build/**"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // Sensitive content must go through src/lib/logger.ts, never raw console calls.
      "no-console": "error",
    },
  },
  {
    files: ["src/lib/logger.ts", "prisma/**", "scripts/**"],
    rules: { "no-console": "off" },
  },
];

export default config;
