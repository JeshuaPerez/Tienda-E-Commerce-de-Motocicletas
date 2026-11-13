// Tienda web (RF 03): cotización, checkout con sesión (RN 3), comprobantes de transferencia (PA-8),
// validación del administrador antes de despachar (RN 4), cobro al retirar, cancelación e historial.
import { COMPROBANTES } from '../../config/negocio.js';
import { conflicto, datosInvalidos, noEncontrado } from '../../utils/errores.js';
import { detectarTipoArchivo } from '../../utils/archivos.js';
import { crearLector, leerPaginacion, sinIndefinidos } from '../../utils/validacion.js';
import { exigirCajaDelDia } from '../caja/caja.servicio.js';
import {
  METODOS_MOSTRADOR, METODOS_WEB, buscarVentaVisible, datosVenta, descontarAccesorios, leerFacturacion, leerItems,
  leerPago, liberarVenta, obtenerCupon, prepararLineas, registrarIngresoCaja, totalesDe, venderMotos, ventaPublica,
} from './ventas.nucleo.js';

const ESTADOS_VENTA = ['PENDIENTE_PAGO', 'PENDIENTE_VALIDACION', 'PAGADA', 'ENTREGADA', 'RECHAZADA', 'CANCELADA'];
const ESTADOS_COMPROBANTE = ['PENDIENTE', 'APROBADO', 'RECHAZADO'];

const comprobantePublico = (c) => ({
  id: c.id,
  ventaId: c.ventaId,
  estado: c.estado,
  tipoArchivo: c.tipoArchivo,
  tamano: c.tamano,
  motivoRechazo: c.motivoRechazo ?? null,
  revisadoPorId: c.revisadoPorId ?? null,
  subidoEn: c.subidoEn,
  revisadoEn: c.revisadoEn ?? null,
  venta: c.venta ? { id: c.venta.id, total: ventaPublica(c.venta).total, cliente: ventaPublica(c.venta).cliente } : undefined,
});

