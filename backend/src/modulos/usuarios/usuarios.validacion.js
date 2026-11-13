// Validación de los datos de una cuenta. Devuelve los datos normalizados o lanza un 400.
import { datosInvalidos } from '../../utils/errores.js';

const FORMATO_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LARGO_MINIMO_CONTRASENA = 8;
// bcrypt solo usa los primeros 72 bytes; se limita para no aceptar claves que se truncarían.
const LARGO_MAXIMO_CONTRASENA = 72;

export const normalizarCorreo = (correo) => (typeof correo === 'string' ? correo.trim().toLowerCase() : '');

export function validarDatosCuenta(datos = {}) {
  const nombre = typeof datos.nombre === 'string' ? datos.nombre.trim() : '';
  const correo = normalizarCorreo(datos.correo);
  const contrasena = typeof datos.contrasena === 'string' ? datos.contrasena : '';
  const problemas = [];

  if (!nombre || nombre.length > 120) problemas.push('nombre: obligatorio, máximo 120 caracteres');
  if (!FORMATO_CORREO.test(correo) || correo.length > 150) problemas.push('correo: formato inválido');
  if (contrasena.length < LARGO_MINIMO_CONTRASENA) {
    problemas.push(`contrasena: mínimo ${LARGO_MINIMO_CONTRASENA} caracteres`);
  } else if (Buffer.byteLength(contrasena) > LARGO_MAXIMO_CONTRASENA) {
    problemas.push(`contrasena: máximo ${LARGO_MAXIMO_CONTRASENA} bytes`);
  }

  if (problemas.length) throw datosInvalidos(problemas);
  return { nombre, correo, contrasena };
}

// Forma pública de un usuario: nunca incluye el hash de la contraseña.
export const usuarioPublico = ({ id, nombre, correo, rol }) => ({ id, nombre, correo, rol });
