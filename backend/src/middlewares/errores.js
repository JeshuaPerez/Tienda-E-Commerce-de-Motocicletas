// Convierte cualquier error en una respuesta JSON con el formato { error: { mensaje, detalles? } }.
import { ErrorAplicacion, noEncontrado } from '../utils/errores.js';

export function rutaNoEncontrada(_req, _res, next) {
  next(noEncontrado('Ruta no encontrada'));
}

export function manejarErrores(error, _req, res, _next) {
  if (error instanceof ErrorAplicacion) {
    return res.status(error.estado).json({ error: { mensaje: error.message, detalles: error.detalles } });
  }
  // Errores de express.json(): cuerpo mal formado o demasiado grande.
  if (error?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { mensaje: 'El cuerpo de la petición no es JSON válido' } });
  }
  if (error?.type === 'entity.too.large') {
    return res.status(413).json({ error: { mensaje: 'El cuerpo de la petición es demasiado grande' } });
  }

  console.error(error);
  return res.status(500).json({ error: { mensaje: 'Error interno del servidor' } });
}
