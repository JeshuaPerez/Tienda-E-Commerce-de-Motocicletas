// RF 05: apertura y cierre de caja diaria, ingresos, retiros y cuadre de efectivo y vouchers.
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ADMIN, crearEscenario } from '../ayudantes/escenario-ventas.js';

describe('RF 05 · caja diaria', () => {
  let esc;
  let caja;

  const ventaPos = (metodo, referencia) =>
    esc.servicios.pos.registrarVenta(
      { cliente: { nombre: 'Mostrador' }, items: [{ accesorioId: esc.casco.id, cantidad: 1 }], pago: { metodo, referencia } },
      ADMIN.id,
    );

  beforeEach(async () => {
    esc = await crearEscenario();
    caja = esc.servicios.caja;
  });

  it('abre la caja del día con un monto inicial', async () => {
    const abierta = await caja.abrir({ montoInicial: '500.00' }, ADMIN.id);
    assert.equal(abierta.estado, 'ABIERTA');
    assert.equal(abierta.fechaOperacion, '2026-11-13');
    assert.equal(abierta.resumen.efectivoEsperado, '500.00');
  });

  it('no permite abrir una segunda caja', async () => {
    await caja.abrir({ montoInicial: '0' }, ADMIN.id);
    await assert.rejects(caja.abrir({ montoInicial: '100' }, ADMIN.id), { estado: 409 });
  });

  it('el cuadre suma ingresos por medio y resta retiros de efectivo', async () => {
    await caja.abrir({ montoInicial: '500.00' }, ADMIN.id);
    await ventaPos('EFECTIVO');
    await ventaPos('TARJETA', 'VCH-001');
    await ventaPos('TRANSFERENCIA', 'TRF-9');
    await caja.retirar({ monto: '200.00', concepto: 'Depósito al banco' }, ADMIN.id);

    const { resumen } = await caja.obtenerActual();
    assert.equal(resumen.ingresosEfectivo, '450.00');
    assert.equal(resumen.retirosEfectivo, '200.00');
    assert.equal(resumen.efectivoEsperado, '750.00'); // 500 + 450 − 200
    assert.equal(resumen.vouchersEsperado, '450.00');
    assert.equal(resumen.transferencias, '450.00');
  });

  it('no permite retirar más efectivo del que hay', async () => {
    await caja.abrir({ montoInicial: '100.00' }, ADMIN.id);
    await assert.rejects(caja.retirar({ monto: '100.01', concepto: 'Gasto' }, ADMIN.id), { estado: 409 });
  });

  it('el cierre registra lo contado y la diferencia contra lo esperado', async () => {
    await caja.abrir({ montoInicial: '500.00' }, ADMIN.id);
    await ventaPos('EFECTIVO');
    await ventaPos('TARJETA', 'VCH-001');
    const cierre = await caja.cerrar({ efectivoContado: '940.00', vouchersContado: '450.00' }, ADMIN.id);

    assert.equal(cierre.estado, 'CERRADA');
    assert.equal(cierre.cuadre.efectivoEsperado, '950.00');
    assert.equal(cierre.cuadre.diferenciaEfectivo, '-10.00');
    assert.equal(cierre.cuadre.diferenciaVouchers, '0.00');
    assert.equal((await caja.obtenerActual()).caja, null);
  });

  it('no se cierra ni se retira sin una caja abierta', async () => {
    await assert.rejects(caja.cerrar({ efectivoContado: '0', vouchersContado: '0' }, ADMIN.id), { estado: 409 });
    await assert.rejects(caja.retirar({ monto: '1', concepto: 'x' }, ADMIN.id), { estado: 409 });
  });

  it('una caja abierta ayer no sirve para operar hoy, pero sí se puede cerrar', async () => {
    esc.reloj.ahora = new Date('2026-11-12T20:00:00Z');
    await caja.abrir({ montoInicial: '100' }, ADMIN.id);
    esc.reloj.ahora = new Date('2026-11-13T15:00:00Z');

    await assert.rejects(ventaPos('EFECTIVO'), { estado: 409 });
    await assert.rejects(caja.retirar({ monto: '1', concepto: 'x' }, ADMIN.id), { estado: 409 });
    const cierre = await caja.cerrar({ efectivoContado: '100', vouchersContado: '0' }, ADMIN.id);
    assert.equal(cierre.fechaOperacion, '2026-11-12');
  });

  it('el día de operación sigue la hora de Guatemala, no la UTC', async () => {
    esc.reloj.ahora = new Date('2026-11-14T04:30:00Z'); // 13 de noviembre, 22:30 en Guatemala
    const abierta = await caja.abrir({ montoInicial: '0' }, ADMIN.id);
    assert.equal(abierta.fechaOperacion, '2026-11-13');
  });
});
