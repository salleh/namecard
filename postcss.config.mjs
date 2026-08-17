// Tailwind CSS v4 is a PostCSS plugin. Next.js picks this config up automatically
// during `next build`/`next dev`. Vitest does not run PostCSS on these files, so
// no test path depends on this config.
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
