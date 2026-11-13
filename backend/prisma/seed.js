// Seed (PA-3): crea el primer administrador con ADMIN_CORREO, ADMIN_NOMBRE y ADMIN_CONTRASENA del .env.
// Se puede ejecutar varias veces: si el administrador ya existe, no lo duplica.
import { existsSync } from 'node:fs';

const rutaEnv = new URL('../.env', import.meta.url);
if (existsSync(rutaEnv)) process.loadEnvFile(rutaEnv);

const { obtenerEntorno } = await import('../src/config/entorno.js');
const { obtenerPrisma, desconectarPrisma } = await import('../src/db/prisma.js');
const { crearRepositorioUsuarios } = await import('../src/modulos/usuarios/usuarios.repositorio.js');
const { crearServicioUsuarios } = await import('../src/modulos/usuarios/usuarios.servicio.js');
const { crearServicioContrasenas } = await import('../src/utils/contrasenas.js');

try {
  const servicio = crearServicioUsuarios({
    repositorioUsuarios: crearRepositorioUsuarios(obtenerPrisma()),
    contrasenas: crearServicioContrasenas(obtenerEntorno().BCRYPT_COSTO),
  });
  const { creado, usuario } = await servicio.asegurarAdministradorInicial({
    nombre: process.env.ADMIN_NOMBRE,
    correo: process.env.ADMIN_CORREO,
    contrasena: process.env.ADMIN_CONTRASENA,
  });
  console.log(creado ? `Administrador creado: ${usuario.correo}` : `El administrador ${usuario.correo} ya existía`);
} catch (error) {
  console.error('No se pudo crear el administrador inicial:', error.message, error.detalles ?? '');
  process.exitCode = 1;
} finally {
  await desconectarPrisma();
}
