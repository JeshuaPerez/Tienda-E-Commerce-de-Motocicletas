// Piezas comunes de la venta web y del POS: lectura de artículos, preparación de líneas con bloqueo
// de filas (RN 2), cupón, venta de unidades, liberación de reservas y forma pública de la venta.
import { conflicto, datosInvalidos, noEncontrado } from '../../utils/errores.js';
import { Decimal, formatearMonto } from '../../utils/dinero.js';
import { crearLector } from '../../utils/validacion.js';
import { esNitValido, normalizarNit } from '../../utils/nit.js';
import { buscarCuponAplicable } from '../cupones/cupones.servicio.js';
import { calcularTotales } from './calculos.js';

const MAXIMO_ARTICULOS = 20;
export const METODOS_WEB = ['TRANSFERENCIA', 'POS_AL_RETIRAR'];
export const METODOS_MOSTRADOR = ['EFECTIVO', 'TARJETA', 'TRANSFERENCIA'];

// items: [{ motocicletaId }] o [{ accesorioId, cantidad }]. Valida forma y duplicados.
export function leerItems(entrada) {
  const items = entrada?.items;
  if (!Array.isArray(items) || items.length === 0) throw datosInvalidos(['items: agregue al menos un artículo']);
  if (items.length > MAXIMO_ARTICULOS) throw datosInvalidos([`items: máximo ${MAXIMO_ARTICULOS} artículos`]);

  const vistos = new Set();
  return items.map((item, i) => {
    const lector = crearLector(item);
    const motocicletaId = lector.entero('motocicletaId', { min: 1 });
    const accesorioId = lector.entero('accesorioId', { min: 1 });
    const cantidad = accesorioId ? lector.entero('cantidad', { obligatorio: true, min: 1, max: 100 }) : 1;
    if ((motocicletaId === undefined) === (accesorioId === undefined)) lector.problema('indique motocicletaId o accesorioId');
    try {
      lector.terminar();
    } catch (error) {
      error.detalles = error.detalles.map((d) => `items[${i}].${d}`);
      throw error;
    }
    const clave = motocicletaId ? `m${motocicletaId}` : `a${accesorioId}`;
    if (vistos.has(clave)) throw datosInvalidos([`items[${i}]: el artículo está repetido`]);
    vistos.add(clave);
    return motocicletaId ? { motocicletaId, cantidad: 1 } : { accesorioId, cantidad };
  });
}

// Con bloquear=true (dentro de una transacción) toma las filas de las motos con FOR UPDATE, en orden
// de id para no generar bloqueos cruzados. Así dos ventas no pueden tomar el mismo VIN (RN 2, PA-9).
export async function prepararLineas(r, items, { bloquear }) {
  const motos = items.filter((i) => i.motocicletaId).sort((a, b) => a.motocicletaId - b.motocicletaId);
  const lineas = [];

  for (const { motocicletaId } of motos) {
    if (bloquear) await r.motocicletas.bloquear(motocicletaId);
    const moto = await r.motocicletas.buscarPorId(motocicletaId);
    if (!moto) throw noEncontrado(`Motocicleta ${motocicletaId} no encontrada`);
    if (moto.estado !== 'DISPONIBLE') {
      throw conflicto(`La motocicleta con VIN ${moto.vin} no está disponible (estado ${moto.estado})`);
    }
    const nombre = `${moto.modelo.marca.nombre} ${moto.modelo.nombre} ${moto.anio} ${moto.color}`;
    lineas.push({ motocicletaId, cantidad: 1, precioUnitario: new Decimal(moto.precio), descripcion: `${nombre} — VIN ${moto.vin}` });
  }

  for (const { accesorioId, cantidad } of items.filter((i) => i.accesorioId)) {
    const accesorio = await r.accesorios.buscarPorId(accesorioId);
    if (!accesorio || !accesorio.activo) throw noEncontrado(`Accesorio ${accesorioId} no encontrado`);
    if (accesorio.stock < cantidad) throw conflicto(`Stock insuficiente de ${accesorio.sku}: hay ${accesorio.stock}`);
    lineas.push({ accesorioId, cantidad, precioUnitario: new Decimal(accesorio.precio), descripcion: `${accesorio.nombre} (${accesorio.sku})` });
  }

  return lineas.map((l) => ({ ...l, subtotal: l.precioUnitario.times(l.cantidad) }));
}

