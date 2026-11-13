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
import { crearDatos } from './db/repositorios.js';
import { crearServicioCatalogo } from './modulos/catalogo/catalogo.servicio.js';
import { crearControladorCatalogo } from './modulos/catalogo/catalogo.controlador.js';
import { crearRutasCatalogo } from './modulos/catalogo/catalogo.rutas.js';
import { crearServicioInventario } from './modulos/inventario/inventario.servicio.js';
import { crearControladorInventario } from './modulos/inventario/inventario.controlador.js';
import { crearRutasInventario } from './modulos/inventario/inventario.rutas.js';
import { crearServicioCompras } from './modulos/compras/compras.servicio.js';
import { crearControladorCompras } from './modulos/compras/compras.controlador.js';
import { crearRutasCompras } from './modulos/compras/compras.rutas.js';

export function crearApp({ entorno = obtenerEntorno(), repositorioUsuarios, datos } = {}) {
  const repoUsuarios = repositorioUsuarios ?? crearRepositorioUsuarios(obtenerPrisma());
  const datosNegocio = datos ?? crearDatos(obtenerPrisma());
  const contrasenas = crearServicioContrasenas(entorno.BCRYPT_COSTO);
  const tokens = crearServicioTokens({ secreto: entorno.JWT_SECRET, expira: entorno.JWT_EXPIRA });
  const autenticar = crearAutenticar({ tokens, repositorioUsuarios: repoUsuarios });

  const servicioAuth = crearServicioAuth({ repositorioUsuarios: repoUsuarios, contrasenas, tokens });
  const servicioUsuarios = crearServicioUsuarios({ repositorioUsuarios: repoUsuarios, contrasenas });
  const servicioCatalogo = crearServicioCatalogo({ datos: datosNegocio });
  const servicioInventario = crearServicioInventario({ datos: datosNegocio });
  const servicioCompras = crearServicioCompras({ datos: datosNegocio });

  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));

  app.use('/api/auth', crearRutasAuth({ controlador: crearControladorAuth(servicioAuth), autenticar }));
  app.use('/api/usuarios', crearRutasUsuarios({ controlador: crearControladorUsuarios(servicioUsuarios), autenticar }));
  app.use('/api', crearRutasCatalogo({ controlador: crearControladorCatalogo(servicioCatalogo), autenticar }));
  app.use(
    '/api/inventario',
    crearRutasInventario({ controlador: crearControladorInventario({ servicioInventario, servicioCatalogo }), autenticar }),
  );
  app.use('/api', crearRutasCompras({ controlador: crearControladorCompras(servicioCompras), autenticar }));

  app.use(rutaNoEncontrada);
  app.use(manejarErrores);
  return app;
}
