// Rutas de RF 03: checkout (RN 3: exige sesión de cliente), historial, ventas y comprobantes (RN 4).
import { Router } from 'express';
import multer from 'multer';
import { COMPROBANTES } from '../../config/negocio.js';
import { requiereRol } from '../../middlewares/autenticacion.js';

// PA-8: el archivo se recibe en memoria con límite de 5 MB; el servicio valida su tipo real y lo guarda.
const subida = multer({ storage: multer.memoryStorage(), limits: { fileSize: COMPROBANTES.tamanoMaximo, files: 1 } });

export function crearRutasVentas({ controlador: c, autenticar }) {
  const admin = [autenticar, requiereRol('ADMINISTRADOR')];
  const cliente = [autenticar, requiereRol('CLIENTE')];
  const rutas = Router();

  rutas.post('/checkout/cotizar', c.cotizar);
  rutas.post('/checkout', cliente, c.checkout);
  rutas.get('/mis-compras', cliente, c.misCompras);

  rutas.get('/ventas', admin, c.listar);
  rutas.get('/ventas/:id', autenticar, c.obtener);
  rutas.post('/ventas/:id/comprobante', cliente, subida.single('comprobante'), c.subirComprobante);
  rutas.post('/ventas/:id/cobro', admin, c.cobrar);
  rutas.patch('/ventas/:id/entregar', admin, c.entregar);
  rutas.patch('/ventas/:id/cancelar', autenticar, c.cancelar);

  rutas.get('/comprobantes', admin, c.listarComprobantes);
  rutas.get('/comprobantes/:id/archivo', autenticar, c.archivo);
  rutas.patch('/comprobantes/:id/aprobar', admin, c.aprobar);
  rutas.patch('/comprobantes/:id/rechazar', admin, c.rechazar);

  return rutas;
}
