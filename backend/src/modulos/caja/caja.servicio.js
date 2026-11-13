// Caja diaria (RF 05): apertura, ingresos (POS y transferencias validadas), retiros y cuadre al cierre.
import { fechaGuatemala } from '../../config/negocio.js';
import { conflicto, noEncontrado } from '../../utils/errores.js';
import { Decimal, formatearMonto } from '../../utils/dinero.js';
import { crearLector } from '../../utils/validacion.js';

const cero = () => new Decimal(0);

// Suma los movimientos de una sesión por medio y calcula lo que debería haber en caja.
export async function calcularResumen(r, sesion) {
  const totales = await r.caja.totalesPorMedio(sesion.id);
  const suma = (tipo, medio) =>
    totales.filter((t) => t.tipo === tipo && t.medio === medio).reduce((s, t) => s.plus(t.total), cero());

  const ingresosEfectivo = suma('INGRESO', 'EFECTIVO');
  const retirosEfectivo = suma('RETIRO', 'EFECTIVO');
  return {
    montoInicial: formatearMonto(sesion.montoInicial),
    ingresosEfectivo: formatearMonto(ingresosEfectivo),
    retirosEfectivo: formatearMonto(retirosEfectivo),
    efectivoEsperado: formatearMonto(new Decimal(sesion.montoInicial).plus(ingresosEfectivo).minus(retirosEfectivo)),
    vouchersEsperado: formatearMonto(suma('INGRESO', 'TARJETA')),
    transferencias: formatearMonto(suma('INGRESO', 'TRANSFERENCIA')),
  };
}

// RN 5: devuelve la caja abierta del día (bloqueada) o lanza 409. La usan el POS y los cobros.
export async function exigirCajaDelDia(r, ahora) {
  const caja = await r.caja.buscarAbierta();
  if (!caja) throw conflicto('La caja del día está cerrada: ábrala antes de registrar cobros');
  await r.caja.bloquear(caja.id);
  const hoy = fechaGuatemala(ahora);
  if (caja.fechaOperacion !== hoy) {
    throw conflicto(`La caja abierta es del ${caja.fechaOperacion}; ciérrela y abra la caja de hoy (${hoy})`);
  }
  return caja;
}

const sesionPublica = (s, resumen) => ({
  id: s.id,
  estado: s.estado,
  fechaOperacion: s.fechaOperacion,
  abiertaPorId: s.abiertaPorId,
  abiertaEn: s.abiertaEn,
  cerradaPorId: s.cerradaPorId ?? null,
  cerradaEn: s.cerradaEn ?? null,
  resumen,
  cuadre:
    s.estado === 'CERRADA'
      ? {
          efectivoEsperado: formatearMonto(s.efectivoEsperado),
          efectivoContado: formatearMonto(s.efectivoContado),
          diferenciaEfectivo: formatearMonto(new Decimal(s.efectivoContado).minus(s.efectivoEsperado)),
          vouchersEsperado: formatearMonto(s.vouchersEsperado),
          vouchersContado: formatearMonto(s.vouchersContado),
          diferenciaVouchers: formatearMonto(new Decimal(s.vouchersContado).minus(s.vouchersEsperado)),
          transferencias: formatearMonto(s.transferenciasTotal),
          notas: s.notasCierre ?? null,
        }
      : null,
});

const movimientoCajaPublico = (m) => ({
  id: m.id,
  tipo: m.tipo,
  medio: m.medio,
  monto: formatearMonto(m.monto),
  concepto: m.concepto,
  referencia: m.referencia ?? null,
  ventaId: m.ventaId ?? null,
  usuarioId: m.usuarioId,
  fecha: m.fecha,
});

export function crearServicioCaja({ datos, reloj = () => new Date() }) {
  const { repos } = datos;

  return {
    async abrir(entrada, usuarioId) {
      const lector = crearLector(entrada);
      const montoInicial = lector.monto('montoInicial', { obligatorio: true, permitirCero: true });
      lector.terminar();

      return datos.ejecutar(async (r) => {
        const abierta = await r.caja.buscarAbierta();
        if (abierta) throw conflicto(`Ya hay una caja abierta (del ${abierta.fechaOperacion})`);
        const sesion = await r.caja.crear({ abiertaPorId: usuarioId, fechaOperacion: fechaGuatemala(reloj()), montoInicial });
        return sesionPublica(sesion, await calcularResumen(r, sesion));
      });
    },

    async obtenerActual() {
      const sesion = await repos.caja.buscarAbierta();
      if (!sesion) return { caja: null };
      return {
        caja: sesionPublica(sesion),
        esDelDia: sesion.fechaOperacion === fechaGuatemala(reloj()),
        resumen: await calcularResumen(repos, sesion),
        movimientos: (await repos.caja.listarMovimientos(sesion.id)).map(movimientoCajaPublico),
      };
    },

    async retirar(entrada, usuarioId) {
      const lector = crearLector(entrada);
      const monto = lector.monto('monto', { obligatorio: true });
      const concepto = lector.texto('concepto', { obligatorio: true, max: 200 });
      lector.terminar();

      return datos.ejecutar(async (r) => {
        const caja = await exigirCajaDelDia(r, reloj());
        const { efectivoEsperado } = await calcularResumen(r, caja);
        if (monto.gt(efectivoEsperado)) throw conflicto(`Solo hay Q${efectivoEsperado} en efectivo`);
        const movimiento = await r.caja.registrarMovimiento({
          sesionCajaId: caja.id, tipo: 'RETIRO', medio: 'EFECTIVO', monto, concepto, usuarioId,
        });
        return { movimiento: movimientoCajaPublico(movimiento), resumen: await calcularResumen(r, caja) };
      });
    },

    // El cierre se permite aunque la caja sea de un día anterior (así se corrige un olvido).
    async cerrar(entrada, usuarioId) {
      const lector = crearLector(entrada);
      const efectivoContado = lector.monto('efectivoContado', { obligatorio: true, permitirCero: true });
      const vouchersContado = lector.monto('vouchersContado', { obligatorio: true, permitirCero: true });
      const notasCierre = lector.texto('notas', { max: 500 });
      lector.terminar();

      return datos.ejecutar(async (r) => {
        const caja = await r.caja.buscarAbierta();
        if (!caja) throw conflicto('No hay una caja abierta');
        await r.caja.bloquear(caja.id);
        const resumen = await calcularResumen(r, caja);
        const cerrada = await r.caja.actualizar(caja.id, {
          estado: 'CERRADA',
          cerradaPorId: usuarioId,
          cerradaEn: reloj(),
          efectivoEsperado: new Decimal(resumen.efectivoEsperado),
          efectivoContado,
          vouchersEsperado: new Decimal(resumen.vouchersEsperado),
          vouchersContado,
          transferenciasTotal: new Decimal(resumen.transferencias),
          notasCierre,
        });
        return sesionPublica(cerrada, resumen);
      });
    },

    listarSesiones: async () => (await repos.caja.listar()).map((s) => sesionPublica(s)),

    async obtenerCuadre(id) {
      const sesion = await repos.caja.buscarPorId(id);
      if (!sesion) throw noEncontrado('Sesión de caja no encontrada');
      return {
        ...sesionPublica(sesion, await calcularResumen(repos, sesion)),
        movimientos: (await repos.caja.listarMovimientos(id)).map(movimientoCajaPublico),
      };
    },
  };
}
