// Emisor de facturas internas (PA-7). Está aislado detrás de una interfaz mínima —emitir(r, venta, ahora)—
// para poder reemplazarlo por un certificador FEL más adelante sin tocar ventas ni POS.
// No se conecta con la SAT ni con ningún certificador.
import { Decimal } from '../../utils/dinero.js';

export const LEYENDA_FACTURA_INTERNA =
  'Documento interno de MotoStore GT: no es una Factura Electrónica en Línea (FEL) certificada por la SAT.';

export function crearEmisorInterno({ serie = 'A', datosEmisor = {} } = {}) {
  return {
    serie,
    datosEmisor: {
      nombre: datosEmisor.nombre ?? 'MotoStore GT',
      nit: datosEmisor.nit ?? null,
      direccion: datosEmisor.direccion ?? null,
    },
    leyenda: LEYENDA_FACTURA_INTERNA,

    // Toma el siguiente correlativo y guarda una copia fija de los datos fiscales y montos de la venta.
    async emitir(r, venta, ahora) {
      const numero = await r.facturas.siguienteNumero(serie);
      return r.facturas.crear({
        serie,
        numero,
        ventaId: venta.id,
        nit: venta.nitFactura,
        nombre: venta.nombreFactura,
        direccion: venta.direccionFactura,
        subtotal: new Decimal(venta.subtotal),
        descuento: new Decimal(venta.descuento),
        total: new Decimal(venta.total),
        baseImponible: new Decimal(venta.total).minus(venta.iva),
        iva: new Decimal(venta.iva),
        estado: 'EMITIDA',
        emitidaEn: ahora,
        lineas: venta.detalles.map((d) => ({
          descripcion: d.descripcion,
          cantidad: d.cantidad,
          precioUnitario: new Decimal(d.precioUnitario),
          subtotal: new Decimal(d.subtotal),
        })),
      });
    },
  };
}
