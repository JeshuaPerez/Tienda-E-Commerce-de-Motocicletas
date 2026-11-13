// NIT de Guatemala: dígitos más un dígito verificador (0-9 o K). "CF" = consumidor final.
const FORMATO_NIT = /^\d{1,12}[\dK]$/;

// Quita espacios y guiones y pasa a mayúsculas: "1234567-8" → "12345678".
export const normalizarNit = (nit) => (typeof nit === 'string' ? nit.replace(/[\s-]/g, '').toUpperCase() : '');

export const esNitValido = (nit) => nit === 'CF' || FORMATO_NIT.test(nit);
