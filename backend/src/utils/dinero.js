// Montos en quetzales (RN 6). Se usa Prisma.Decimal (decimal.js) y nunca punto flotante.
import { Prisma } from '@prisma/client';
import { datosInvalidos } from './errores.js';

export const Decimal = Prisma.Decimal;

// Hasta 10 dígitos enteros (cabe en NUMERIC(12,2)) y como máximo 2 decimales.
const FORMATO_MONTO = /^\d{1,10}(\.\d{1,2})?$/;

export function leerMonto(valor, campo, { permitirCero = false } = {}) {
  const texto = typeof valor === 'number' || typeof valor === 'string' ? String(valor).trim() : '';
  if (!FORMATO_MONTO.test(texto)) {
    throw datosInvalidos([`${campo}: monto en GTQ inválido (número positivo con hasta 2 decimales)`]);
  }
  const monto = new Decimal(texto);
  if (!permitirCero && monto.isZero()) throw datosInvalidos([`${campo}: debe ser mayor que cero`]);
  return monto;
}

// Representación pública de un monto: texto con dos decimales, p. ej. "25999.90".
export const formatearMonto = (valor) => (valor === null || valor === undefined ? null : new Decimal(valor).toFixed(2));
