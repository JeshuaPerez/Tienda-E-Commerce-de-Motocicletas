// Composición de la aplicación: arma Repositorio → Servicio → Controlador → Router.
// Las dependencias se pueden inyectar (por ejemplo, un repositorio en memoria en las pruebas).
import express from 'express';
import { obtenerEntorno } from './config/entorno.js';
import { obtenerPrisma } from './db/prisma.js';
import { crearServicioContrasenas } from './utils/contrasenas.js';
import { crearServicioTokens } from './utils/tokens.js';
import { crearAutenticar } from './middlewares/autenticacion.js';
import { manejarErrores, rutaNoEncontrada } from './middlewares/errores.js';
import { crearRepositorioUsuarios } from './modulos/usuarios/usuarios.repositorio.js';
import { crearServicioUsuarios } from './modulos/usuarios/usuarios.servicio.js';
import { crearControladorUsuarios } from './modulos/usuarios/usuarios.controlador.js';
import { crearRutasUsuarios } from './modulos/usuarios/usuarios.rutas.js';
import { crearServicioAuth } from './modulos/auth/auth.servicio.js';
import { crearControladorAuth } from './modulos/auth/auth.controlador.js';
import { crearRutasAuth } from './modulos/auth/auth.rutas.js';

export function crearApp({ entorno = obtenerEntorno(), repositorioUsuarios } = {}) {
  const repoUsuarios = repositorioUsuarios ?? crearRepositorioUsuarios(obtenerPrisma());
  const contrasenas = crearServicioContrasenas(entorno.BCRYPT_COSTO);
  const tokens = crearServicioTokens({ secreto: entorno.JWT_SECRET, expira: entorno.JWT_EXPIRA });
  const autenticar = crearAutenticar({ tokens, repositorioUsuarios: repoUsuarios });

  const servicioAuth = crearServicioAuth({ repositorioUsuarios: repoUsuarios, contrasenas, tokens });
  const servicioUsuarios = crearServicioUsuarios({ repositorioUsuarios: repoUsuarios, contrasenas });

  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));

  app.use('/api/auth', crearRutasAuth({ controlador: crearControladorAuth(servicioAuth), autenticar }));
  app.use('/api/usuarios', crearRutasUsuarios({ controlador: crearControladorUsuarios(servicioUsuarios), autenticar }));

  app.use(rutaNoEncontrada);
  app.use(manejarErrores);
  return app;
}
