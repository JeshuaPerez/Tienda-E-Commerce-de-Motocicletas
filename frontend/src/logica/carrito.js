// Lógica del carrito (PA-10): funciones puras que devuelven un carrito nuevo, sin tocar el anterior.
// El servidor vuelve a validar precios, disponibilidad y stock al cotizar y al pagar.
import { aCentavos, desdeCentavos } from './formato.js';

export const carritoVacio = () => ({ motos: [], accesorios: [] });

export function agregarMoto(carrito, moto) {
  if (carrito.motos.some((m) => m.id === moto.id)) return carrito;
  const { id, vin, titulo, precio } = moto;
  return { ...carrito, motos: [...carrito.motos, { id, vin, titulo, precio }] };
}

export function agregarAccesorio(carrito, accesorio, cantidad = 1) {
  const existente = carrito.accesorios.find((a) => a.id === accesorio.id);
  const maximo = accesorio.stock ?? existente?.stock ?? Infinity;
  const nueva = Math.min((existente?.cantidad ?? 0) + cantidad, maximo);
  if (nueva <= 0) return carrito;
  const { id, sku, nombre, precio, stock } = accesorio;
  const linea = { id, sku, nombre, precio, stock, cantidad: nueva };
  return {
    ...carrito,
    accesorios: existente ? carrito.accesorios.map((a) => (a.id === id ? linea : a)) : [...carrito.accesorios, linea],
  };
}

export function cambiarCantidad(carrito, accesorioId, cantidad) {
  if (cantidad <= 0) return quitarAccesorio(carrito, accesorioId);
  return {
    ...carrito,
    accesorios: carrito.accesorios.map((a) => (a.id === accesorioId ? { ...a, cantidad: Math.min(cantidad, a.stock ?? cantidad) } : a)),
  };
}

export const quitarMoto = (carrito, id) => ({ ...carrito, motos: carrito.motos.filter((m) => m.id !== id) });
export const quitarAccesorio = (carrito, id) => ({ ...carrito, accesorios: carrito.accesorios.filter((a) => a.id !== id) });

export const contarArticulos = (carrito) => carrito.motos.length + carrito.accesorios.reduce((s, a) => s + a.cantidad, 0);

// Solo es una estimación para mostrar; el total oficial lo calcula el servidor (cupón e IVA incluidos).
export function subtotalEstimado(carrito) {
  const centavos =
    carrito.motos.reduce((s, m) => s + (aCentavos(m.precio) ?? 0), 0) +
    carrito.accesorios.reduce((s, a) => s + (aCentavos(a.precio) ?? 0) * a.cantidad, 0);
  return desdeCentavos(centavos);
}

// Forma que espera la API: [{ motocicletaId }, { accesorioId, cantidad }].
export const aItems = (carrito) => [
  ...carrito.motos.map((m) => ({ motocicletaId: m.id })),
  ...carrito.accesorios.map((a) => ({ accesorioId: a.id, cantidad: a.cantidad })),
];

// Lee lo guardado en localStorage. Si está dañado o tiene otra forma, empieza con un carrito vacío.
export function leerCarrito(texto) {
  try {
    const datos = JSON.parse(texto);
    const esEntero = (n) => Number.isInteger(n) && n > 0;
    const motosValidas = Array.isArray(datos?.motos) && datos.motos.every((m) => esEntero(m?.id) && typeof m.precio === 'string');
    const accesoriosValidos =
      Array.isArray(datos?.accesorios) &&
      datos.accesorios.every((a) => esEntero(a?.id) && esEntero(a.cantidad) && typeof a.precio === 'string');
    return motosValidas && accesoriosValidos ? { motos: datos.motos, accesorios: datos.accesorios } : carritoVacio();
  } catch {
    return carritoVacio();
  }
}
