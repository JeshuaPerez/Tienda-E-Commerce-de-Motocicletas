// RF 10: ventas por período, motocicletas más vendidas, flujo de caja y rendimiento (margen bruto).
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ADMIN, CLIENTE, crearEscenario } from '../ayudantes/escenario-ventas.js';

describe('RF 10 · reportes', () => {
  let esc;
  let rep;

  const dia = (fechaHoraUtc) => { esc.reloj.ahora = new Date(fechaHoraUtc); };
  const vender = (items, metodo = 'EFECTIVO', referencia) =>
    esc.servicios.pos.registrarVenta({ cliente: { nombre: 'Mostrador' }, items, pago: { metodo, referencia } }, ADMIN.id);

  beforeEach(async () => {
    esc = await crearEscenario();
    rep = esc.servicios.reportes;
    await esc.servicios.catalogo.actualizarMotocicleta(esc.moto1.id, { costoAdquisicion: '20000.00' });

    // 13 de noviembre: caja con dos ventas (moto 1 en efectivo, casco con tarjeta) y un retiro.
    dia('2026-11-13T15:00:00Z');
    await esc.servicios.caja.abrir({ montoInicial: '500.00' }, ADMIN.id);
    await vender([{ motocicletaId: esc.moto1.id }]);
    await vender([{ accesorioId: esc.casco.id, cantidad: 2 }], 'TARJETA', 'VCH-1');
    await esc.servicios.caja.retirar({ monto: '300.00', concepto: 'Depósito' }, ADMIN.id);
    await esc.servicios.caja.cerrar({ efectivoContado: '26199.99', vouchersContado: '900.00' }, ADMIN.id);

    // 14 de noviembre: la moto 2 (sin costo registrado) y un pedido web pendiente que no cuenta.
    dia('2026-11-14T16:00:00Z');
    await esc.servicios.caja.abrir({ montoInicial: '0' }, ADMIN.id);
    await vender([{ motocicletaId: esc.moto2.id }], 'TRANSFERENCIA', 'TRF-1');
    await esc.servicios.ventas.checkout({ items: [{ accesorioId: esc.casco.id, cantidad: 1 }], metodoPago: 'TRANSFERENCIA' }, CLIENTE.id);
  });

  const rango = { desde: '2026-11-13', hasta: '2026-11-14' };

  it('ventas por período: solo cuenta ventas cobradas y agrupa por día de Guatemala', async () => {
    const r = await rep.ventas(rango);
    assert.equal(r.resumen.cantidadVentas, 3);
    assert.equal(r.resumen.total, '53399.99'); // 25999.99 + 900.00 + 26500.00
    assert.equal(r.resumen.iva, r.periodos.reduce((s, p) => s + Number(p.iva), 0).toFixed(2));
    assert.deepEqual(r.periodos.map((p) => [p.periodo, p.cantidadVentas, p.total]), [
      ['2026-11-13', 2, '26899.99'],
      ['2026-11-14', 1, '26500.00'],
    ]);
    assert.deepEqual(r.porMetodo.map((m) => [m.metodo, m.total]), [['EFECTIVO', '25999.99'], ['TARJETA', '900.00'], ['TRANSFERENCIA', '26500.00']]);
  });

  it('agrupa por mes si se pide', async () => {
    const r = await rep.ventas({ ...rango, agrupar: 'mes' });
    assert.deepEqual(r.periodos.map((p) => p.periodo), ['2026-11']);
  });

  it('motocicletas más vendidas por modelo, con unidades e ingresos', async () => {
    const r = await rep.masVendidas(rango);
    assert.equal(r.modelos[0].modelo, 'Yamaha FZ 2.0');
    assert.equal(r.modelos[0].unidades, 2);
    assert.equal(r.modelos[0].ingresos, '52499.99');
    assert.equal(r.accesorios[0].sku, 'CAS-1');
    assert.equal(r.accesorios[0].unidades, 2);
  });

  it('flujo de caja por día: ingresos por medio, retiros y neto', async () => {
    const r = await rep.flujoCaja(rango);
    const [d13, d14] = r.dias;
    assert.deepEqual(
      { fecha: d13.fecha, efectivo: d13.ingresosEfectivo, tarjeta: d13.ingresosTarjeta, retiros: d13.retiros, neto: d13.neto, diferencia: d13.diferenciaEfectivo },
      { fecha: '2026-11-13', efectivo: '25999.99', tarjeta: '900.00', retiros: '300.00', neto: '26599.99', diferencia: '0.00' },
    );
    assert.equal(d14.ingresosTransferencia, '26500.00');
    assert.equal(d14.estado, 'ABIERTA');
    assert.equal(r.totales.neto, '53099.99');
  });

  it('rendimiento: ingresos sin IVA − costo de las motos vendidas = margen bruto', async () => {
    const r = await rep.rendimiento(rango);
    assert.equal(r.ingresosConIva, '53399.99');
    assert.equal(r.ingresosSinIva, '47678.56');
    assert.equal(r.costoMotocicletas, '20000.00');
    assert.equal(r.margenBruto, '27678.56');
    assert.equal(r.motocicletasSinCosto, 1);
    assert.match(r.nota, /sin costo de adquisición/);
  });

  for (const [caso, consulta] of [
    ['un formato de fecha inválido', { desde: '13/11/2026', hasta: '2026-11-14' }],
    ['un rango invertido', { desde: '2026-11-14', hasta: '2026-11-13' }],
    ['un rango de más de 366 días', { desde: '2025-01-01', hasta: '2026-11-14' }],
    ['una agrupación desconocida', { ...rango, agrupar: 'semana' }],
  ]) {
    it(`rechaza ${caso}`, async () => {
      await assert.rejects(rep.ventas(consulta), { estado: 400 });
    });
  }

  it('sin fechas usa el mes en curso de Guatemala', async () => {
    const r = await rep.ventas({});
    assert.equal(r.desde, '2026-11-01');
    assert.equal(r.hasta, '2026-11-30');
  });
});
