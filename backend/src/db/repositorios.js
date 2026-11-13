// Repositorios con Prisma (capa de acceso a datos). La misma interfaz se usa con el cliente normal
// o con el cliente de una transacción, así los servicios no saben cuál reciben.
import { conflicto } from '../utils/errores.js';

const CODIGO_UNICO_VIOLADO = 'P2002';

async function conUnico(operacion, mensaje) {
  try {
    return await operacion();
  } catch (error) {
    if (error?.code === CODIGO_UNICO_VIOLADO) throw conflicto(mensaje);
    throw error;
  }
}

const rango = (min, max) => (min === undefined && max === undefined ? undefined : { gte: min, lte: max });
const conModelo = { modelo: { include: { marca: true } } };
const ordenCompleta = {
  proveedor: true,
  detalles: { include: { modelo: { include: { marca: true } }, accesorio: true }, orderBy: { id: 'asc' } },
};

export function crearRepositorios(db) {
  return {
    marcas: {
      listar: () => db.marca.findMany({ orderBy: { nombre: 'asc' } }),
      buscarPorId: (id) => db.marca.findUnique({ where: { id } }),
      buscarPorNombre: (nombre) => db.marca.findFirst({ where: { nombre: { equals: nombre, mode: 'insensitive' } } }),
      crear: (datos) => conUnico(() => db.marca.create({ data: datos }), 'La marca ya existe'),
      actualizar: (id, datos) => conUnico(() => db.marca.update({ where: { id }, data: datos }), 'La marca ya existe'),
    },

    modelos: {
      listar: ({ marcaId } = {}) =>
        db.modelo.findMany({ where: { marcaId }, include: { marca: true }, orderBy: [{ marcaId: 'asc' }, { nombre: 'asc' }] }),
      buscarPorId: (id) => db.modelo.findUnique({ where: { id }, include: { marca: true } }),
      buscarPorNombre: (marcaId, nombre) =>
        db.modelo.findFirst({ where: { marcaId, nombre: { equals: nombre, mode: 'insensitive' } } }),
      crear: (datos) => conUnico(() => db.modelo.create({ data: datos }), 'El modelo ya existe en esa marca'),
      actualizar: (id, datos) =>
        conUnico(() => db.modelo.update({ where: { id }, data: datos }), 'El modelo ya existe en esa marca'),
    },

    motocicletas: {
      async listar({ filtros = {}, saltar = 0, tomar = 20 } = {}) {
        const f = filtros;
        const modelo = {};
        if (f.marcaId) modelo.marcaId = f.marcaId;
        if (rango(f.cilindradaMin, f.cilindradaMax)) modelo.cilindrada = rango(f.cilindradaMin, f.cilindradaMax);
        const where = {
          estado: f.estado,
          modeloId: f.modeloId,
          precio: rango(f.precioMin, f.precioMax),
          ...(Object.keys(modelo).length ? { modelo } : {}),
        };
        const [items, total] = await Promise.all([
          db.motocicleta.findMany({ where, include: conModelo, orderBy: { id: 'desc' }, skip: saltar, take: tomar }),
          db.motocicleta.count({ where }),
        ]);
        return { items, total };
      },
      buscarPorId: (id) => db.motocicleta.findUnique({ where: { id }, include: conModelo }),
      buscarPorVin: (vin) => db.motocicleta.findUnique({ where: { vin } }),
      // SELECT ... FOR UPDATE: dentro de una transacción, nadie más modifica esta moto hasta que termine.
      bloquear: (id) => db.$queryRaw`SELECT id FROM "motocicletas" WHERE id = ${id} FOR UPDATE`,
      crear: (datos) => conUnico(() => db.motocicleta.create({ data: datos }), `El VIN ${datos.vin} ya está registrado`),
      actualizar: (id, datos) => db.motocicleta.update({ where: { id }, data: datos }),
      async contarPorModeloYEstado() {
        const grupos = await db.motocicleta.groupBy({ by: ['modeloId', 'estado'], _count: { _all: true } });
        return grupos.map((g) => ({ modeloId: g.modeloId, estado: g.estado, cantidad: g._count._all }));
      },
    },

    accesorios: {
      listar: ({ soloActivos = false } = {}) =>
        db.accesorio.findMany({ where: soloActivos ? { activo: true } : {}, orderBy: { nombre: 'asc' } }),
      buscarPorId: (id) => db.accesorio.findUnique({ where: { id } }),
      buscarPorSku: (sku) => db.accesorio.findUnique({ where: { sku } }),
      crear: (datos) => conUnico(() => db.accesorio.create({ data: datos }), `El SKU ${datos.sku} ya existe`),
      actualizar: (id, datos) => db.accesorio.update({ where: { id }, data: datos }),
      // Suma o resta en una sola sentencia; si la resta dejaría el stock en negativo, no cambia nada.
      async ajustarStock(id, delta) {
        if (delta >= 0) {
          await db.accesorio.update({ where: { id }, data: { stock: { increment: delta } } });
          return true;
        }
        const { count } = await db.accesorio.updateMany({
          where: { id, stock: { gte: -delta } },
          data: { stock: { decrement: -delta } },
        });
        return count === 1;
      },
    },

    movimientos: {
      registrar: (datos) => db.movimientoInventario.create({ data: datos }),
      async listar({ filtros = {}, saltar = 0, tomar = 20 } = {}) {
        const f = filtros;
        const where = {
          tipo: f.tipo,
          motivo: f.motivo,
          motocicletaId: f.motocicletaId,
          accesorioId: f.accesorioId,
          fecha: rango(f.desde, f.hasta),
        };
        const [items, total] = await Promise.all([
          db.movimientoInventario.findMany({
            where,
            include: { motocicleta: { select: { vin: true } }, accesorio: { select: { sku: true } } },
            orderBy: { id: 'desc' },
            skip: saltar,
            take: tomar,
          }),
          db.movimientoInventario.count({ where }),
        ]);
        return { items, total };
      },
    },

    proveedores: {
      listar: () => db.proveedor.findMany({ orderBy: { nombre: 'asc' } }),
      buscarPorId: (id) => db.proveedor.findUnique({ where: { id } }),
      crear: (datos) => db.proveedor.create({ data: datos }),
      actualizar: (id, datos) => db.proveedor.update({ where: { id }, data: datos }),
    },

    ordenes: {
      listar: ({ estado } = {}) => db.ordenCompra.findMany({ where: { estado }, include: ordenCompleta, orderBy: { id: 'desc' } }),
      buscarPorId: (id) => db.ordenCompra.findUnique({ where: { id }, include: ordenCompleta }),
      bloquear: (id) => db.$queryRaw`SELECT id FROM "ordenes_compra" WHERE id = ${id} FOR UPDATE`,
      crear: ({ detalles, ...datos }) => db.ordenCompra.create({ data: { ...datos, detalles: { create: detalles } } }),
      actualizarEstado: (id, estado) => db.ordenCompra.update({ where: { id }, data: { estado } }),
      // Suma lo recibido solo si no supera lo pedido (la condición va en la misma sentencia UPDATE).
      async sumarRecibido(detalleId, cantidad) {
        const filas = await db.$executeRaw`
          UPDATE "ordenes_compra_detalle"
          SET "cantidad_recibida" = "cantidad_recibida" + ${cantidad}
          WHERE "id" = ${detalleId} AND "cantidad_recibida" + ${cantidad} <= "cantidad"`;
        return filas === 1;
      },
      crearRecepcion: (datos) => db.recepcion.create({ data: datos }),
    },

    // ───── Fase 3 ─────
    clientes: {
      buscarPorId: (id) => db.cliente.findUnique({ where: { id } }),
      buscarPorUsuarioId: (usuarioId) => db.cliente.findUnique({ where: { usuarioId } }),
      buscar: ({ nit, texto } = {}) =>
        db.cliente.findMany({
          where: { nit, ...(texto ? { nombre: { contains: texto, mode: 'insensitive' } } : {}) },
          orderBy: { nombre: 'asc' },
          take: 20,
        }),
      crear: (datos) => db.cliente.create({ data: datos }),
    },

    cupones: {
      listar: () => db.cupon.findMany({ orderBy: { id: 'desc' } }),
      buscarPorId: (id) => db.cupon.findUnique({ where: { id } }),
      buscarPorCodigo: (codigo) => db.cupon.findUnique({ where: { codigo } }),
      crear: (datos) => conUnico(() => db.cupon.create({ data: datos }), `El cupón ${datos.codigo} ya existe`),
      actualizar: (id, datos) => db.cupon.update({ where: { id }, data: datos }),
      // Consume un uso solo si no se alcanzó el límite (condición en la misma sentencia UPDATE).
      async registrarUso(id) {
        const filas = await db.$executeRaw`
          UPDATE "cupones" SET "usos_actuales" = "usos_actuales" + 1
          WHERE "id" = ${id} AND ("usos_maximos" IS NULL OR "usos_actuales" < "usos_maximos")`;
        return filas === 1;
      },
      liberarUso: (id) =>
        db.cupon.updateMany({ where: { id, usosActuales: { gt: 0 } }, data: { usosActuales: { decrement: 1 } } }),
    },

    ventas: {
      crear: ({ detalles, ...datos }) => db.venta.create({ data: { ...datos, detalles: { create: detalles } } }),
      buscarPorId: (id) => db.venta.findUnique({ where: { id }, include: ventaCompleta }),
      bloquear: (id) => db.$queryRaw`SELECT id FROM "ventas" WHERE id = ${id} FOR UPDATE`,
      actualizar: (id, datos) => db.venta.update({ where: { id }, data: datos }),
      async listar({ filtros = {}, saltar = 0, tomar = 20 } = {}) {
        const where = { estado: filtros.estado, canal: filtros.canal, clienteId: filtros.clienteId };
        const [items, total] = await Promise.all([
          db.venta.findMany({ where, include: ventaCompleta, orderBy: { id: 'desc' }, skip: saltar, take: tomar }),
          db.venta.count({ where }),
        ]);
        return { items, total };
      },
    },

    comprobantes: {
      crear: (datos) => db.comprobanteTransferencia.create({ data: datos }),
      buscarPorId: (id) => db.comprobanteTransferencia.findUnique({ where: { id }, include: { venta: { include: ventaCompleta } } }),
      actualizar: (id, datos) => db.comprobanteTransferencia.update({ where: { id }, data: datos }),
      listar: ({ estado } = {}) =>
        db.comprobanteTransferencia.findMany({
          where: { estado },
          include: { venta: { include: ventaCompleta } },
          orderBy: { id: 'desc' },
          take: 100,
        }),
    },

    caja: {
      buscarAbierta: () => db.sesionCaja.findFirst({ where: { estado: 'ABIERTA' } }),
      buscarPorId: (id) => db.sesionCaja.findUnique({ where: { id } }),
      bloquear: (id) => db.$queryRaw`SELECT id FROM "sesiones_caja" WHERE id = ${id} FOR UPDATE`,
      // El índice único parcial impide dos cajas abiertas aunque dos aperturas lleguen a la vez.
      crear: (datos) => conUnico(() => db.sesionCaja.create({ data: datos }), 'Ya hay una caja abierta'),
      actualizar: (id, datos) => db.sesionCaja.update({ where: { id }, data: datos }),
      listar: () => db.sesionCaja.findMany({ orderBy: { id: 'desc' }, take: 60 }),
      registrarMovimiento: (datos) => db.movimientoCaja.create({ data: datos }),
      listarMovimientos: (sesionCajaId) => db.movimientoCaja.findMany({ where: { sesionCajaId }, orderBy: { id: 'asc' } }),
      async totalesPorMedio(sesionCajaId) {
        const grupos = await db.movimientoCaja.groupBy({ by: ['tipo', 'medio'], where: { sesionCajaId }, _sum: { monto: true } });
        return grupos.map((g) => ({ tipo: g.tipo, medio: g.medio, total: (g._sum.monto ?? 0).toString() }));
      },
    },
  };
}

const ventaCompleta = {
  cliente: true,
  cupon: true,
  detalles: { orderBy: { id: 'asc' } },
  comprobantes: { orderBy: { id: 'asc' } },
};

// "datos" que reciben los servicios: repositorios de lectura y ejecutar(fn) para trabajar en una transacción.
export function crearDatos(prisma) {
  return {
    repos: crearRepositorios(prisma),
    ejecutar: (funcion) => prisma.$transaction((tx) => funcion(crearRepositorios(tx)), { timeout: 15000 }),
  };
}
