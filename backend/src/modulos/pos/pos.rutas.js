// Rutas de RF 04: /api/pos (solo administradores; el vendedor es quien inicia sesión, PA-2).
import { Router } from 'express';
import { requiereRol } from '../../middlewares/autenticacion.js';

export function crearControladorPos(servicio) {
  return {
    vender: async (req, res) => res.status(201).json({ venta: await servicio.registrarVenta(req.body, req.usuario.id) }),
    clientes: async (req, res) => res.json({ clientes: await servicio.buscarClientes(req.query) }),
  };
}

export function crearRutasPos({ controlador: c, autenticar }) {
  const rutas = Router();
  rutas.use(autenticar, requiereRol('ADMINISTRADOR'));
  rutas.post('/ventas', c.vender);
  rutas.get('/clientes', c.clientes);
  return rutas;
}
