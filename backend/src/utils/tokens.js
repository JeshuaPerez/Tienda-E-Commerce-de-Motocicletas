// Firma y verificación de JWT (RF 01). El secreto y la duración vienen del entorno (RN 7).
import jwt from 'jsonwebtoken';
import { noAutenticado } from './errores.js';

const ALGORITMO = 'HS256';

export function crearServicioTokens({ secreto, expira }) {
  return {
    firmar: (usuario) =>
      jwt.sign({ rol: usuario.rol }, secreto, {
        algorithm: ALGORITMO,
        subject: String(usuario.id),
        expiresIn: expira,
      }),

    verificar(token) {
      try {
        const carga = jwt.verify(token, secreto, { algorithms: [ALGORITMO] });
        return { sub: Number(carga.sub), rol: carga.rol };
      } catch {
        throw noAutenticado('Sesión inválida o vencida');
      }
    },
  };
}
