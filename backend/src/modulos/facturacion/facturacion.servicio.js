// Facturación (RF 08): consulta, anulación y reemisión de facturas internas. La emisión normal ocurre
// sola, dentro de la misma transacción en que la venta queda pagada (ver facturarVenta).
import { finDelDia, inicioDelDia } from '../../config/negocio.js';
import { conflicto, noEncontrado } from '../../utils/errores.js';
import { formatearMonto } from '../../utils/dinero.js';
import { normalizarNit } from '../../utils/nit.js';
import { crearLector, leerPaginacion, sinIndefinidos } from '../../utils/validacion.js';
import { leerFacturacion } from '../ventas/ventas.nucleo.js';

const ESTADOS_PAGADOS = ['PAGADA', 'ENTREGADA'];
const FORMATO_DIA = /^\d{4}-\d{2}-\d{2}$/;

// Emite la factura de una venta pagada. Se llama desde POS, aprobación de transferencia y cobro al retirar.
export async function facturarVenta(r, emisor, ventaId, ahora) {
  const venta = await r.ventas.buscarPorId(ventaId);
  if (!venta) throw noEncontrado('Venta no encontrada');
  if (!ESTADOS_PAGADOS.includes(venta.estado)) throw conflicto(`Solo se factura una venta pagada (esta está ${venta.estado})`);
  if (venta.facturas?.some((f) => f.estado === 'EMITIDA')) throw conflicto('La venta ya tiene una factura vigente');
  return emisor.emitir(r, venta, ahora);
}

export const numeroCompleto = (f) => `${f.serie}-${String(f.numero).padStart(8, '0')}`;

export const facturaResumen = (f) => ({ id: f.id, serie: f.serie, numero: f.numero, numeroCompleto: numeroCompleto(f), estado: f.estado });

const facturaPublica = (f, emisor) => ({
  ...facturaResumen(f),
  ventaId: f.ventaId,
  emisor: emisor.datosEmisor,
  receptor: { nit: f.nit, nombre: f.nombre, direccion: f.direccion },
  subtotal: formatearMonto(f.subtotal),
  descuento: formatearMonto(f.descuento),
  total: formatearMonto(f.total),
  baseImponible: formatearMonto(f.baseImponible),
  iva: formatearMonto(f.iva),
  moneda: 'GTQ',
  emitidaEn: f.emitidaEn,
  anuladaEn: f.anuladaEn ?? null,
  motivoAnulacion: f.motivoAnulacion ?? null,
  lineas: (f.lineas ?? []).map((l) => ({
    descripcion: l.descripcion,
    cantidad: l.cantidad,
    precioUnitario: formatearMonto(l.precioUnitario),
    subtotal: formatearMonto(l.subtotal),
  })),
  leyenda: emisor.leyenda,
});

function leerDiaOpcional(lector, campo, convertir) {
  const texto = lector.texto(campo, { max: 10 });
  if (texto === undefined) return undefined;
  if (!FORMATO_DIA.test(texto)) return void lector.problema(`${campo}: use el formato AAAA-MM-DD`);
  return convertir(texto);
}

export function crearServicioFacturacion({ datos, emisor, reloj = () => new Date() }) {
  const { repos } = datos;

  const listar = async (filtros, consulta) => {
    const { pagina, porPagina, saltar, tomar } = leerPaginacion(consulta);
    const { items, total } = await repos.facturas.listar({ filtros, saltar, tomar });
    return { facturas: items.map((f) => facturaPublica(f, emisor)), total, pagina, porPagina };
  };

  return {
    async listarFacturas(consulta = {}) {
      const lector = crearLector(consulta);
      const nit = lector.texto('nit', { max: 20 });
      const filtros = sinIndefinidos({
        nit: nit ? normalizarNit(nit) : undefined,
        estado: lector.opcion('estado', ['EMITIDA', 'ANULADA']),
        desde: leerDiaOpcional(lector, 'desde', inicioDelDia),
        hasta: leerDiaOpcional(lector, 'hasta', finDelDia),
      });
      lector.terminar();
      return listar(filtros, consulta);
    },

    // Solo la ve el cliente dueño de la venta o un administrador; a los demás se les responde 404.
    async obtenerFactura(id, usuario) {
      const factura = await repos.facturas.buscarPorId(id);
      if (!factura) throw noEncontrado('Factura no encontrada');
      if (usuario.rol !== 'ADMINISTRADOR') {
        const cliente = await repos.clientes.buscarPorUsuarioId(usuario.id);
        if (!cliente || factura.venta.clienteId !== cliente.id) throw noEncontrado('Factura no encontrada');
      }
      return facturaPublica(factura, emisor);
    },

    async misFacturas(usuarioId, consulta = {}) {
      const cliente = await repos.clientes.buscarPorUsuarioId(usuarioId);
      if (!cliente) return { facturas: [], total: 0, pagina: 1, porPagina: 20 };
      return listar({ clienteId: cliente.id }, consulta);
    },

    // Para corregir datos fiscales: se anula la factura y se reemite con un número nuevo.
    async reemitir(entrada, adminId) {
      const lector = crearLector(entrada);
      const ventaId = lector.entero('ventaId', { obligatorio: true, min: 1 });
      lector.terminar();
      const corrige = ['nit', 'nombre', 'direccion'].some((c) => entrada?.[c] !== undefined);

      return datos.ejecutar(async (r) => {
        await r.ventas.bloquear(ventaId);
        const venta = await r.ventas.buscarPorId(ventaId);
        if (!venta) throw noEncontrado('Venta no encontrada');
        if (corrige) {
          const fiscales = leerFacturacion(
            { nit: entrada.nit ?? venta.nitFactura, nombre: entrada.nombre ?? venta.nombreFactura, direccion: entrada.direccion ?? venta.direccionFactura },
            venta.nombreFactura,
          );
          if (!ESTADOS_PAGADOS.includes(venta.estado)) throw conflicto(`Solo se factura una venta pagada (esta está ${venta.estado})`);
          await r.ventas.actualizar(ventaId, fiscales);
        }
        const factura = await facturarVenta(r, emisor, ventaId, reloj());
        return facturaPublica(await r.facturas.buscarPorId(factura.id), emisor);
      });
    },

    async anular(id, entrada, adminId) {
      const lector = crearLector(entrada);
      const motivo = lector.texto('motivo', { obligatorio: true, max: 300 });
      lector.terminar();
      return datos.ejecutar(async (r) => {
        await r.facturas.bloquear(id);
        const factura = await r.facturas.buscarPorId(id);
        if (!factura) throw noEncontrado('Factura no encontrada');
        if (factura.estado !== 'EMITIDA') throw conflicto('La factura ya está anulada');
        await r.facturas.actualizar(id, { estado: 'ANULADA', anuladaEn: reloj(), anuladaPorId: adminId, motivoAnulacion: motivo });
        return facturaPublica(await r.facturas.buscarPorId(id), emisor);
      });
    },
  };
}
