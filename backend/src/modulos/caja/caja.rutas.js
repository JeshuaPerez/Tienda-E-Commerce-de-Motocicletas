// Rutas de RF 05: /api/caja (solo administradores).
import { Router } from 'express';
import { requiereRol } from '../../middlewares/autenticacion.js';
import { leerId } from '../../utils/validacion.js';

export function crearControladorCaja(servicio) {
  return {
    abrir: async (req, res) => res.status(201).json({ caja: await servicio.abrir(req.body, req.usuario.id) }),
    actual: async (_req, res) => res.json(await servicio.obtenerActual()),
    retirar: async (req, res) => res.status(201).json(await servicio.retirar(req.body, req.usuario.id)),
    cerrar: async (req, res) => res.json({ caja: await servicio.cerrar(req.body, req.usuario.id) }),
    sesiones: async (_req, res) => res.json({ sesiones: await servicio.listarSesiones() }),
    cuadre: async (req, res) => res.json({ caja: await servicio.obtenerCuadre(leerId(req.params.id)) }),
  };
}

export function crearRutasCaja({ controlador: c, autenticar }) {
  const rutas = Router();
  rutas.use(autenticar, requiereRol('ADMINISTRADOR'));
  rutas.post('/apertura', c.abrir);
  rutas.get('/actual', c.actual);
  rutas.post('/retiros', c.retirar);
  rutas.post('/cierre', c.cerrar);
  rutas.get('/sesiones', c.sesiones);
  rutas.get('/sesiones/:id', c.cuadre);
  return rutas;
}
