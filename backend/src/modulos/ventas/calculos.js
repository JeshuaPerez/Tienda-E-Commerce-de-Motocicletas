// Cálculo de totales en GTQ (RN 6) con IVA incluido en el precio (PA-6) y descuento por cupón (RF 09).
import { TASA_IVA } from '../../config/negocio.js';
import { Decimal, formatearMonto } from '../../utils/dinero.js';

const aCentavos = (valor) => valor.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

export function calcularDescuento(cupon, subtotal) {
  if (!cupon) return new Decimal(0);
  const valor = new Decimal(cupon.valor);
  const descuento = cupon.tipo === 'PORCENTAJE' ? aCentavos(subtotal.times(valor).dividedBy(100)) : valor;
  return Decimal.min(descuento, subtotal); // el total nunca queda negativo
}

// lineas: [{ precioUnitario: Decimal, cantidad }]. Devuelve los montos como texto con 2 decimales.
export function calcularTotales(lineas, cupon = null) {
  const subtotal = lineas.reduce((suma, l) => suma.plus(new Decimal(l.precioUnitario).times(l.cantidad)), new Decimal(0));
  const descuento = calcularDescuento(cupon, subtotal);
  const total = subtotal.minus(descuento);
  // El precio ya incluye el IVA: base = total / 1.12, y el IVA es lo que falta para llegar al total.
  const baseImponible = aCentavos(total.dividedBy(new Decimal(1).plus(TASA_IVA)));
  const iva = total.minus(baseImponible);
  return {
    subtotal: formatearMonto(subtotal),
    descuento: formatearMonto(descuento),
    total: formatearMonto(total),
    baseImponible: formatearMonto(baseImponible),
    iva: formatearMonto(iva),
  };
}
