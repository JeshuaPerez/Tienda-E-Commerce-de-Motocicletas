// Punto de entrada: carga .env, valida la configuración y levanta la API.
import { existsSync } from 'node:fs';

const rutaEnv = new URL('../.env', import.meta.url);
if (existsSync(rutaEnv)) process.loadEnvFile(rutaEnv);

const { obtenerEntorno } = await import('./config/entorno.js');
const { crearApp } = await import('./app.js');
const { desconectarPrisma } = await import('./db/prisma.js');

const entorno = obtenerEntorno(); // falla aquí, antes de escuchar, si falta alguna variable (RN 7)
const servidor = crearApp({ entorno }).listen(entorno.PORT, () => {
  console.log(`API de MotoStore GT escuchando en el puerto ${entorno.PORT}`);
});

const apagar = () => servidor.close(() => desconectarPrisma().finally(() => process.exit(0)));
process.on('SIGINT', apagar);
process.on('SIGTERM', apagar);
