// Aplica las migraciones a la base de pruebas (DATABASE_URL_TEST) antes de correr la suite.
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const rutaEnv = new URL('../.env', import.meta.url);
if (existsSync(rutaEnv)) process.loadEnvFile(rutaEnv);

const urlPruebas = process.env.DATABASE_URL_TEST;
if (!urlPruebas) {
  console.warn('[pruebas] DATABASE_URL_TEST no está definida: se omiten las pruebas de integración.');
  process.exit(0);
}
if (!new URL(urlPruebas).pathname.endsWith('_test')) {
  console.error('[pruebas] DATABASE_URL_TEST debe apuntar a una base cuyo nombre termine en "_test".');
  process.exit(1);
}

const resultado = spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, DATABASE_URL: urlPruebas },
});
process.exit(resultado.status ?? 1);
