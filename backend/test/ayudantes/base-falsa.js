// Base de datos en memoria con la misma interfaz que src/db/repositorios.js.
// ejecutar() simula una transacción: si la función falla, se restaura el estado anterior.
// Los montos se guardan como texto, igual que los serializa Prisma.Decimal.
import { Prisma } from '@prisma/client';
import { conflicto } from '../../src/utils/errores.js';

const D = (valor) => new Prisma.Decimal(valor);
const iguales = (a, b) => a.toLowerCase() === b.toLowerCase();

export function crearBaseFalsa() {
  let tablas = {
    marcas: [], modelos: [], motocicletas: [], accesorios: [], movimientos: [],
    proveedores: [], ordenes: [], detalles: [], recepciones: [],
    clientes: [], cupones: [], ventas: [], ventasDetalle: [], comprobantes: [], cajas: [], movimientosCaja: [],
  };
  const contadores = {};
  const nuevoId = (tabla) => (contadores[tabla] = (contadores[tabla] ?? 0) + 1);
  // Los Decimal se guardan como texto (así structuredClone puede copiar las tablas).
  const aFila = (datos) =>
    Object.fromEntries(
      Object.entries(datos).map(([clave, valor]) => [clave, Prisma.Decimal.isDecimal(valor) ? valor.toString() : valor]),
    );
  const insertar = (tabla, datos) => {
    const fila = { id: nuevoId(tabla), creadoEn: new Date(), ...aFila(datos) };
    tablas[tabla].push(fila);
    return { ...fila };
  };
  const porId = (tabla, id) => tablas[tabla].find((f) => f.id === id) ?? null;
  const actualizar = (tabla, id, datos) => {
    const fila = porId(tabla, id);
    Object.assign(fila, aFila(datos), { actualizadoEn: new Date() });
    return { ...fila };
  };
  const paginar = (filas, saltar, tomar) => ({ items: filas.slice(saltar, saltar + tomar), total: filas.length });

  const modeloCompleto = (m) => m && { ...m, marca: porId('marcas', m.marcaId) };
  const motoCompleta = (m) => m && { ...m, modelo: modeloCompleto(porId('modelos', m.modeloId)) };
  const ordenCompleta = (o) =>
    o && {
      ...o,
      proveedor: porId('proveedores', o.proveedorId),
      detalles: tablas.detalles
        .filter((d) => d.ordenCompraId === o.id)
        .map((d) => ({
          ...d,
          modelo: modeloCompleto(porId('modelos', d.modeloId)),
          accesorio: porId('accesorios', d.accesorioId),
        })),
    };

  const ventaCompleta = (v) =>
    v && {
      ...v,
      cliente: porId('clientes', v.clienteId),
      cupon: v.cuponId ? porId('cupones', v.cuponId) : null,
      detalles: tablas.ventasDetalle
        .filter((d) => d.ventaId === v.id)
        .map((d) => ({
          ...d,
          motocicleta: d.motocicletaId ? motoCompleta(porId('motocicletas', d.motocicletaId)) : null,
          accesorio: d.accesorioId ? porId('accesorios', d.accesorioId) : null,
        })),
      comprobantes: tablas.comprobantes.filter((c) => c.ventaId === v.id).map((c) => ({ ...c })),
    };

  const repos = {
    marcas: {
      listar: async () => tablas.marcas.map((m) => ({ ...m })),
      buscarPorId: async (id) => porId('marcas', id),
      buscarPorNombre: async (nombre) => tablas.marcas.find((m) => iguales(m.nombre, nombre)) ?? null,
      crear: async (datos) => insertar('marcas', datos),
      actualizar: async (id, datos) => actualizar('marcas', id, datos),
    },

    modelos: {
      listar: async ({ marcaId } = {}) =>
        tablas.modelos.filter((m) => !marcaId || m.marcaId === marcaId).map(modeloCompleto),
      buscarPorId: async (id) => modeloCompleto(porId('modelos', id)),
      buscarPorNombre: async (marcaId, nombre) =>
        tablas.modelos.find((m) => m.marcaId === marcaId && iguales(m.nombre, nombre)) ?? null,
      crear: async (datos) => insertar('modelos', datos),
      actualizar: async (id, datos) => actualizar('modelos', id, datos),
    },

    motocicletas: {
      listar: async ({ filtros = {}, saltar = 0, tomar = 20 } = {}) => {
        const filas = tablas.motocicletas
          .map(motoCompleta)
          .filter((m) => {
            const f = filtros;
            if (f.estado && m.estado !== f.estado) return false;
            if (f.marcaId && m.modelo.marcaId !== f.marcaId) return false;
            if (f.modeloId && m.modeloId !== f.modeloId) return false;
            if (f.cilindradaMin && m.modelo.cilindrada < f.cilindradaMin) return false;
            if (f.cilindradaMax && m.modelo.cilindrada > f.cilindradaMax) return false;
            if (f.precioMin && D(m.precio).lt(f.precioMin)) return false;
            if (f.precioMax && D(m.precio).gt(f.precioMax)) return false;
            return true;
          })
          .reverse();
        return paginar(filas, saltar, tomar);
      },
      buscarPorId: async (id) => motoCompleta(porId('motocicletas', id)),
      buscarPorVin: async (vin) => tablas.motocicletas.find((m) => m.vin === vin) ?? null,
      bloquear: async () => {},
      crear: async (datos) => {
        if (tablas.motocicletas.some((m) => m.vin === datos.vin)) throw conflicto('El VIN ya está registrado');
        return insertar('motocicletas', { estado: 'DISPONIBLE', ...datos });
      },
      actualizar: async (id, datos) => actualizar('motocicletas', id, datos),
      contarPorModeloYEstado: async () => {
        const conteo = new Map();
        for (const m of tablas.motocicletas) {
          const clave = `${m.modeloId}|${m.estado}`;
          conteo.set(clave, (conteo.get(clave) ?? 0) + 1);
        }
        return [...conteo].map(([clave, cantidad]) => {
          const [modeloId, estado] = clave.split('|');
          return { modeloId: Number(modeloId), estado, cantidad };
        });
      },
    },

    accesorios: {
      listar: async ({ soloActivos = false } = {}) =>
        tablas.accesorios.filter((a) => !soloActivos || a.activo).map((a) => ({ ...a })),
      buscarPorId: async (id) => porId('accesorios', id),
      buscarPorSku: async (sku) => tablas.accesorios.find((a) => a.sku === sku) ?? null,
      crear: async (datos) => insertar('accesorios', { stock: 0, activo: true, ...datos }),
      actualizar: async (id, datos) => actualizar('accesorios', id, datos),
      ajustarStock: async (id, delta) => {
        const accesorio = porId('accesorios', id);
        if (accesorio.stock + delta < 0) return false;
        accesorio.stock += delta;
        return true;
      },
    },

    movimientos: {
      registrar: async (datos) => insertar('movimientos', { fecha: new Date(), ...datos }),
      listar: async ({ filtros = {}, saltar = 0, tomar = 20 } = {}) => {
        const f = filtros;
        const filas = tablas.movimientos
          .filter(
            (m) =>
              (!f.tipo || m.tipo === f.tipo) &&
              (!f.motivo || m.motivo === f.motivo) &&
              (!f.motocicletaId || m.motocicletaId === f.motocicletaId) &&
              (!f.accesorioId || m.accesorioId === f.accesorioId) &&
              (!f.desde || m.fecha >= f.desde) &&
              (!f.hasta || m.fecha <= f.hasta),
          )
          .reverse();
        return paginar(filas, saltar, tomar);
      },
    },

    proveedores: {
      listar: async () => tablas.proveedores.map((p) => ({ ...p })),
      buscarPorId: async (id) => porId('proveedores', id),
      crear: async (datos) => insertar('proveedores', { activo: true, ...datos }),
      actualizar: async (id, datos) => actualizar('proveedores', id, datos),
    },

    ordenes: {
      listar: async ({ estado } = {}) =>
        tablas.ordenes.filter((o) => !estado || o.estado === estado).map(ordenCompleta).reverse(),
      buscarPorId: async (id) => ordenCompleta(porId('ordenes', id)),
      bloquear: async () => {},
      crear: async ({ detalles, ...datos }) => {
        const orden = insertar('ordenes', { estado: 'BORRADOR', ...datos });
        for (const d of detalles) {
          insertar('detalles', { ordenCompraId: orden.id, cantidadRecibida: 0, modeloId: null, accesorioId: null, ...d });
        }
        return ordenCompleta(porId('ordenes', orden.id));
      },
      actualizarEstado: async (id, estado) => actualizar('ordenes', id, { estado }),
      sumarRecibido: async (detalleId, cantidad) => {
        const detalle = porId('detalles', detalleId);
        if (detalle.cantidadRecibida + cantidad > detalle.cantidad) return false;
        detalle.cantidadRecibida += cantidad;
        return true;
      },
      crearRecepcion: async (datos) => insertar('recepciones', { fecha: new Date(), ...datos }),
    },

    clientes: {
      buscarPorId: async (id) => porId('clientes', id),
      buscarPorUsuarioId: async (usuarioId) => tablas.clientes.find((c) => c.usuarioId === usuarioId) ?? null,
      buscar: async ({ nit, texto } = {}) =>
        tablas.clientes.filter(
          (c) => (!nit || c.nit === nit) && (!texto || c.nombre.toLowerCase().includes(texto.toLowerCase())),
        ),
      crear: async (datos) => insertar('clientes', { nit: null, direccion: null, telefono: null, usuarioId: null, ...datos }),
    },

    cupones: {
      listar: async () => tablas.cupones.map((c) => ({ ...c })).reverse(),
      buscarPorId: async (id) => porId('cupones', id),
      buscarPorCodigo: async (codigo) => tablas.cupones.find((c) => c.codigo === codigo) ?? null,
      crear: async (datos) => {
        if (tablas.cupones.some((c) => c.codigo === datos.codigo)) throw conflicto('El código de cupón ya existe');
        return insertar('cupones', { usosActuales: 0, activo: true, canal: 'AMBOS', usosMaximos: null, ...datos });
      },
      actualizar: async (id, datos) => actualizar('cupones', id, datos),
      registrarUso: async (id) => {
        const cupon = porId('cupones', id);
        if (cupon.usosMaximos !== null && cupon.usosActuales >= cupon.usosMaximos) return false;
        cupon.usosActuales += 1;
        return true;
      },
      liberarUso: async (id) => {
        const cupon = porId('cupones', id);
        if (cupon.usosActuales > 0) cupon.usosActuales -= 1;
      },
    },

    ventas: {
      crear: async ({ detalles, ...datos }) => {
        const venta = insertar('ventas', { descuento: '0', cuponId: null, vendedorId: null, sesionCajaId: null, ...datos });
        for (const d of detalles) {
          insertar('ventasDetalle', { ventaId: venta.id, motocicletaId: null, accesorioId: null, ...d });
        }
        return ventaCompleta(porId('ventas', venta.id));
      },
      buscarPorId: async (id) => ventaCompleta(porId('ventas', id)),
      bloquear: async () => {},
      actualizar: async (id, datos) => actualizar('ventas', id, datos),
      listar: async ({ filtros = {}, saltar = 0, tomar = 20 } = {}) => {
        const f = filtros;
        const filas = tablas.ventas
          .filter(
            (v) =>
              (!f.estado || v.estado === f.estado) &&
              (!f.canal || v.canal === f.canal) &&
              (!f.clienteId || v.clienteId === f.clienteId),
          )
          .map(ventaCompleta)
          .reverse();
        return paginar(filas, saltar, tomar);
      },
    },

    comprobantes: {
      crear: async (datos) => insertar('comprobantes', { estado: 'PENDIENTE', subidoEn: new Date(), ...datos }),
      buscarPorId: async (id) => {
        const c = porId('comprobantes', id);
        return c && { ...c, venta: ventaCompleta(porId('ventas', c.ventaId)) };
      },
      actualizar: async (id, datos) => actualizar('comprobantes', id, datos),
      listar: async ({ estado } = {}) =>
        tablas.comprobantes
          .filter((c) => !estado || c.estado === estado)
          .map((c) => ({ ...c, venta: ventaCompleta(porId('ventas', c.ventaId)) }))
          .reverse(),
    },

    caja: {
      buscarAbierta: async () => tablas.cajas.find((c) => c.estado === 'ABIERTA') ?? null,
      buscarPorId: async (id) => porId('cajas', id),
      bloquear: async () => {},
      crear: async (datos) => {
        if (tablas.cajas.some((c) => c.estado === 'ABIERTA')) throw conflicto('Ya hay una caja abierta');
        return insertar('cajas', { estado: 'ABIERTA', abiertaEn: new Date(), ...datos });
      },
      actualizar: async (id, datos) => actualizar('cajas', id, datos),
      listar: async () => tablas.cajas.map((c) => ({ ...c })).reverse(),
      registrarMovimiento: async (datos) => insertar('movimientosCaja', { fecha: new Date(), ventaId: null, referencia: null, ...datos }),
      listarMovimientos: async (sesionCajaId) => tablas.movimientosCaja.filter((m) => m.sesionCajaId === sesionCajaId),
      totalesPorMedio: async (sesionCajaId) => {
        const totales = new Map();
        for (const m of tablas.movimientosCaja.filter((x) => x.sesionCajaId === sesionCajaId)) {
          const clave = `${m.tipo}|${m.medio}`;
          totales.set(clave, D(totales.get(clave) ?? 0).plus(m.monto));
        }
        return [...totales].map(([clave, total]) => {
          const [tipo, medio] = clave.split('|');
          return { tipo, medio, total: total.toString() };
        });
      },
    },
  };

  return {
    repos,
    tablas: () => tablas,
    async ejecutar(funcion) {
      const copia = structuredClone(tablas);
      const copiaContadores = { ...contadores };
      try {
        return await funcion(repos);
      } catch (error) {
        tablas = copia;
        Object.assign(contadores, copiaContadores);
        throw error;
      }
    },
  };
}
