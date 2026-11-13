// Funciones puras del panel de administración.
import { aCentavos, desdeCentavos } from './formato.js';

// VIN según ISO 3779: 17 caracteres, sin I, O ni Q (el servidor vuelve a validarlo, RN 1).
const FORMATO_VIN = /^[A-HJ-NPR-Z0-9]{17}$/;

// Lee los VIN pegados en la recepción de mercancía: uno por línea, o separados por comas o espacios.
export function leerVins(texto) {
  const vins = [];
  const invalidos = [];
  const repetidos = [];
  for (const crudo of String(texto ?? '').split(/[\s,;]+/)) {
    const vin = crudo.trim().toUpperCase();
    if (!vin) continue;
    if (!FORMATO_VIN.test(vin)) invalidos.push(vin);
    else if (vins.includes(vin)) repetidos.push(vin);
    else vins.push(vin);
  }
  return { vins, invalidos, repetidos };
}

// Total estimado de una orden de compra (PA-11, GTQ) con centavos enteros.
export function totalOrden(lineas) {
  const centavos = lineas.reduce((suma, l) => {
    const cantidad = Number(l.cantidad);
    const costo = aCentavos(l.costoUnitario);
    return Number.isInteger(cantidad) && cantidad > 0 && costo !== null ? suma + cantidad * costo : suma;
  }, 0);
  return desdeCentavos(centavos);
}

// Ancho (0 a 100) de una barra de reporte. Un valor positivo nunca se dibuja con menos de 2 %.
export function anchoBarra(valor, maximo) {
  const v = aCentavos(valor) ?? 0;
  const m = aCentavos(maximo) ?? 0;
  if (v <= 0 || m <= 0) return 0;
  return Math.max(2, Math.round((v / m) * 100));
}

const formatoDia = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guatemala', year: 'numeric', month: '2-digit', day: '2-digit' });
export const fechaGuatemala = (instante = new Date()) => formatoDia.format(instante);

export function rangoMes(instante = new Date()) {
  const [anio, mes] = fechaGuatemala(instante).split('-').map(Number);
  const ultimo = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  const mm = String(mes).padStart(2, '0');
  return { desde: `${anio}-${mm}-01`, hasta: `${anio}-${mm}-${String(ultimo).padStart(2, '0')}` };
}
