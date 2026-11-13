// Lee y valida las variables de entorno (RN 7). Ningún secreto vive en el código.
import { fileURLToPath } from 'node:url';

export class ErrorConfiguracion extends Error {
  constructor(problemas) {
    super(`Configuración inválida: ${problemas.join('; ')}`);
    this.name = 'ErrorConfiguracion';
    this.problemas = problemas;
  }
}

const OBLIGATORIAS = ['PORT', 'DATABASE_URL', 'JWT_SECRET', 'JWT_EXPIRA'];

export function cargarEntorno(variables = process.env) {
  const problemas = [];

  for (const nombre of OBLIGATORIAS) {
    if (!variables[nombre]?.trim()) problemas.push(`falta ${nombre}`);
  }

  const puerto = Number(variables.PORT);
  if (variables.PORT && (!Number.isInteger(puerto) || puerto < 0 || puerto > 65535)) {
    problemas.push('PORT debe ser un número entre 0 y 65535');
  }

  if (variables.JWT_SECRET && variables.JWT_SECRET.length < 32) {
    problemas.push('JWT_SECRET debe tener al menos 32 caracteres');
  }

  const costo = Number(variables.BCRYPT_COSTO ?? 12);
  if (!Number.isInteger(costo) || costo < 4 || costo > 15) {
    problemas.push('BCRYPT_COSTO debe ser un entero entre 4 y 15');
  }

  if (variables.FACTURA_SERIE?.trim() && !/^[A-Z0-9]{1,10}$/.test(variables.FACTURA_SERIE.trim())) {
    problemas.push('FACTURA_SERIE debe tener de 1 a 10 letras mayúsculas o números');
  }

  if (problemas.length) throw new ErrorConfiguracion(problemas);

  return Object.freeze({
    PORT: puerto,
    DATABASE_URL: variables.DATABASE_URL,
    JWT_SECRET: variables.JWT_SECRET,
    JWT_EXPIRA: variables.JWT_EXPIRA,
    BCRYPT_COSTO: costo,
    // PA-8: carpeta local de comprobantes (fuera de git). Por defecto, backend/uploads/comprobantes.
    DIRECTORIO_COMPROBANTES:
      variables.DIRECTORIO_COMPROBANTES?.trim() || fileURLToPath(new URL('../../uploads/comprobantes', import.meta.url)),
    // PA-7: serie de la factura interna y datos del emisor que se imprimen en ella (opcionales).
    FACTURA_SERIE: variables.FACTURA_SERIE?.trim() || 'A',
    EMISOR: Object.freeze({
      nombre: variables.EMISOR_NOMBRE?.trim() || 'MotoStore GT',
      nit: variables.EMISOR_NIT?.trim() || null,
      direccion: variables.EMISOR_DIRECCION?.trim() || null,
    }),
  });
}

let entornoCargado;

// Configuración del proceso, validada una sola vez.
export function obtenerEntorno() {
  entornoCargado ??= cargarEntorno();
  return entornoCargado;
}
