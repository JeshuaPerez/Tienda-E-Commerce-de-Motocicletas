// Rutas de RF 08: /api/facturas y /api/mis-facturas.
import { Router } from 'express';
import { requiereRol } from '../../middlewares/autenticacion.js';
import { leerId } from '../../utils/validacion.js';

export function crearControladorFacturacion(servicio) {
  return {
    listar: async (req, res) => res.json(await servicio.listarFacturas(req.query)),
    obtener: async (req, res) => res.json({ factura: await servicio.obtenerFactura(leerId(req.params.id), req.usuario) }),
    mias: async (req, res) => res.json(await servicio.misFacturas(req.usuario.id, req.query)),
    reemitir: async (req, res) => res.status(201).json({ factura: await servicio.reemitir(req.body, req.usuario.id) }),
    anular: async (req, res) => res.json({ factura: await servicio.anular(leerId(req.params.id), req.body, req.usuario.id) }),
  };
}

export function crearRutasFacturacion({ controlador: c, autenticar }) {
  const admin = [autenticar, requiereRol('ADMINISTRADOR')];
  const rutas = Router();
  rutas.get('/mis-facturas', autenticar, requiereRol('CLIENTE'), c.mias);
  rutas.get('/facturas', admin, c.listar);
  rutas.post('/facturas', admin, c.reemitir);
  rutas.get('/facturas/:id', autenticar, c.obtener);
  rutas.patch('/facturas/:id/anular', admin, c.anular);
  return rutas;
}
