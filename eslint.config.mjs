// Plain ESLint config for the Vite + SolidJS project at the repo root.
// (No Next.js dependency — that was removed when the project became Vite-only.)
const eslintConfig = [
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "public/**",
      "download/**",
      "examples/**",
      "skills/**",
      "mini-services/**",
      "db/**",
      "prisma/**",
      "upload/**",
      "dev.log",
    ],
  },
];

export default eslintConfig;
