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
import { crearAlmacenArchivos } from './infra/almacen-archivos.js';
import { crearServicioCupones } from './modulos/cupones/cupones.servicio.js';
import { crearControladorCupones, crearRutasCupones } from './modulos/cupones/cupones.rutas.js';
import { crearServicioCaja } from './modulos/caja/caja.servicio.js';
import { crearControladorCaja, crearRutasCaja } from './modulos/caja/caja.rutas.js';
import { crearServicioVentas } from './modulos/ventas/ventas.servicio.js';
import { crearControladorVentas } from './modulos/ventas/ventas.controlador.js';
import { crearRutasVentas } from './modulos/ventas/ventas.rutas.js';
import { crearServicioPos } from './modulos/pos/pos.servicio.js';
import { crearControladorPos, crearRutasPos } from './modulos/pos/pos.rutas.js';
import { crearEmisorInterno } from './modulos/facturacion/emisor-interno.js';
import { crearServicioFacturacion } from './modulos/facturacion/facturacion.servicio.js';
import { crearControladorFacturacion, crearRutasFacturacion } from './modulos/facturacion/facturacion.rutas.js';
import { crearServicioReportes } from './modulos/reportes/reportes.servicio.js';
import { crearControladorReportes, crearRutasReportes } from './modulos/reportes/reportes.rutas.js';

export function crearApp({ entorno = obtenerEntorno(), repositorioUsuarios, datos, almacen, reloj } = {}) {
  const repoUsuarios = repositorioUsuarios ?? crearRepositorioUsuarios(obtenerPrisma());
  const datosNegocio = datos ?? crearDatos(obtenerPrisma());
  const almacenComprobantes = almacen ?? crearAlmacenArchivos(entorno.DIRECTORIO_COMPROBANTES);
  const contrasenas = crearServicioContrasenas(entorno.BCRYPT_COSTO);
  const tokens = crearServicioTokens({ secreto: entorno.JWT_SECRET, expira: entorno.JWT_EXPIRA });
  const autenticar = crearAutenticar({ tokens, repositorioUsuarios: repoUsuarios });

  const servicioAuth = crearServicioAuth({ repositorioUsuarios: repoUsuarios, contrasenas, tokens });
  const servicioUsuarios = crearServicioUsuarios({ repositorioUsuarios: repoUsuarios, contrasenas });
  const servicioCatalogo = crearServicioCatalogo({ datos: datosNegocio });
  const servicioInventario = crearServicioInventario({ datos: datosNegocio });
  const servicioCompras = crearServicioCompras({ datos: datosNegocio });
  const servicioCupones = crearServicioCupones({ datos: datosNegocio });
  const servicioCaja = crearServicioCaja({ datos: datosNegocio, reloj });
  // PA-7: emisor de facturas internas; los datos del emisor vienen del entorno.
  const emisor = crearEmisorInterno({ serie: entorno.FACTURA_SERIE, datosEmisor: entorno.EMISOR });
  const servicioVentas = crearServicioVentas({ datos: datosNegocio, almacen: almacenComprobantes, reloj, emisor });
  const servicioPos = crearServicioPos({ datos: datosNegocio, reloj, emisor });
  const servicioFacturacion = crearServicioFacturacion({ datos: datosNegocio, reloj, emisor });
  const servicioReportes = crearServicioReportes({ datos: datosNegocio, reloj });

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
  app.use('/api/cupones', crearRutasCupones({ controlador: crearControladorCupones(servicioCupones), autenticar }));
  app.use('/api/caja', crearRutasCaja({ controlador: crearControladorCaja(servicioCaja), autenticar }));
  app.use('/api/pos', crearRutasPos({ controlador: crearControladorPos(servicioPos), autenticar }));
  app.use('/api', crearRutasVentas({ controlador: crearControladorVentas(servicioVentas), autenticar }));
  app.use('/api', crearRutasFacturacion({ controlador: crearControladorFacturacion(servicioFacturacion), autenticar }));
  app.use('/api/reportes', crearRutasReportes({ controlador: crearControladorReportes(servicioReportes), autenticar }));

  app.use(rutaNoEncontrada);
  app.use(manejarErrores);
  return app;
}
