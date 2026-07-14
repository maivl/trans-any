// The application lives entirely in `solid-chat/` (a Vite + SolidJS project
// with its own tooling). There is no root-level JS/TS source to lint, so this
// config simply ignores everything except nothing. The next-config-based
// config was removed when Next.js was dropped from the project.
const eslintConfig = [
  {
    ignores: [
      "node_modules/**",
      "solid-chat/**",
      "public/**",
      "download/**",
      "examples/**",
      "skills/**",
      "mini-services/**",
      "db/**",
      "prisma/**",
      "upload/**",
    ],
  },
];

export default eslintConfig;
