import { defineConfig } from "prisma/config";

// Prisma 6 config file (replaces the deprecated package.json#prisma block).
// DATABASE_URL itself is still read from the environment by the `datasource`
// block in prisma/schema.prisma — this file only wires the schema path and
// the seed command.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
