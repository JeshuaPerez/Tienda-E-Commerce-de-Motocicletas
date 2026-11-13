// VIN (número de chasis) según ISO 3779: 17 caracteres, letras y dígitos, sin I, O ni Q.
const FORMATO_VIN = /^[A-HJ-NPR-Z0-9]{17}$/;

export const normalizarVin = (vin) => (typeof vin === 'string' ? vin.replace(/\s+/g, '').toUpperCase() : '');

export const esVinValido = (vin) => FORMATO_VIN.test(vin);
