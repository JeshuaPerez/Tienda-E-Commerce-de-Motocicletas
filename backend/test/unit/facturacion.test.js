// RF 08: factura interna (PA-7) emitida automáticamente al quedar pagada la venta, con NIT o CF, nombre y dirección.
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ADMIN, CLIENTE, OTRO_CLIENTE, PDF, crearEscenario } from '../ayudantes/escenario-ventas.js';

describe('RF 08 · facturación interna', () => {
  let esc;
  let fact;

  const ventaPos = (cambios = {}) =>
    esc.servicios.pos.registrarVenta(
      { cliente: { nombre: 'Carlos Méndez', nit: '1234567-8', direccion: 'Zona 1' }, items: [{ motocicletaId: esc.moto1.id }], pago: { metodo: 'EFECTIVO' }, ...cambios },
      ADMIN.id,
    );

  beforeEach(async () => {
    esc = await crearEscenario();
    fact = esc.servicios.facturacion;
    await esc.servicios.caja.abrir({ montoInicial: '0' }, ADMIN.id);
  });

  it('una venta del POS emite su factura con serie, correlativo y datos fiscales', async () => {
    const venta = await ventaPos();
    assert.equal(venta.facturas.length, 1);
    const factura = await fact.obtenerFactura(venta.facturas[0].id, ADMIN);

    assert.equal(factura.numeroCompleto, 'A-00000001');
    assert.equal(factura.estado, 'EMITIDA');
    assert.deepEqual(factura.receptor, { nit: '12345678', nombre: 'Carlos Méndez', direccion: 'Zona 1' });
    assert.equal(factura.total, '25999.99');
    assert.equal(factura.iva, venta.iva);
    assert.equal(factura.lineas.length, 1);
    assert.match(factura.leyenda, /no es una Factura Electrónica en Línea/);
  });

  it('el correlativo avanza de uno en uno', async () => {
    await ventaPos();
    const segunda = await ventaPos({ items: [{ motocicletaId: esc.moto2.id }] });
    const factura = await fact.obtenerFactura(segunda.facturas[0].id, ADMIN);
    assert.equal(factura.numero, 2);
  });

  it('sin NIT se factura a consumidor final (CF) con dirección "Ciudad"', async () => {
    const venta = await ventaPos({ cliente: { nombre: 'Mostrador' } });
    const factura = await fact.obtenerFactura(venta.facturas[0].id, ADMIN);
    assert.deepEqual(factura.receptor, { nit: 'CF', nombre: 'Mostrador', direccion: 'Ciudad' });
  });

  it('un pedido web no se factura hasta que se aprueba la transferencia (RN 4)', async () => {
    const ventas = esc.servicios.ventas;
    const pedido = await ventas.checkout({ items: [{ motocicletaId: esc.moto1.id }], metodoPago: 'TRANSFERENCIA' }, CLIENTE.id);
    assert.equal(pedido.facturas.length, 0);
    const { comprobantes } = await ventas.subirComprobante(pedido.id, { contenido: PDF }, CLIENTE);
    const pagada = await ventas.aprobarComprobante(comprobantes[0].id, ADMIN.id);
    assert.equal(pagada.facturas.length, 1);
  });

  it('un pedido pagado al retirar se factura al cobrarlo', async () => {
    const ventas = esc.servicios.ventas;
    const pedido = await ventas.checkout({ items: [{ motocicletaId: esc.moto1.id }], metodoPago: 'POS_AL_RETIRAR' }, CLIENTE.id);
    const pagada = await ventas.cobrarEnTienda(pedido.id, { metodo: 'EFECTIVO' }, ADMIN.id);
    assert.equal(pagada.facturas[0].estado, 'EMITIDA');
  });

  describe('anulación y reemisión', () => {
    let venta;
    let facturaId;
    beforeEach(async () => {
      venta = await ventaPos();
      facturaId = venta.facturas[0].id;
    });

    it('anular exige un motivo y deja la factura ANULADA', async () => {
      await assert.rejects(fact.anular(facturaId, {}, ADMIN.id), { estado: 400 });
      const anulada = await fact.anular(facturaId, { motivo: 'NIT equivocado' }, ADMIN.id);
      assert.equal(anulada.estado, 'ANULADA');
      await assert.rejects(fact.anular(facturaId, { motivo: 'otra vez' }, ADMIN.id), { estado: 409 });
    });

    it('tras anular se reemite con los datos corregidos y un número nuevo', async () => {
      await fact.anular(facturaId, { motivo: 'NIT equivocado' }, ADMIN.id);
      const nueva = await fact.reemitir({ ventaId: venta.id, nit: '7654321-K', nombre: 'Carlos Méndez S.A.' }, ADMIN.id);
      assert.equal(nueva.numeroCompleto, 'A-00000002');
      assert.equal(nueva.receptor.nit, '7654321K');
      assert.equal(nueva.receptor.direccion, 'Zona 1');
    });

    it('no se reemite si la venta ya tiene una factura vigente', async () => {
      await assert.rejects(fact.reemitir({ ventaId: venta.id }, ADMIN.id), { estado: 409 });
    });

    it('no se factura una venta sin pago y se valida el NIT', async () => {
      const pedido = await esc.servicios.ventas.checkout({ items: [{ motocicletaId: esc.moto2.id }], metodoPago: 'TRANSFERENCIA' }, CLIENTE.id);
      await assert.rejects(fact.reemitir({ ventaId: pedido.id }, ADMIN.id), { estado: 409 });
      await fact.anular(facturaId, { motivo: 'x' }, ADMIN.id);
      await assert.rejects(fact.reemitir({ ventaId: venta.id, nit: '12-AB' }, ADMIN.id), { estado: 400 });
    });
  });

  describe('estado de facturación para el cliente (5.1)', () => {
    it('cada cliente ve solo sus facturas', async () => {
      const ventas = esc.servicios.ventas;
      const pedido = await ventas.checkout({ items: [{ motocicletaId: esc.moto1.id }], metodoPago: 'POS_AL_RETIRAR' }, CLIENTE.id);
      const pagada = await ventas.cobrarEnTienda(pedido.id, { metodo: 'EFECTIVO' }, ADMIN.id);

      const { facturas } = await fact.misFacturas(CLIENTE.id, {});
      assert.equal(facturas.length, 1);
      assert.equal((await fact.misFacturas(OTRO_CLIENTE.id, {})).facturas.length, 0);
      await assert.rejects(fact.obtenerFactura(pagada.facturas[0].id, OTRO_CLIENTE), { estado: 404 });
      assert.equal((await fact.obtenerFactura(pagada.facturas[0].id, CLIENTE)).ventaId, pedido.id);
    });

    it('el administrador busca facturas por NIT', async () => {
      await ventaPos();
      await ventaPos({ cliente: { nombre: 'Mostrador' }, items: [{ motocicletaId: esc.moto2.id }] });
      assert.equal((await fact.listarFacturas({ nit: '1234567-8' })).total, 1);
      assert.equal((await fact.listarFacturas({ nit: 'CF' })).total, 1);
    });
  });
});
