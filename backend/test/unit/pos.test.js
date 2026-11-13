// RF 04 (POS) y reglas 2 y 5: solo se vende lo Disponible y nunca con la caja del día cerrada.
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ADMIN, crearEscenario, estadoMoto, stockDe } from '../ayudantes/escenario-ventas.js';

describe('RF 04 · punto de venta', () => {
  let esc;
  let pos;

  const vender = (cambios = {}) =>
    pos.registrarVenta(
      {
        cliente: { nombre: 'Carlos Méndez', nit: 'CF' },
        items: [{ motocicletaId: esc.moto1.id }],
        pago: { metodo: 'EFECTIVO' },
        ...cambios,
      },
      ADMIN.id,
    );

  beforeEach(async () => {
    esc = await crearEscenario();
    pos = esc.servicios.pos;
  });

  it('RN 5: no se vende con la caja cerrada', async () => {
    await assert.rejects(vender(), { estado: 409 });
    assert.equal(estadoMoto(esc, esc.moto1.id), 'DISPONIBLE');
  });

  describe('con la caja del día abierta', () => {
    beforeEach(() => esc.servicios.caja.abrir({ montoInicial: '1000.00' }, ADMIN.id));

    it('registra la venta pagada con cliente, vendedor, moto y método de pago (PA-2)', async () => {
      const venta = await vender();
      assert.equal(venta.canal, 'POS');
      assert.equal(venta.estado, 'PAGADA');
      assert.equal(venta.vendedorId, ADMIN.id);
      assert.equal(venta.metodoPago, 'EFECTIVO');
      assert.equal(venta.cliente.nombre, 'Carlos Méndez');
      assert.equal(estadoMoto(esc, esc.moto1.id), 'VENDIDA');
      assert.ok(esc.tablas().movimientos.some((m) => m.motocicletaId === esc.moto1.id && m.motivo === 'VENTA_POS'));
      assert.equal((await esc.servicios.caja.obtenerActual()).resumen.efectivoEsperado, '26999.99');
    });

    it('RN 2: no se vende una moto reservada desde la web', async () => {
      await esc.servicios.ventas.checkout({ items: [{ motocicletaId: esc.moto1.id }], metodoPago: 'TRANSFERENCIA' }, 2);
      await assert.rejects(vender(), { estado: 409 });
    });

    it('usa un cliente existente por su id', async () => {
      const venta = await vender({ cliente: undefined, clienteId: 1 });
      assert.equal(venta.cliente.nombre, 'Ana López');
    });

    it('acepta tarjeta y transferencia solo con referencia (PA-5)', async () => {
      await assert.rejects(vender({ pago: { metodo: 'TARJETA' } }), { estado: 400 });
      const venta = await vender({ pago: { metodo: 'TRANSFERENCIA', referencia: 'TRF-123' } });
      assert.equal(venta.referenciaPago, 'TRF-123');
    });

    it('rechaza un método de pago de la tienda web', async () => {
      await assert.rejects(vender({ pago: { metodo: 'POS_AL_RETIRAR' } }), { estado: 400 });
    });

    it('rechaza un NIT inválido del cliente', async () => {
      await assert.rejects(vender({ cliente: { nombre: 'X', nit: '12A' } }), { estado: 400 });
    });

    it('PA-12: acepta cupones de canal POS o AMBOS, no los solo web', async () => {
      const base = { tipo: 'MONTO_FIJO', valor: '500', vigenteDesde: '2026-11-01', vigenteHasta: '2026-11-30' };
      await esc.servicios.cupones.crearCupon({ ...base, codigo: 'WEB500', canal: 'WEB' });
      await esc.servicios.cupones.crearCupon({ ...base, codigo: 'TODOS500', canal: 'AMBOS' });
      await assert.rejects(vender({ cuponCodigo: 'WEB500' }), { estado: 409 });
      const venta = await vender({ cuponCodigo: 'TODOS500' });
      assert.equal(venta.total, '25499.99');
    });

    it('si falta stock de un accesorio no se vende nada', async () => {
      await assert.rejects(
        vender({ items: [{ motocicletaId: esc.moto1.id }, { accesorioId: esc.casco.id, cantidad: 6 }] }),
        { estado: 409 },
      );
      assert.equal(estadoMoto(esc, esc.moto1.id), 'DISPONIBLE');
      assert.equal(stockDe(esc, esc.casco.id), 5);
      assert.equal(esc.tablas().movimientosCaja.length, 0);
    });

    it('busca clientes por NIT o nombre para asociarlos a la venta', async () => {
      await vender({ cliente: { nombre: 'Lucía Ramos', nit: '1234567-8' } });
      assert.equal((await pos.buscarClientes({ nit: '1234567-8' })).length, 1);
      assert.equal((await pos.buscarClientes({ texto: 'lucía' })).length, 1);
    });
  });
});