// Busca el cupón y, si se pide, consume un uso de forma atómica (el límite no se puede superar).
export async function obtenerCupon(r, codigo, canal, ahora, { consumir }) {
  if (!codigo) return null;
  const cupon = await buscarCuponAplicable(r, codigo, canal, ahora);
  if (consumir && !(await r.cupones.registrarUso(cupon.id))) throw conflicto('El cupón ya alcanzó su límite de usos');
  return cupon;
}

export const totalesDe = (lineas, cupon) => calcularTotales(lineas, cupon);

// Datos fiscales para la factura (RF 08). Sin NIT se factura a consumidor final ("CF").
export function leerFacturacion(datos, nombrePorDefecto) {
  const lector = crearLector(datos ?? {});
  const nitTexto = lector.texto('nit', { max: 20 });
  const nit = nitTexto ? normalizarNit(nitTexto) : 'CF';
  if (!esNitValido(nit)) lector.problema('facturacion.nit: NIT inválido (use solo dígitos y verificador, o CF)');
  const nombre = lector.texto('nombre', { max: 150 }) ?? nombrePorDefecto;
  const direccion = lector.texto('direccion', { max: 250 }) ?? 'Ciudad';
  lector.terminar();
  return { nitFactura: nit, nombreFactura: nombre, direccionFactura: direccion };
}

// PA-5: tarjeta (voucher) y transferencia exigen referencia; el efectivo no.
export function leerPago(datos, metodos) {
  const lector = crearLector(datos ?? {});
  const metodo = lector.opcion('metodo', metodos, { obligatorio: true });
  const referencia = lector.texto('referencia', { max: 100 });
  if ((metodo === 'TARJETA' || metodo === 'TRANSFERENCIA') && !referencia) {
    lector.problema('referencia: obligatoria para tarjeta (número de voucher) o transferencia');
  }
  lector.terminar();
  return { metodo, referencia };
}

// Pasa las motos de la venta a VENDIDA y deja su SALIDA en el inventario (RF 06).
export async function venderMotos(r, venta, motivo, usuarioId) {
  for (const linea of venta.detalles.filter((d) => d.motocicletaId)) {
    await r.motocicletas.actualizar(linea.motocicletaId, { estado: 'VENDIDA' });
    await r.movimientos.registrar({
      tipo: 'SALIDA', motivo, cantidad: 1, motocicletaId: linea.motocicletaId, referencia: `Venta #${venta.id}`, usuarioId,
    });
  }
}

// Descuenta los accesorios de la venta (si falta stock, cancela todo) y registra su SALIDA.
export async function descontarAccesorios(r, lineas, motivo, referencia, usuarioId) {
  for (const linea of lineas.filter((l) => l.accesorioId)) {
    if (!(await r.accesorios.ajustarStock(linea.accesorioId, -linea.cantidad))) {
      throw conflicto(`Stock insuficiente del accesorio ${linea.accesorioId}`);
    }
    await r.movimientos.registrar({ tipo: 'SALIDA', motivo, cantidad: linea.cantidad, accesorioId: linea.accesorioId, referencia, usuarioId });
  }
}

// PA-4: libera lo apartado por un pedido web rechazado o cancelado.
export async function liberarVenta(r, venta, usuarioId) {
  for (const linea of venta.detalles) {
    if (linea.motocicletaId) {
      await r.motocicletas.bloquear(linea.motocicletaId);
      const moto = await r.motocicletas.buscarPorId(linea.motocicletaId);
      if (moto.estado === 'RESERVADA') await r.motocicletas.actualizar(linea.motocicletaId, { estado: 'DISPONIBLE' });
    } else {
      await r.accesorios.ajustarStock(linea.accesorioId, linea.cantidad);
      await r.movimientos.registrar({
        tipo: 'ENTRADA', motivo: 'LIBERACION', cantidad: linea.cantidad, accesorioId: linea.accesorioId,
        referencia: `Venta #${venta.id} liberada`, usuarioId,
      });
    }
  }
  if (venta.cuponId) await r.cupones.liberarUso(venta.cuponId);
}

