// Rutas de RF 02 y PA-1. Consultar el catálogo es público; modificarlo es solo para administradores.
import { Router } from 'express';
import multer from 'multer';
import { IMAGENES } from '../../config/negocio.js';
import { requiereRol } from '../../middlewares/autenticacion.js';

// Imagen del modelo: se recibe en memoria con límite de 2 MB; el servicio valida su tipo real.
const subida = multer({ storage: multer.memoryStorage(), limits: { fileSize: IMAGENES.tamanoMaximo, files: 1 } });

export function crearRutasCatalogo({ controlador: c, autenticar }) {
  const admin = [autenticar, requiereRol('ADMINISTRADOR')];
  const rutas = Router();

  rutas.get('/marcas', c.listarMarcas);
  rutas.post('/marcas', admin, c.crearMarca);
  rutas.put('/marcas/:id', admin, c.actualizarMarca);

  rutas.get('/modelos', c.listarModelos);
  rutas.post('/modelos', admin, c.crearModelo);
  rutas.put('/modelos/:id', admin, c.actualizarModelo);
  rutas.put('/modelos/:id/imagen', admin, subida.single('imagen'), c.subirImagenModelo);
  rutas.delete('/modelos/:id/imagen', admin, c.quitarImagenModelo);
  rutas.get('/imagenes/:nombre', c.servirImagen);

  rutas.get('/motocicletas', c.listarCatalogo);
  rutas.get('/motocicletas/:id', c.obtenerMotocicleta);
  rutas.post('/motocicletas', admin, c.crearMotocicleta);
  rutas.put('/motocicletas/:id', admin, c.actualizarMotocicleta);
  rutas.patch('/motocicletas/:id/estado', admin, c.cambiarEstado);

  rutas.get('/accesorios', c.listarAccesorios);
  rutas.post('/accesorios', admin, c.crearAccesorio);
  rutas.put('/accesorios/:id', admin, c.actualizarAccesorio);

  return rutas;
}
