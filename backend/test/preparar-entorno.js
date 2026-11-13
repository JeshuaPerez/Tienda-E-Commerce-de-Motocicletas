// Se carga antes de cada archivo de prueba (node --import).
// Carga backend/.env y, si existe DATABASE_URL_TEST, apunta DATABASE_URL a la base de pruebas
// para que las pruebas nunca toquen la base de desarrollo.
import { existsSync } from 'node:fs';

const rutaEnv = new URL('../.env', import.meta.url);
if (existsSync(rutaEnv)) process.loadEnvFile(rutaEnv);

if (process.env.DATABASE_URL_TEST) {
  process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
} else {
  // Sin base de pruebas, las pruebas unitarias corren igual con valores ficticios;
  // las de integración se omiten (ver test/integracion/ayudantes.js).
  delete process.env.DATABASE_URL;
  process.env.DATABASE_URL = 'postgresql://sin-base:sin-base@localhost:5432/sin_base_test';
}

process.env.PORT ??= '0';
process.env.JWT_SECRET ??= 'secreto-de-pruebas-que-no-se-usa-en-produccion';
process.env.JWT_EXPIRA ??= '1h';
process.env.BCRYPT_COSTO = '4'; // costo bajo solo para que las pruebas sean rápidas