export function crearServicioVentas({ datos, almacen, reloj = () => new Date() }) {
  const { repos } = datos;

  // Comprobante pendiente → la venta debe estar en validación. Devuelve ambos, con la venta bloqueada.
  async function comprobanteEnRevision(r, id) {
    const comprobante = await r.comprobantes.buscarPorId(id);
    if (!comprobante) throw noEncontrado('Comprobante no encontrado');
    if (comprobante.estado !== 'PENDIENTE') throw conflicto(`El comprobante ya fue ${comprobante.estado.toLowerCase()}`);
    await r.ventas.bloquear(comprobante.ventaId);
    const venta = await r.ventas.buscarPorId(comprobante.ventaId);
    if (venta.estado !== 'PENDIENTE_VALIDACION') throw conflicto(`La venta está ${venta.estado}`);
    return { comprobante, venta };
  }

  async function listar(filtros, consulta) {
    const { pagina, porPagina, saltar, tomar } = leerPaginacion(consulta);
    const { items, total } = await repos.ventas.listar({ filtros, saltar, tomar });
    return { ventas: items.map(ventaPublica), total, pagina, porPagina };
  }

  return {
    // Totales sin reservar nada; no exige sesión (el carrito vive en el navegador, PA-10).
    async cotizar(entrada) {
      const items = leerItems(entrada);
      const lineas = await prepararLineas(repos, items, { bloquear: false });
      const cupon = await obtenerCupon(repos, entrada?.cuponCodigo, 'WEB', reloj(), { consumir: false });
      return {
        lineas: lineas.map((l) => ({ ...l, precioUnitario: l.precioUnitario.toFixed(2), subtotal: l.subtotal.toFixed(2) })),
        ...totalesDe(lineas, cupon),
        cupon: cupon && { codigo: cupon.codigo, tipo: cupon.tipo },
      };
    },

    // RN 3: la ruta exige sesión de cliente. Reserva las motos y aparta los accesorios (PA-4).
    async checkout(entrada, usuarioId) {
      const lector = crearLector(entrada);
      const metodoPago = lector.opcion('metodoPago', METODOS_WEB, { obligatorio: true });
      const cuponCodigo = lector.texto('cuponCodigo', { max: 40 });
      lector.objeto('facturacion');
      lector.terminar();
      const items = leerItems(entrada);

      return datos.ejecutar(async (r) => {
        const cliente = await r.clientes.buscarPorUsuarioId(usuarioId);
        if (!cliente) throw conflicto('Solo una cuenta de cliente puede comprar en la tienda');
        const facturacion = leerFacturacion(entrada.facturacion, cliente.nombre);
        const lineas = await prepararLineas(r, items, { bloquear: true });
        const cupon = await obtenerCupon(r, cuponCodigo, 'WEB', reloj(), { consumir: true });
        const totales = totalesDe(lineas, cupon);

        const venta = await r.ventas.crear(
          datosVenta(lineas, cupon, totales, { canal: 'WEB', estado: 'PENDIENTE_PAGO', metodoPago, clienteId: cliente.id, ...facturacion }),
        );
        for (const linea of lineas.filter((l) => l.motocicletaId)) {
          await r.motocicletas.actualizar(linea.motocicletaId, { estado: 'RESERVADA' });
        }
        await descontarAccesorios(r, lineas, 'VENTA_WEB', `Pedido web #${venta.id}`, usuarioId);
        return ventaPublica(await r.ventas.buscarPorId(venta.id));
      });
    },

    // PA-8: solo JPG, PNG o PDF (por su firma real) y hasta 5 MB.
    async subirComprobante(ventaId, archivo, usuario) {
      const tipo = detectarTipoArchivo(archivo?.contenido);
      if (!tipo) throw datosInvalidos(['comprobante: solo se aceptan archivos JPG, PNG o PDF']);
      if (archivo.contenido.length > COMPROBANTES.tamanoMaximo) {
        throw datosInvalidos(['comprobante: el archivo supera 5 MB']);
      }

      const revisar = (venta) => {
        if (venta.metodoPago !== 'TRANSFERENCIA') throw conflicto('Este pedido no se paga por transferencia');
        if (!['PENDIENTE_PAGO', 'PENDIENTE_VALIDACION'].includes(venta.estado)) throw conflicto(`El pedido está ${venta.estado}`);
        if (venta.comprobantes.some((c) => c.estado === 'PENDIENTE')) throw conflicto('Ya hay un comprobante en revisión');
      };
      revisar(await buscarVentaVisible(repos, ventaId, usuario));

      const nombre = await almacen.guardar(archivo.contenido, tipo.extension);
      try {
        return await datos.ejecutar(async (r) => {
          await r.ventas.bloquear(ventaId);
          revisar(await buscarVentaVisible(r, ventaId, usuario));
          await r.comprobantes.crear({ ventaId, rutaArchivo: nombre, tipoArchivo: tipo.tipo, tamano: archivo.contenido.length });
          await r.ventas.actualizar(ventaId, { estado: 'PENDIENTE_VALIDACION' });
          return ventaPublica(await r.ventas.buscarPorId(ventaId));
        });
      } catch (error) {
        await almacen.eliminar(nombre); // no deja archivos huérfanos si la base rechaza el registro
        throw error;
      }
    },

    // RF 05: la transferencia validada entra como ingreso a la caja del día.
    aprobarComprobante: (id, adminId) =>
      datos.ejecutar(async (r) => {
        const { comprobante, venta } = await comprobanteEnRevision(r, id);
        const caja = await exigirCajaDelDia(r, reloj());
        await r.comprobantes.actualizar(id, { estado: 'APROBADO', revisadoPorId: adminId, revisadoEn: reloj() });
        await venderMotos(r, venta, 'VENTA_WEB', adminId);
        await r.ventas.actualizar(venta.id, { estado: 'PAGADA', pagadaEn: reloj(), sesionCajaId: caja.id });
        await registrarIngresoCaja(r, caja, venta, 'TRANSFERENCIA', `Comprobante #${comprobante.id}`, adminId);
        return ventaPublica(await r.ventas.buscarPorId(venta.id));
      }),

    async rechazarComprobante(id, entrada, adminId) {
      const lector = crearLector(entrada);
      const motivo = lector.texto('motivo', { obligatorio: true, max: 300 });
      lector.terminar();
      return datos.ejecutar(async (r) => {
        const { venta } = await comprobanteEnRevision(r, id);
        await r.comprobantes.actualizar(id, { estado: 'RECHAZADO', motivoRechazo: motivo, revisadoPorId: adminId, revisadoEn: reloj() });
        await liberarVenta(r, venta, adminId);
        await r.ventas.actualizar(venta.id, { estado: 'RECHAZADA' });
        return ventaPublica(await r.ventas.buscarPorId(venta.id));
      });
    },

    // Pedido web "POS al retirar": se cobra en mostrador con la caja del día abierta (RN 5).
    async cobrarEnTienda(ventaId, entrada, adminId) {
      const pago = leerPago(entrada, METODOS_MOSTRADOR);
      return datos.ejecutar(async (r) => {
        await r.ventas.bloquear(ventaId);
        const venta = await r.ventas.buscarPorId(ventaId);
        if (!venta) throw noEncontrado('Venta no encontrada');
        if (venta.metodoPago !== 'POS_AL_RETIRAR') throw conflicto('Este pedido no se paga al retirar');
        if (venta.estado !== 'PENDIENTE_PAGO') throw conflicto(`El pedido está ${venta.estado}`);
        const caja = await exigirCajaDelDia(r, reloj());
        await venderMotos(r, venta, 'VENTA_WEB', adminId);
        await r.ventas.actualizar(ventaId, {
          estado: 'PAGADA', pagadaEn: reloj(), vendedorId: adminId, sesionCajaId: caja.id, referenciaPago: pago.referencia ?? null,
        });
        await registrarIngresoCaja(r, caja, venta, pago.metodo, pago.referencia, adminId);
        return ventaPublica(await r.ventas.buscarPorId(ventaId));
      });
    },

    // RN 4: no se despacha ninguna unidad sin pago validado.
    entregar: (ventaId) =>
      datos.ejecutar(async (r) => {
        await r.ventas.bloquear(ventaId);
        const venta = await r.ventas.buscarPorId(ventaId);
        if (!venta) throw noEncontrado('Venta no encontrada');
        if (venta.estado !== 'PAGADA') throw conflicto(`No se puede despachar: la venta está ${venta.estado} y el pago no está validado`);
        await r.ventas.actualizar(ventaId, { estado: 'ENTREGADA', entregadaEn: reloj() });
        return ventaPublica(await r.ventas.buscarPorId(ventaId));
      }),

    // El cliente cancela mientras no haya pagado; el administrador también si el comprobante está en revisión.
    cancelar: (ventaId, usuario) =>
      datos.ejecutar(async (r) => {
        await r.ventas.bloquear(ventaId);
        const venta = await buscarVentaVisible(r, ventaId, usuario);
        const permitidos = usuario.rol === 'ADMINISTRADOR' ? ['PENDIENTE_PAGO', 'PENDIENTE_VALIDACION'] : ['PENDIENTE_PAGO'];
        if (!permitidos.includes(venta.estado)) throw conflicto(`No se puede cancelar una venta ${venta.estado}`);
        for (const c of venta.comprobantes.filter((x) => x.estado === 'PENDIENTE')) {
          await r.comprobantes.actualizar(c.id, { estado: 'RECHAZADO', motivoRechazo: 'Pedido cancelado', revisadoPorId: usuario.id, revisadoEn: reloj() });
        }
        await liberarVenta(r, venta, usuario.id);
        await r.ventas.actualizar(ventaId, { estado: 'CANCELADA' });
        return ventaPublica(await r.ventas.buscarPorId(ventaId));
      }),

    async listarVentas(consulta = {}) {
      const lector = crearLector(consulta);
      const filtros = sinIndefinidos({
        estado: lector.opcion('estado', ESTADOS_VENTA),
        canal: lector.opcion('canal', ['WEB', 'POS']),
      });
      lector.terminar();
      return listar(filtros, consulta);
    },

    async misCompras(usuarioId, consulta = {}) {
      const cliente = await repos.clientes.buscarPorUsuarioId(usuarioId);
      if (!cliente) return { ventas: [], total: 0, pagina: 1, porPagina: 20 };
      return listar({ clienteId: cliente.id }, consulta);
    },

    obtenerVenta: async (id, usuario) => ventaPublica(await buscarVentaVisible(repos, id, usuario)),

    async listarComprobantes(consulta = {}) {
      const lector = crearLector(consulta);
      const estado = lector.opcion('estado', ESTADOS_COMPROBANTE);
      lector.terminar();
      return (await repos.comprobantes.listar({ estado })).map(comprobantePublico);
    },

    async leerArchivoComprobante(id, usuario) {
      const comprobante = await repos.comprobantes.buscarPorId(id);
      if (!comprobante) throw noEncontrado('Comprobante no encontrado');
      await buscarVentaVisible(repos, comprobante.ventaId, usuario);
      const contenido = await almacen.leer(comprobante.rutaArchivo);
      if (!contenido) throw noEncontrado('El archivo del comprobante no está disponible');
      return { contenido, tipo: comprobante.tipoArchivo };
    },
  };
}
