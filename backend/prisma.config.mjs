// Configuración del CLI de Prisma 7. Prisma 7 no carga .env por su cuenta.
import { existsSync } from 'node:fs';
import { defineConfig } from 'prisma/config';

const rutaEnv = new URL('./.env', import.meta.url);
if (existsSync(rutaEnv)) process.loadEnvFile(rutaEnv);

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'node prisma/seed.js',
  },
  datasource: {
    // Se usa process.env (y no env()) para que `prisma generate` funcione sin base de datos.
    url: process.env.DATABASE_URL ?? '',
  },
});
