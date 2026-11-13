// Rutas de RF 09: /api/cupones (solo administradores). Controlador y rutas juntos por ser tres acciones.
import { Router } from 'express';
import { requiereRol } from '../../middlewares/autenticacion.js';
import { leerId } from '../../utils/validacion.js';

export function crearControladorCupones(servicio) {
  return {
    listar: async (_req, res) => res.json({ cupones: await servicio.listarCupones() }),
    crear: async (req, res) => res.status(201).json({ cupon: await servicio.crearCupon(req.body) }),
    actualizar: async (req, res) => res.json({ cupon: await servicio.actualizarCupon(leerId(req.params.id), req.body) }),
  };
}

export function crearRutasCupones({ controlador: c, autenticar }) {
  const rutas = Router();
  rutas.use(autenticar, requiereRol('ADMINISTRADOR'));
  rutas.get('/', c.listar);
  rutas.post('/', c.crear);
  rutas.put('/:id', c.actualizar);
  return rutas;
}
