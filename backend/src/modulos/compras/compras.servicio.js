// Compras (RF 07): proveedores locales e internacionales, órdenes de compra en GTQ (PA-11)
// y recepción de mercancía, que crea las motos con su VIN (RN 1) y suma el stock de accesorios.
import { conflicto, datosInvalidos, noEncontrado } from '../../utils/errores.js';
import { Decimal, formatearMonto } from '../../utils/dinero.js';
import { crearLector, sinIndefinidos } from '../../utils/validacion.js';
import { validarUnidad } from '../catalogo/catalogo.validacion.js';
import { modeloPublico, motoAdmin } from '../catalogo/catalogo.representacion.js';

export const TIPOS_PROVEEDOR = ['LOCAL', 'INTERNACIONAL'];
export const ESTADOS_ORDEN = ['BORRADOR', 'ENVIADA', 'RECIBIDA_PARCIAL', 'RECIBIDA', 'CANCELADA'];

// Cambios de estado manuales. RECIBIDA_PARCIAL y RECIBIDA solo los asigna una recepción.
const TRANSICIONES_ORDEN = {
  BORRADOR: ['ENVIADA', 'CANCELADA'],
  ENVIADA: ['CANCELADA'],
  RECIBIDA_PARCIAL: [],
  RECIBIDA: [],
  CANCELADA: [],
};
const ESTADOS_RECIBIBLES = ['ENVIADA', 'RECIBIDA_PARCIAL'];
const MAXIMO_LINEAS = 100;

// NIT guatemalteco: dígitos y un dígito verificador (0-9 o K), con o sin guion.
const FORMATO_NIT = /^\d{1,12}-?[\dK]$/;
const FORMATO_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const proveedorPublico = (p) =>
  p && {
    id: p.id,
    nombre: p.nombre,
    tipo: p.tipo,
    nit: p.nit ?? null,
    pais: p.pais,
    contacto: p.contacto ?? null,
    telefono: p.telefono ?? null,
    correo: p.correo ?? null,
    activo: p.activo,
  };

const ordenPublica = (o) =>
  o && {
    id: o.id,
    estado: o.estado,
    total: formatearMonto(o.total),
    notas: o.notas ?? null,
    proveedor: o.proveedor && { id: o.proveedor.id, nombre: o.proveedor.nombre, tipo: o.proveedor.tipo, pais: o.proveedor.pais },
    usuarioId: o.usuarioId,
    creadaEn: o.creadaEn ?? o.creadoEn,
    detalles: (o.detalles ?? []).map((d) => ({
      id: d.id,
      modelo: d.modelo ? modeloPublico(d.modelo) : null,
      accesorio: d.accesorio ? { id: d.accesorio.id, sku: d.accesorio.sku, nombre: d.accesorio.nombre } : null,
      cantidad: d.cantidad,
      cantidadRecibida: d.cantidadRecibida,
      pendiente: d.cantidad - d.cantidadRecibida,
      costoUnitario: formatearMonto(d.costoUnitario),
      subtotal: formatearMonto(new Decimal(d.costoUnitario).times(d.cantidad)),
    })),
  };

// Ejecuta una validación y antepone el nombre del elemento a cada problema ("detalles[0].cantidad: ...").
function conPrefijo(prefijo, validar) {
  try {
    return validar();
  } catch (error) {
    if (error.detalles) error.detalles = error.detalles.map((d) => `${prefijo}.${d}`);
    throw error;
  }
}

function leerLista(entrada, campo) {
  const lista = entrada?.[campo];
  if (!Array.isArray(lista) || lista.length === 0) throw datosInvalidos([`${campo}: debe ser una lista con al menos un elemento`]);
  if (lista.length > MAXIMO_LINEAS) throw datosInvalidos([`${campo}: máximo ${MAXIMO_LINEAS} elementos`]);
  return lista;
}

function leerDatosProveedor(entrada, { parcial, tipo: tipoActual }) {
  const lector = crearLector(entrada);
  const tipo = parcial ? tipoActual : lector.opcion('tipo', TIPOS_PROVEEDOR, { obligatorio: true });
  if (parcial && lector.tiene('tipo')) lector.problema('tipo: no se puede modificar');
  const nitTexto = lector.texto('nit', { max: 20 });
  const nit = nitTexto?.replace(/\s+/g, '').toUpperCase();
  const correo = lector.texto('correo', { max: 150 });
  const datosLeidos = {
    nombre: lector.texto('nombre', { obligatorio: !parcial, max: 150 }),
    nit,
    pais: lector.texto('pais', { obligatorio: !parcial && tipo === 'INTERNACIONAL', max: 60 }),
    contacto: lector.texto('contacto', { max: 120 }),
    telefono: lector.texto('telefono', { max: 30 }),
    correo: correo?.toLowerCase(),
    activo: parcial ? lector.booleano('activo') : undefined,
  };
  if (tipo === 'LOCAL' && nit && !FORMATO_NIT.test(nit)) lector.problema('nit: formato de NIT inválido (p. ej. 1234567-8)');
  if (correo && !FORMATO_CORREO.test(correo)) lector.problema('correo: formato inválido');
  lector.terminar();
  if (!parcial && tipo === 'LOCAL') datosLeidos.pais ??= 'Guatemala';
  return sinIndefinidos({ ...datosLeidos, tipo: parcial ? undefined : tipo });
}

