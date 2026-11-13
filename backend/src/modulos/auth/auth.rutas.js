// Rutas de RF 01: /api/auth
import { Router } from 'express';

export function crearRutasAuth({ controlador, autenticar }) {
  const rutas = Router();
  rutas.post('/registro', controlador.registrar);
  rutas.post('/login', controlador.iniciarSesion);
  rutas.get('/perfil', autenticar, controlador.perfil);
  return rutas;
}