// Registra el cobro en la caja del día. Una venta de Q0.00 (cupón del 100 %) no mueve caja.
export async function registrarIngresoCaja(r, caja, venta, medio, referencia, usuarioId) {
  if (new Decimal(venta.total).isZero()) return;
  await r.caja.registrarMovimiento({
    sesionCajaId: caja.id, tipo: 'INGRESO', medio, monto: new Decimal(venta.total),
    concepto: `Cobro de venta #${venta.id} (${venta.canal})`, referencia: referencia ?? null, ventaId: venta.id, usuarioId,
  });
}

// La venta solo la ve su cliente o un administrador; a los demás se les responde 404.
export async function buscarVentaVisible(r, id, usuario) {
  const venta = await r.ventas.buscarPorId(id);
  if (!venta) throw noEncontrado('Venta no encontrada');
  if (usuario.rol !== 'ADMINISTRADOR') {
    const cliente = await r.clientes.buscarPorUsuarioId(usuario.id);
    if (!cliente || venta.clienteId !== cliente.id) throw noEncontrado('Venta no encontrada');
  }
  return venta;
}

export const ventaPublica = (v) =>
  v && {
    id: v.id,
    canal: v.canal,
    estado: v.estado,
    metodoPago: v.metodoPago,
    referenciaPago: v.referenciaPago ?? null,
    cliente: v.cliente && { id: v.cliente.id, nombre: v.cliente.nombre, nit: v.cliente.nit ?? null },
    vendedorId: v.vendedorId ?? null,
    cupon: v.cupon ? { codigo: v.cupon.codigo, tipo: v.cupon.tipo, valor: formatearMonto(v.cupon.valor) } : null,
    subtotal: formatearMonto(v.subtotal),
    descuento: formatearMonto(v.descuento),
    total: formatearMonto(v.total),
    baseImponible: formatearMonto(new Decimal(v.total).minus(v.iva)),
    iva: formatearMonto(v.iva),
    facturacion: { nit: v.nitFactura, nombre: v.nombreFactura, direccion: v.direccionFactura },
    creadaEn: v.creadaEn ?? v.creadoEn,
    pagadaEn: v.pagadaEn ?? null,
    entregadaEn: v.entregadaEn ?? null,
    detalles: (v.detalles ?? []).map((d) => ({
      id: d.id,
      motocicletaId: d.motocicletaId ?? null,
      accesorioId: d.accesorioId ?? null,
      descripcion: d.descripcion,
      cantidad: d.cantidad,
      precioUnitario: formatearMonto(d.precioUnitario),
      subtotal: formatearMonto(d.subtotal),
    })),
    comprobantes: (v.comprobantes ?? []).map((c) => ({
      id: c.id, estado: c.estado, motivoRechazo: c.motivoRechazo ?? null, subidoEn: c.subidoEn, revisadoEn: c.revisadoEn ?? null,
    })),
  };

// Datos de la venta para guardarla (montos como Decimal).
export function datosVenta(lineas, cupon, totales, extra) {
  return {
    ...extra,
    cuponId: cupon?.id ?? null,
    subtotal: new Decimal(totales.subtotal),
    descuento: new Decimal(totales.descuento),
    total: new Decimal(totales.total),
    iva: new Decimal(totales.iva),
    detalles: lineas.map((l) => ({
      motocicletaId: l.motocicletaId ?? null,
      accesorioId: l.accesorioId ?? null,
      descripcion: l.descripcion,
      cantidad: l.cantidad,
      precioUnitario: l.precioUnitario,
      subtotal: l.subtotal,
    })),
  };
}