function leerLineasOrden(entrada) {
  const claves = new Set();
  return leerLista(entrada, 'detalles').map((linea, i) =>
    conPrefijo(`detalles[${i}]`, () => {
      const lector = crearLector(linea);
      const modeloId = lector.entero('modeloId', { min: 1 });
      const accesorioId = lector.entero('accesorioId', { min: 1 });
      const cantidad = lector.entero('cantidad', { obligatorio: true, min: 1, max: 1000 });
      const costoUnitario = lector.monto('costoUnitario', { obligatorio: true, permitirCero: true });
      if ((modeloId === undefined) === (accesorioId === undefined)) {
        lector.problema('indique modeloId o accesorioId (solo uno)');
      }
      lector.terminar();
      const clave = modeloId ? `modelo:${modeloId}` : `accesorio:${accesorioId}`;
      if (claves.has(clave)) throw datosInvalidos(['el mismo artículo aparece en más de una línea']);
      claves.add(clave);
      return { modeloId: modeloId ?? null, accesorioId: accesorioId ?? null, cantidad, costoUnitario };
    }),
  );
}

function leerLineasRecepcion(entrada) {
  const detalles = new Set();
  const vins = new Set();
  return leerLista(entrada, 'lineas').map((linea, i) =>
    conPrefijo(`lineas[${i}]`, () => {
      const lector = crearLector(linea);
      const detalleId = lector.entero('detalleId', { obligatorio: true, min: 1 });
      const tieneMotos = linea?.motocicletas !== undefined;
      const cantidad = tieneMotos ? undefined : lector.entero('cantidad', { obligatorio: true, min: 1, max: 100000 });
      lector.terminar();
      if (detalles.has(detalleId)) throw datosInvalidos(['la misma línea de la orden aparece dos veces']);
      detalles.add(detalleId);
      if (!tieneMotos) return { detalleId, cantidad };

      const motocicletas = leerLista(linea, 'motocicletas').map((unidad, j) => validarUnidad(unidad, `motocicletas[${j}]`));
      for (const { vin } of motocicletas) {
        if (vins.has(vin)) throw datosInvalidos([`el VIN ${vin} aparece más de una vez en la recepción`]);
        vins.add(vin);
      }
      return { detalleId, motocicletas };
    }),
  );
}

