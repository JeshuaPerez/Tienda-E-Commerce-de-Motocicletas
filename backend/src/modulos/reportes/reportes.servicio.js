// Reportes (RF 10): ventas por período, más vendidas, flujo de caja y rendimiento financiero (margen bruto).
// Los períodos son días calendario de Guatemala y los montos se suman con Decimal (RN 6).
import { fechaGuatemala, finDelDia, inicioDelDia } from '../../config/negocio.js';
import { datosInvalidos } from '../../utils/errores.js';
import { Decimal, formatearMonto } from '../../utils/dinero.js';
import { crearLector } from '../../utils/validacion.js';

const FORMATO_DIA = /^\d{4}-\d{2}-\d{2}$/;
const MAXIMO_DIAS = 366;
const UN_DIA = 24 * 60 * 60 * 1000;
const D = (v) => new Decimal(v ?? 0);
const sumar = (lista, valor) => lista.reduce((s, x) => s.plus(valor(x)), D(0));
const diaUtc = (dia) => Date.parse(`${dia}T00:00:00Z`);

// ?desde=AAAA-MM-DD&hasta=AAAA-MM-DD. Sin fechas, el mes en curso de Guatemala.
function leerRango(consulta, ahora, { conAgrupacion = false } = {}) {
  const lector = crearLector(consulta);
  const desdeTexto = lector.texto('desde', { max: 10 });
  const hastaTexto = lector.texto('hasta', { max: 10 });
  const agrupar = conAgrupacion ? (lector.opcion('agrupar', ['dia', 'mes']) ?? 'dia') : undefined;
  lector.terminar();

  const hoy = fechaGuatemala(ahora);
  const [anio, mes] = hoy.split('-').map(Number);
  const ultimoDia = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  const desde = desdeTexto ?? `${hoy.slice(0, 7)}-01`;
  const hasta = hastaTexto ?? `${hoy.slice(0, 7)}-${String(ultimoDia).padStart(2, '0')}`;

  for (const [campo, valor] of [['desde', desde], ['hasta', hasta]]) {
    if (!FORMATO_DIA.test(valor) || Number.isNaN(diaUtc(valor))) throw datosInvalidos([`${campo}: use el formato AAAA-MM-DD`]);
  }
  if (desde > hasta) throw datosInvalidos(['hasta: debe ser igual o posterior a desde']);
  if ((diaUtc(hasta) - diaUtc(desde)) / UN_DIA + 1 > MAXIMO_DIAS) {
    throw datosInvalidos([`el rango no puede superar ${MAXIMO_DIAS} días`]);
  }
  return { desde, hasta, agrupar, inicio: inicioDelDia(desde), fin: finDelDia(hasta) };
}

const totalesVentas = (ventas) => ({
  cantidadVentas: ventas.length,
  subtotal: formatearMonto(sumar(ventas, (v) => v.subtotal)),
  descuento: formatearMonto(sumar(ventas, (v) => v.descuento)),
  total: formatearMonto(sumar(ventas, (v) => v.total)),
  baseImponible: formatearMonto(sumar(ventas, (v) => D(v.total).minus(v.iva))),
  iva: formatearMonto(sumar(ventas, (v) => v.iva)),
});

function agruparPor(lista, clave) {
  const grupos = new Map();
  for (const item of lista) {
    const k = clave(item);
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k).push(item);
  }
  return [...grupos].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}

