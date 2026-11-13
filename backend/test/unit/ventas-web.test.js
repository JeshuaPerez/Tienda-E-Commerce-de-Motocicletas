// RF 03 (checkout web) y reglas 2, 4: solo se vende lo Disponible; la transferencia se valida antes de despachar.
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ADMIN, CLIENTE, OTRO_CLIENTE, PDF, PNG, crearEscenario, estadoMoto, stockDe } from '../ayudantes/escenario-ventas.js';

describe('RF 03 · checkout web', () => {
  let esc;
  let ventas;

  const comprar = (cambios = {}, usuario = CLIENTE) =>
    ventas.checkout(
      { items: [{ motocicletaId: esc.moto1.id }, { accesorioId: esc.casco.id, cantidad: 2 }], metodoPago: 'TRANSFERENCIA', ...cambios },
      usuario.id,
    );
  const archivo = (contenido = PDF) => ({ contenido, tamano: contenido.length });

  beforeEach(async () => {
    esc = await crearEscenario();
    ventas = esc.servicios.ventas;
  });

  describe('pedido', () => {
    it('reserva la moto, descuenta los accesorios y queda pendiente de pago (PA-4)', async () => {
      const venta = await comprar();
      assert.equal(venta.estado, 'PENDIENTE_PAGO');
      assert.equal(venta.canal, 'WEB');
      assert.equal(venta.total, '26899.99'); // 25999.99 + 2 × 450.00
      assert.equal(venta.iva, '2882.14');
      assert.equal(estadoMoto(esc, esc.moto1.id), 'RESERVADA');
      assert.equal(stockDe(esc, esc.casco.id), 3);
      assert.equal(venta.facturacion.nit, 'CF');
    });

    it('guarda los datos fiscales indicados y valida el NIT', async () => {
      const venta = await comprar({ facturacion: { nit: '1234567-8', nombre: 'Ana López', direccion: 'Zona 10' } });
      assert.equal(venta.facturacion.nit, '12345678');
      await assert.rejects(comprar({ facturacion: { nit: 'ABC' } }), { estado: 400 });
    });

    it('RN 2: no se puede comprar una moto reservada o vendida', async () => {
      await comprar();
      await assert.rejects(comprar({ items: [{ motocicletaId: esc.moto1.id }] }, OTRO_CLIENTE), { estado: 409 });
      esc.tablas().motocicletas.find((m) => m.id === esc.moto2.id).estado = 'VENDIDA';
      await assert.rejects(comprar({ items: [{ motocicletaId: esc.moto2.id }] }), { estado: 409 });
    });

    it('si una línea falla, no se reserva nada', async () => {
      await assert.rejects(
        comprar({ items: [{ motocicletaId: esc.moto1.id }, { accesorioId: esc.casco.id, cantidad: 99 }] }),
        { estado: 409 },
      );
      assert.equal(estadoMoto(esc, esc.moto1.id), 'DISPONIBLE');
      assert.equal(stockDe(esc, esc.casco.id), 5);
    });

    for (const [caso, cambio] of [
      ['sin artículos', { items: [] }],
      ['la misma moto dos veces', { items: [{ motocicletaId: 1 }, { motocicletaId: 1 }] }],
      ['un método de mostrador', { metodoPago: 'EFECTIVO' }],
    ]) {
      it(`rechaza un pedido con ${caso}`, async () => {
        await assert.rejects(comprar(cambio), { estado: 400 });
      });
    }

    it('cotizar no reserva nada', async () => {
      const cotizacion = await ventas.cotizar({ items: [{ motocicletaId: esc.moto1.id }] });
      assert.equal(cotizacion.total, '25999.99');
      assert.equal(estadoMoto(esc, esc.moto1.id), 'DISPONIBLE');
    });
  });

  describe('RN 4 · transferencia validada antes de despachar', () => {
    let venta;
    beforeEach(async () => {
      venta = await comprar();
    });

    it('el cliente sube el comprobante y el pedido pasa a validación', async () => {
      const resultado = await ventas.subirComprobante(venta.id, archivo(), CLIENTE);
      assert.equal(resultado.estado, 'PENDIENTE_VALIDACION');
      assert.equal(esc.almacen.archivos.size, 1);
    });

    it('rechaza archivos que no son JPG, PNG o PDF aunque digan serlo', async () => {
      await assert.rejects(ventas.subirComprobante(venta.id, archivo(Buffer.from('<script>')), CLIENTE), { estado: 400 });
    });

    it('rechaza archivos de más de 5 MB', async () => {
      const grande = Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024)]);
      await assert.rejects(ventas.subirComprobante(venta.id, archivo(grande), CLIENTE), { estado: 400 });
    });

    it('un cliente no puede subir comprobantes a pedidos ajenos', async () => {
      await assert.rejects(ventas.subirComprobante(venta.id, archivo(), OTRO_CLIENTE), { estado: 404 });
    });

    it('no se despacha sin pago validado', async () => {
      await ventas.subirComprobante(venta.id, archivo(), CLIENTE);
      await assert.rejects(ventas.entregar(venta.id), { estado: 409 });
    });

    it('aprobar exige la caja del día abierta para registrar el ingreso', async () => {
      const { comprobantes } = await ventas.subirComprobante(venta.id, archivo(), CLIENTE);
      await assert.rejects(ventas.aprobarComprobante(comprobantes[0].id, ADMIN.id), { estado: 409 });
    });

    it('al aprobar: venta pagada, moto vendida, salida de inventario e ingreso por transferencia', async () => {
      const { comprobantes } = await ventas.subirComprobante(venta.id, archivo(), CLIENTE);
      await esc.servicios.caja.abrir({ montoInicial: '0' }, ADMIN.id);
      const pagada = await ventas.aprobarComprobante(comprobantes[0].id, ADMIN.id);

      assert.equal(pagada.estado, 'PAGADA');
      assert.equal(estadoMoto(esc, esc.moto1.id), 'VENDIDA');
      assert.ok(esc.tablas().movimientos.some((m) => m.motocicletaId === esc.moto1.id && m.tipo === 'SALIDA' && m.motivo === 'VENTA_WEB'));
      const { resumen } = await esc.servicios.caja.obtenerActual();
      assert.equal(resumen.transferencias, '26899.99');
      assert.equal((await ventas.entregar(venta.id)).estado, 'ENTREGADA');
    });

    it('al rechazar: la moto vuelve a Disponible y se devuelven accesorios y cupón (PA-4)', async () => {
      await esc.servicios.cupones.crearCupon({ codigo: 'UNO', tipo: 'MONTO_FIJO', valor: '100', vigenteDesde: '2026-11-01', vigenteHasta: '2026-11-30', usosMaximos: 1 });
      const conCupon = await comprar({ items: [{ motocicletaId: esc.moto2.id }], cuponCodigo: 'UNO' });
      const { comprobantes } = await ventas.subirComprobante(conCupon.id, archivo(), CLIENTE);
      const rechazada = await ventas.rechazarComprobante(comprobantes[0].id, { motivo: 'Monto no coincide' }, ADMIN.id);

      assert.equal(rechazada.estado, 'RECHAZADA');
      assert.equal(estadoMoto(esc, esc.moto2.id), 'DISPONIBLE');
      assert.equal(esc.tablas().cupones[0].usosActuales, 0);
    });

    it('el rechazo exige un motivo', async () => {
      const { comprobantes } = await ventas.subirComprobante(venta.id, archivo(), CLIENTE);
      await assert.rejects(ventas.rechazarComprobante(comprobantes[0].id, {}, ADMIN.id), { estado: 400 });
    });
  });

  describe('cancelación y pago al retirar', () => {
    it('el cliente cancela su pedido pendiente y se libera todo', async () => {
      const venta = await comprar();
      const cancelada = await ventas.cancelar(venta.id, CLIENTE);
      assert.equal(cancelada.estado, 'CANCELADA');
      assert.equal(estadoMoto(esc, esc.moto1.id), 'DISPONIBLE');
      assert.equal(stockDe(esc, esc.casco.id), 5);
      assert.ok(esc.tablas().movimientos.some((m) => m.motivo === 'LIBERACION' && m.cantidad === 2));
    });

    it('un cliente no puede cancelar pedidos ajenos', async () => {
      const venta = await comprar();
      await assert.rejects(ventas.cancelar(venta.id, OTRO_CLIENTE), { estado: 404 });
    });

    it('pago por POS al retirar: se cobra en mostrador con la caja del día abierta', async () => {
      const venta = await comprar({ metodoPago: 'POS_AL_RETIRAR' });
      await assert.rejects(ventas.subirComprobante(venta.id, archivo(), CLIENTE), { estado: 409 });
      await assert.rejects(ventas.cobrarEnTienda(venta.id, { metodo: 'EFECTIVO' }, ADMIN.id), { estado: 409 });

      await esc.servicios.caja.abrir({ montoInicial: '0' }, ADMIN.id);
      await assert.rejects(ventas.cobrarEnTienda(venta.id, { metodo: 'TARJETA' }, ADMIN.id), { estado: 400 });
      const pagada = await ventas.cobrarEnTienda(venta.id, { metodo: 'TARJETA', referencia: 'VCH-77' }, ADMIN.id);
      assert.equal(pagada.estado, 'PAGADA');
      assert.equal(pagada.vendedorId, ADMIN.id);
      assert.equal((await esc.servicios.caja.obtenerActual()).resumen.vouchersEsperado, '26899.99');
    });
  });

  describe('historial', () => {
    it('cada cliente ve solo sus compras', async () => {
      await comprar();
      await comprar({ items: [{ motocicletaId: esc.moto2.id }] }, OTRO_CLIENTE);
      const { ventas: mias } = await ventas.misCompras(CLIENTE.id, {});
      assert.equal(mias.length, 1);
      await assert.rejects(ventas.obtenerVenta(mias[0].id, OTRO_CLIENTE), { estado: 404 });
      assert.equal((await ventas.obtenerVenta(mias[0].id, ADMIN)).id, mias[0].id);
    });
  });
});
