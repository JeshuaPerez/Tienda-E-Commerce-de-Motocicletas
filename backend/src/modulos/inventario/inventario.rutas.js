// Rutas de RF 06: /api/inventario (solo administradores).
import { Router } from 'express';
import { requiereRol } from '../../middlewares/autenticacion.js';

export function crearRutasInventario({ controlador: c, autenticar }) {
  const rutas = Router();
  rutas.use(autenticar, requiereRol('ADMINISTRADOR'));
  rutas.get('/resumen', c.resumen);
  rutas.get('/alertas', c.alertas);
  rutas.get('/motocicletas', c.motocicletas);
  rutas.get('/movimientos', c.movimientos);
  rutas.post('/ajustes', c.ajustar);
  return rutas;
}
