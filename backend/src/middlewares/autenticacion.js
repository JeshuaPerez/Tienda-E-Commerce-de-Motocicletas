// Protección de rutas: autenticar() exige un JWT válido y requiereRol() limita por rol (RF 01).
import { noAutenticado, sinPermiso } from '../utils/errores.js';

export function crearAutenticar({ tokens, repositorioUsuarios }) {
  return async function autenticar(req, _res, next) {
    const [esquema, token] = (req.get('authorization') ?? '').split(' ');
    if (esquema !== 'Bearer' || !token) throw noAutenticado();

    const { sub } = tokens.verificar(token);
    // Se consulta el usuario en cada petición para que una cuenta desactivada pierda el acceso
    // aunque su token siga vigente, y para usar el rol actual y no el del momento del login.
    const usuario = await repositorioUsuarios.buscarPorId(sub);
    if (!usuario?.activo) throw noAutenticado('Sesión inválida o vencida');

    req.usuario = { id: usuario.id, rol: usuario.rol };
    next();
  };
}

export function requiereRol(...roles) {
  return function verificarRol(req, _res, next) {
    if (!req.usuario) throw noAutenticado();
    if (!roles.includes(req.usuario.rol)) throw sinPermiso();
    next();
  };
}
