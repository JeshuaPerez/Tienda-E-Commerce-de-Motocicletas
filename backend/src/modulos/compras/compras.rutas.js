// Rutas de RF 07: /api/proveedores y /api/ordenes-compra (solo administradores).
import { Router } from 'express';
import { requiereRol } from '../../middlewares/autenticacion.js';

export function crearRutasCompras({ controlador: c, autenticar }) {
  const admin = [autenticar, requiereRol('ADMINISTRADOR')];
  const rutas = Router();

  rutas.get('/proveedores', admin, c.listarProveedores);
  rutas.get('/proveedores/:id', admin, c.obtenerProveedor);
  rutas.post('/proveedores', admin, c.crearProveedor);
  rutas.put('/proveedores/:id', admin, c.actualizarProveedor);

  rutas.get('/ordenes-compra', admin, c.listarOrdenes);
  rutas.get('/ordenes-compra/:id', admin, c.obtenerOrden);
  rutas.post('/ordenes-compra', admin, c.crearOrden);
  rutas.patch('/ordenes-compra/:id/estado', admin, c.cambiarEstadoOrden);
  rutas.post('/ordenes-compra/:id/recepciones', admin, c.recibirMercancia);

  return rutas;
}
