// Lee y valida las variables de entorno (RN 7). Ningún secreto vive en el código.

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

  if (problemas.length) throw new ErrorConfiguracion(problemas);

  return Object.freeze({
    PORT: puerto,
    DATABASE_URL: variables.DATABASE_URL,
    JWT_SECRET: variables.JWT_SECRET,
    JWT_EXPIRA: variables.JWT_EXPIRA,
    BCRYPT_COSTO: costo,
  });
}

let entornoCargado;

// Configuración del proceso, validada una sola vez.
export function obtenerEntorno() {
  entornoCargado ??= cargarEntorno();
  return entornoCargado;
}
