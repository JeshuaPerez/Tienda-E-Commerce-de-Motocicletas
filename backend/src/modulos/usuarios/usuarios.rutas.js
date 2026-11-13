// Rutas de PA-3: /api/usuarios (solo administradores)
import { Router } from 'express';
import { requiereRol } from '../../middlewares/autenticacion.js';

export function crearRutasUsuarios({ controlador, autenticar }) {
  const rutas = Router();
  rutas.post('/', autenticar, requiereRol('ADMINISTRADOR'), controlador.crearAdministrador);
  return rutas;
}