export function crearServicioCompras({ datos }) {
  const { repos } = datos;

  const buscarProveedor = async (id) => {
    const proveedor = await repos.proveedores.buscarPorId(id);
    if (!proveedor) throw noEncontrado('Proveedor no encontrado');
    return proveedor;
  };

  const buscarOrden = async (r, id) => {
    const orden = await r.ordenes.buscarPorId(id);
    if (!orden) throw noEncontrado('Orden de compra no encontrada');
    return orden;
  };

  return {
    // ───── Proveedores ─────
    listarProveedores: async () => (await repos.proveedores.listar()).map(proveedorPublico),
    obtenerProveedor: async (id) => proveedorPublico(await buscarProveedor(id)),

    crearProveedor: async (entrada) =>
      proveedorPublico(await repos.proveedores.crear(leerDatosProveedor(entrada, { parcial: false }))),

    async actualizarProveedor(id, entrada) {
      const proveedor = await buscarProveedor(id);
      const cambios = leerDatosProveedor(entrada, { parcial: true, tipo: proveedor.tipo });
      return proveedorPublico(await repos.proveedores.actualizar(id, cambios));
    },

    // ───── Órdenes de compra ─────
    async listarOrdenes(consulta = {}) {
      const lector = crearLector(consulta);
      const estado = lector.opcion('estado', ESTADOS_ORDEN);
      lector.terminar();
      return (await repos.ordenes.listar({ estado })).map(ordenPublica);
    },

    obtenerOrden: async (id) => ordenPublica(await buscarOrden(repos, id)),

    async crearOrden(entrada, usuarioId) {
      const lector = crearLector(entrada);
      const proveedorId = lector.entero('proveedorId', { obligatorio: true, min: 1 });
      const notas = lector.texto('notas', { max: 1000 });
      lector.terminar();
      const detalles = leerLineasOrden(entrada);

      const proveedor = await buscarProveedor(proveedorId);
      if (!proveedor.activo) throw conflicto('El proveedor está inactivo');
      for (const d of detalles) {
        if (d.modeloId && !(await repos.modelos.buscarPorId(d.modeloId))) throw noEncontrado(`Modelo ${d.modeloId} no encontrado`);
        if (d.accesorioId && !(await repos.accesorios.buscarPorId(d.accesorioId))) {
          throw noEncontrado(`Accesorio ${d.accesorioId} no encontrado`);
        }
      }

      // Total exacto en GTQ: suma de cantidad × costo unitario con aritmética decimal (RN 6).
      const total = detalles.reduce((suma, d) => suma.plus(d.costoUnitario.times(d.cantidad)), new Decimal(0));
      const orden = await repos.ordenes.crear(sinIndefinidos({ proveedorId, usuarioId, notas, total, detalles }));
      return ordenPublica(await repos.ordenes.buscarPorId(orden.id));
    },

    async cambiarEstadoOrden(id, entrada) {
      const lector = crearLector(entrada);
      const estado = lector.opcion('estado', ESTADOS_ORDEN, { obligatorio: true });
      lector.terminar();

      return datos.ejecutar(async (r) => {
        await r.ordenes.bloquear(id);
        const orden = await buscarOrden(r, id);
        if (!TRANSICIONES_ORDEN[orden.estado].includes(estado)) {
          const motivo = orden.estado === 'RECIBIDA_PARCIAL' ? ' (ya tiene mercancía recibida)' : '';
          throw conflicto(`No se puede pasar la orden de ${orden.estado} a ${estado}${motivo}`);
        }
        await r.ordenes.actualizarEstado(id, estado);
        return ordenPublica(await r.ordenes.buscarPorId(id));
      });
    },

    // Todo o nada: si una unidad falla (por ejemplo, un VIN repetido), no se registra ninguna.
    async recibirMercancia(id, entrada, usuarioId) {
      const lector = crearLector(entrada);
      const notas = lector.texto('notas', { max: 1000 });
      lector.terminar();
      const lineas = leerLineasRecepcion(entrada);

      return datos.ejecutar(async (r) => {
        // Bloquea la orden: dos recepciones simultáneas no pueden superar lo pedido.
        await r.ordenes.bloquear(id);
        const orden = await buscarOrden(r, id);
        if (!ESTADOS_RECIBIBLES.includes(orden.estado)) {
          throw conflicto(`Solo se recibe mercancía de órdenes ENVIADA o RECIBIDA_PARCIAL (esta está ${orden.estado})`);
        }

        const plan = lineas.map((linea, i) => {
          const detalle = orden.detalles.find((d) => d.id === linea.detalleId);
          if (!detalle) throw datosInvalidos([`lineas[${i}].detalleId: la línea ${linea.detalleId} no pertenece a la orden`]);
          if (detalle.modeloId && !linea.motocicletas) {
            throw datosInvalidos([`lineas[${i}]: es una línea de motocicletas; envíe "motocicletas" con su VIN`]);
          }
          if (detalle.accesorioId && linea.motocicletas) {
            throw datosInvalidos([`lineas[${i}]: es una línea de accesorios; envíe "cantidad"`]);
          }
          const cantidad = linea.motocicletas?.length ?? linea.cantidad;
          const pendiente = detalle.cantidad - detalle.cantidadRecibida;
          if (cantidad > pendiente) {
            throw conflicto(`Línea ${detalle.id}: se pidieron ${detalle.cantidad}, ya se recibieron ${detalle.cantidadRecibida} y quedan ${pendiente}`);
          }
          return { detalle, cantidad, motocicletas: linea.motocicletas };
        });

        const recepcion = await r.ordenes.crearRecepcion(sinIndefinidos({ ordenCompraId: id, usuarioId, notas }));
        const referencia = `OC-${id} / recepción ${recepcion.id}`;
        const creadas = [];

        for (const { detalle, cantidad, motocicletas } of plan) {
          if (!(await r.ordenes.sumarRecibido(detalle.id, cantidad))) {
            throw conflicto(`Línea ${detalle.id}: la cantidad recibida supera lo pedido`);
          }
          if (motocicletas) {
            for (const unidad of motocicletas) {
              if (await r.motocicletas.buscarPorVin(unidad.vin)) throw conflicto(`El VIN ${unidad.vin} ya está registrado`);
              const moto = await r.motocicletas.crear(
                sinIndefinidos({ ...unidad, modeloId: detalle.modeloId, costoAdquisicion: detalle.costoUnitario, recepcionId: recepcion.id }),
              );
              await r.movimientos.registrar({ tipo: 'ENTRADA', motivo: 'COMPRA', cantidad: 1, motocicletaId: moto.id, referencia, usuarioId });
              creadas.push(moto.id);
            }
          } else {
            await r.accesorios.ajustarStock(detalle.accesorioId, cantidad);
            await r.movimientos.registrar({
              tipo: 'ENTRADA', motivo: 'COMPRA', cantidad, accesorioId: detalle.accesorioId, referencia, usuarioId,
            });
          }
        }

        const actualizada = await r.ordenes.buscarPorId(id);
        const completa = actualizada.detalles.every((d) => d.cantidadRecibida === d.cantidad);
        await r.ordenes.actualizarEstado(id, completa ? 'RECIBIDA' : 'RECIBIDA_PARCIAL');

        return {
          recepcion: { id: recepcion.id, fecha: recepcion.fecha },
          orden: ordenPublica(await r.ordenes.buscarPorId(id)),
          motocicletas: await Promise.all(creadas.map(async (motoId) => motoAdmin(await r.motocicletas.buscarPorId(motoId)))),
        };
      });
    },
  };
}