export function crearServicioReportes({ datos, reloj = () => new Date() }) {
  const { repos } = datos;
  const cobradas = (rango) => repos.ventas.listarCobradas({ desde: rango.inicio, hasta: rango.fin });

  return {
    // Ventas cobradas (PAGADA o ENTREGADA) según la fecha de pago. Los pedidos pendientes no cuentan.
    async ventas(consulta = {}) {
      const rango = leerRango(consulta, reloj(), { conAgrupacion: true });
      const lista = await cobradas(rango);
      const periodo = (v) => {
        const dia = fechaGuatemala(new Date(v.pagadaEn));
        return rango.agrupar === 'mes' ? dia.slice(0, 7) : dia;
      };
      return {
        desde: rango.desde,
        hasta: rango.hasta,
        agrupar: rango.agrupar,
        resumen: totalesVentas(lista),
        periodos: agruparPor(lista, periodo).map(([p, vs]) => ({ periodo: p, ...totalesVentas(vs) })),
        porCanal: agruparPor(lista, (v) => v.canal).map(([canal, vs]) => ({ canal, cantidadVentas: vs.length, total: formatearMonto(sumar(vs, (v) => v.total)) })),
        porMetodo: agruparPor(lista, (v) => v.metodoPago).map(([metodo, vs]) => ({ metodo, cantidadVentas: vs.length, total: formatearMonto(sumar(vs, (v) => v.total)) })),
      };
    },

    async masVendidas(consulta = {}) {
      const lector = crearLector(consulta);
      const limite = lector.entero('limite', { min: 1, max: 50 }) ?? 10;
      lector.terminar();
      const rango = leerRango(consulta, reloj());
      const lineas = (await cobradas(rango)).flatMap((v) => v.detalles);
      const ordenar = (a, b) => b.unidades - a.unidades || D(b.ingresos).comparedTo(a.ingresos);

      const modelos = agruparPor(lineas.filter((l) => l.motocicletaId), (l) => l.motocicleta.modeloId).map(([modeloId, ls]) => ({
        modeloId,
        modelo: `${ls[0].motocicleta.modelo.marca.nombre} ${ls[0].motocicleta.modelo.nombre}`,
        cilindrada: ls[0].motocicleta.modelo.cilindrada,
        unidades: ls.length,
        ingresos: formatearMonto(sumar(ls, (l) => l.subtotal)),
      }));
      const accesorios = agruparPor(lineas.filter((l) => l.accesorioId), (l) => l.accesorioId).map(([accesorioId, ls]) => ({
        accesorioId,
        sku: ls[0].accesorio.sku,
        nombre: ls[0].accesorio.nombre,
        unidades: ls.reduce((s, l) => s + l.cantidad, 0),
        ingresos: formatearMonto(sumar(ls, (l) => l.subtotal)),
      }));
      return { desde: rango.desde, hasta: rango.hasta, modelos: modelos.sort(ordenar).slice(0, limite), accesorios: accesorios.sort(ordenar).slice(0, limite) };
    },

    // Flujo de caja por día de operación: ingresos por medio, retiros, neto y diferencia del cuadre.
    async flujoCaja(consulta = {}) {
      const rango = leerRango(consulta, reloj());
      const sesiones = await repos.caja.listarSesionesEntre(rango.desde, rango.hasta);
      const suma = (movs, tipo, medio) =>
        sumar(movs.filter((m) => m.tipo === tipo && (!medio || m.medio === medio)), (m) => m.monto);

      const dias = agruparPor(sesiones, (s) => s.fechaOperacion).map(([fecha, ss]) => {
        const movs = ss.flatMap((s) => s.movimientos);
        const cerradas = ss.filter((s) => s.estado === 'CERRADA');
        const ingresos = suma(movs, 'INGRESO');
        const retiros = suma(movs, 'RETIRO');
        return {
          fecha,
          sesiones: ss.length,
          estado: cerradas.length === ss.length ? 'CERRADA' : 'ABIERTA',
          montoInicial: formatearMonto(sumar(ss, (s) => s.montoInicial)),
          ingresosEfectivo: formatearMonto(suma(movs, 'INGRESO', 'EFECTIVO')),
          ingresosTarjeta: formatearMonto(suma(movs, 'INGRESO', 'TARJETA')),
          ingresosTransferencia: formatearMonto(suma(movs, 'INGRESO', 'TRANSFERENCIA')),
          retiros: formatearMonto(retiros),
          neto: formatearMonto(ingresos.minus(retiros)),
          diferenciaEfectivo: cerradas.length
            ? formatearMonto(sumar(cerradas, (s) => D(s.efectivoContado).minus(s.efectivoEsperado)))
            : null,
        };
      });
      const total = (campo) => formatearMonto(sumar(dias, (d) => d[campo]));
      return {
        desde: rango.desde,
        hasta: rango.hasta,
        dias,
        totales: {
          ingresosEfectivo: total('ingresosEfectivo'),
          ingresosTarjeta: total('ingresosTarjeta'),
          ingresosTransferencia: total('ingresosTransferencia'),
          retiros: total('retiros'),
          neto: total('neto'),
        },
      };
    },

    // Margen bruto: ingresos sin IVA − costo de adquisición de las motos vendidas. No incluye gastos operativos.
    async rendimiento(consulta = {}) {
      const rango = leerRango(consulta, reloj());
      const lista = await cobradas(rango);
      const motos = lista.flatMap((v) => v.detalles).filter((l) => l.motocicletaId).map((l) => l.motocicleta);
      const sinCosto = motos.filter((m) => m.costoAdquisicion === null || m.costoAdquisicion === undefined).length;

      const ingresosSinIva = sumar(lista, (v) => D(v.total).minus(v.iva));
      const costo = sumar(motos, (m) => m.costoAdquisicion ?? 0);
      const margen = ingresosSinIva.minus(costo);
      return {
        desde: rango.desde,
        hasta: rango.hasta,
        ventas: lista.length,
        motocicletasVendidas: motos.length,
        ingresosConIva: formatearMonto(sumar(lista, (v) => v.total)),
        iva: formatearMonto(sumar(lista, (v) => v.iva)),
        ingresosSinIva: formatearMonto(ingresosSinIva),
        costoMotocicletas: formatearMonto(costo),
        margenBruto: formatearMonto(margen),
        margenPorcentaje: ingresosSinIva.isZero() ? null : margen.dividedBy(ingresosSinIva).times(100).toFixed(2),
        motocicletasSinCosto: sinCosto,
        nota:
          'Margen bruto sin gastos operativos. Los accesorios no guardan costo unitario, así que cuentan solo como ingreso. ' +
          `${sinCosto} motocicleta(s) vendida(s) sin costo de adquisición registrado se tomaron con costo 0.`,
      };
    },
  };
}
