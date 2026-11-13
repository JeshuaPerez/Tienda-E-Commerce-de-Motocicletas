// Rutas de RF 10: /api/reportes (solo administradores).
import { Router } from 'express';
import { requiereRol } from '../../middlewares/autenticacion.js';

export function crearControladorReportes(servicio) {
  return {
    ventas: async (req, res) => res.json(await servicio.ventas(req.query)),
    masVendidas: async (req, res) => res.json(await servicio.masVendidas(req.query)),
    flujoCaja: async (req, res) => res.json(await servicio.flujoCaja(req.query)),
    rendimiento: async (req, res) => res.json(await servicio.rendimiento(req.query)),
  };
}

export function crearRutasReportes({ controlador: c, autenticar }) {
  const rutas = Router();
  rutas.use(autenticar, requiereRol('ADMINISTRADOR'));
  rutas.get('/ventas', c.ventas);
  rutas.get('/mas-vendidas', c.masVendidas);
  rutas.get('/flujo-caja', c.flujoCaja);
  rutas.get('/rendimiento', c.rendimiento);
  return rutas;
}
