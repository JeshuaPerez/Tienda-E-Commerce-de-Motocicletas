// Validación de los datos de una motocicleta. La usan el alta manual (catálogo) y la recepción (compras).
import { crearLector } from '../../utils/validacion.js';
import { esVinValido, normalizarVin } from '../../utils/vin.js';

export const ESTADOS_MOTO = ['DISPONIBLE', 'RESERVADA', 'VENDIDA'];
export const anioMaximo = () => new Date().getFullYear() + 1;

// Lee los datos propios de una unidad. Con parcial=true (edición) ningún campo es obligatorio.
export function leerDatosUnidad(lector, { parcial = false } = {}) {
  const obligatorio = !parcial;
  return {
    anio: lector.entero('anio', { obligatorio, min: 1900, max: anioMaximo() }),
    color: lector.texto('color', { obligatorio, max: 40 }),
    precio: lector.monto('precio', { obligatorio }),
    descripcion: lector.texto('descripcion', { max: 2000 }),
    fichaTecnica: lector.objeto('fichaTecnica'),
  };
}

export function leerVin(lector) {
  const original = lector.texto('vin', { obligatorio: true, max: 40 });
  if (original === undefined) return undefined;
  const vin = normalizarVin(original);
  if (!esVinValido(vin)) {
    lector.problema('vin: debe tener 17 caracteres (letras y números, sin I, O ni Q)');
    return undefined;
  }
  return vin;
}

// Valida una unidad completa recibida en una lista (por ejemplo, en una recepción de mercancía).
export function validarUnidad(datos, prefijo) {
  const lector = crearLector(datos);
  const vin = leerVin(lector);
  const unidad = leerDatosUnidad(lector);
  try {
    lector.terminar();
  } catch (error) {
    error.detalles = error.detalles.map((detalle) => `${prefijo}.${detalle}`);
    throw error;
  }
  return { vin, ...unidad };
}
