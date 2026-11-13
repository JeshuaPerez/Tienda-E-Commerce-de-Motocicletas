// Punto de venta (RF 04): venta en mostrador con cliente, vendedor (el admin autenticado, PA-2),
// motocicleta y método de pago (PA-5). Exige la caja del día abierta (RN 5) y unidades Disponibles (RN 2).
import { datosInvalidos, noEncontrado } from '../../utils/errores.js';
import { crearLector } from '../../utils/validacion.js';
import { esNitValido, normalizarNit } from '../../utils/nit.js';
import { exigirCajaDelDia } from '../caja/caja.servicio.js';
import {
  METODOS_MOSTRADOR, datosVenta, descontarAccesorios, leerItems, leerPago, obtenerCupon, prepararLineas,
  registrarIngresoCaja, totalesDe, venderMotos, ventaPublica,
} from '../ventas/ventas.nucleo.js';

const clientePublico = (c) => ({ id: c.id, nombre: c.nombre, nit: c.nit ?? null, direccion: c.direccion ?? null, telefono: c.telefono ?? null });

function leerClienteNuevo(datos) {
  const lector = crearLector(datos);
  const nombre = lector.texto('nombre', { obligatorio: true, max: 150 });
  const nitTexto = lector.texto('nit', { max: 20 });
  const nit = nitTexto ? normalizarNit(nitTexto) : 'CF';
  if (!esNitValido(nit)) lector.problema('cliente.nit: NIT inválido (use solo dígitos y verificador, o CF)');
  const cliente = {
    nombre,
    nit,
    direccion: lector.texto('direccion', { max: 250 }) ?? null,
    telefono: lector.texto('telefono', { max: 20 }) ?? null,
  };
  lector.terminar();
  return cliente;
}

export function crearServicioPos({ datos, reloj = () => new Date() }) {
  const { repos } = datos;

  return {
    async registrarVenta(entrada, vendedorId) {
      const lector = crearLector(entrada);
      const clienteId = lector.entero('clienteId', { min: 1 });
      const cuponCodigo = lector.texto('cuponCodigo', { max: 40 });
      lector.terminar();
      if (!clienteId && !entrada?.cliente) throw datosInvalidos(['indique clienteId o los datos del cliente']);
      const clienteNuevo = clienteId ? null : leerClienteNuevo(entrada.cliente);
      const pago = leerPago(entrada?.pago, METODOS_MOSTRADOR);
      const items = leerItems(entrada);

      return datos.ejecutar(async (r) => {
        const caja = await exigirCajaDelDia(r, reloj()); // RN 5, antes de tocar cualquier unidad

        let cliente;
        if (clienteId) {
          cliente = await r.clientes.buscarPorId(clienteId);
          if (!cliente) throw noEncontrado('Cliente no encontrado');
        } else {
          // Un NIT ya registrado reutiliza la ficha del cliente; CF siempre crea una nueva.
          const existente = clienteNuevo.nit !== 'CF' ? (await r.clientes.buscar({ nit: clienteNuevo.nit }))[0] : null;
          cliente = existente ?? (await r.clientes.crear(clienteNuevo));
        }

        const lineas = await prepararLineas(r, items, { bloquear: true }); // RN 2
        const cupon = await obtenerCupon(r, cuponCodigo, 'POS', reloj(), { consumir: true }); // PA-12
        const totales = totalesDe(lineas, cupon);

        const venta = await r.ventas.crear(
          datosVenta(lineas, cupon, totales, {
            canal: 'POS',
            estado: 'PAGADA',
            metodoPago: pago.metodo,
            referenciaPago: pago.referencia ?? null,
            clienteId: cliente.id,
            vendedorId,
            sesionCajaId: caja.id,
            pagadaEn: reloj(),
            nitFactura: cliente.nit || 'CF',
            nombreFactura: cliente.nombre,
            direccionFactura: cliente.direccion || 'Ciudad',
          }),
        );
        await venderMotos(r, venta, 'VENTA_POS', vendedorId);
        await descontarAccesorios(r, lineas, 'VENTA_POS', `Venta #${venta.id}`, vendedorId);
        await registrarIngresoCaja(r, caja, venta, pago.metodo, pago.referencia, vendedorId);
        return ventaPublica(await r.ventas.buscarPorId(venta.id));
      });
    },

    async buscarClientes(consulta = {}) {
      const lector = crearLector(consulta);
      const nitTexto = lector.texto('nit', { max: 20 });
      const texto = lector.texto('texto', { max: 100 });
      lector.terminar();
      if (!nitTexto && !texto) throw datosInvalidos(['indique nit o texto para buscar']);
      const clientes = await repos.clientes.buscar({ nit: nitTexto ? normalizarNit(nitTexto) : undefined, texto });
      return clientes.slice(0, 20).map(clientePublico);
    },
  };
}
