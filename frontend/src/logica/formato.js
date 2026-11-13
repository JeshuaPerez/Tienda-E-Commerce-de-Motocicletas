// Formato para pantalla. Los montos llegan de la API como texto ("25999.90") y se tratan como
// centavos enteros, nunca como número de punto flotante (RN 6).
const FORMATO_MONTO = /^(-)?(\d+)(?:\.(\d{1,2}))?$/;

export function aCentavos(monto) {
  const m = FORMATO_MONTO.exec(String(monto ?? '').trim());
  if (!m) return null;
  const centavos = Number(m[2]) * 100 + Number((m[3] ?? '').padEnd(2, '0'));
  return m[1] ? -centavos : centavos;
}

export function desdeCentavos(centavos) {
  const signo = centavos < 0 ? '-' : '';
  const absoluto = Math.abs(centavos);
  return `${signo}${Math.floor(absoluto / 100)}.${String(absoluto % 100).padStart(2, '0')}`;
}

export function formatearQuetzales(monto) {
  const centavos = aCentavos(monto);
  if (centavos === null) return '—';
  const [enteros, decimales] = desdeCentavos(Math.abs(centavos)).split('.');
  const conMiles = enteros.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${centavos < 0 ? '-' : ''}Q ${conMiles}.${decimales}`;
}

const fechaHora = new Intl.DateTimeFormat('es-GT', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Guatemala' });
export const formatearFecha = (valor) => (valor ? fechaHora.format(new Date(valor)) : '—');

const ESTADOS_VENTA = {
  PENDIENTE_PAGO: { texto: 'Pendiente de pago', tono: 'ambar' },
  PENDIENTE_VALIDACION: { texto: 'Transferencia en revisión', tono: 'azul' },
  PAGADA: { texto: 'Pagada', tono: 'verde' },
  ENTREGADA: { texto: 'Entregada', tono: 'verde' },
  RECHAZADA: { texto: 'Transferencia rechazada', tono: 'rojo' },
  CANCELADA: { texto: 'Cancelada', tono: 'gris' },
};
export const etiquetaEstadoVenta = (estado) => ESTADOS_VENTA[estado] ?? { texto: estado, tono: 'gris' };

const ESTADOS_FACTURA = { EMITIDA: { texto: 'Emitida', tono: 'verde' }, ANULADA: { texto: 'Anulada', tono: 'rojo' } };
export const etiquetaEstadoFactura = (estado) => ESTADOS_FACTURA[estado] ?? { texto: estado, tono: 'gris' };

export const METODOS_PAGO = {
  TRANSFERENCIA: 'Transferencia bancaria',
  POS_AL_RETIRAR: 'Pago con POS al retirar',
  EFECTIVO: 'Efectivo',
  TARJETA: 'Tarjeta',
};
