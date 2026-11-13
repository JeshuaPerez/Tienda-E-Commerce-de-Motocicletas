// RF 09 (cupones) y RF 03 (impuestos): IVA del 12 % incluido en el precio (PA-6).
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { calcularTotales } from '../../src/modulos/ventas/calculos.js';
import { Decimal } from '../../src/utils/dinero.js';
import { crearEscenario } from '../ayudantes/escenario-ventas.js';

const lineas = (...precios) => precios.map((p) => ({ precioUnitario: new Decimal(p), cantidad: 1 }));

describe('RF 03 · cálculo de totales con IVA incluido (12 %)', () => {
  it('desglosa el IVA de un total: Q112.00 = Q100.00 + Q12.00', () => {
    const t = calcularTotales(lineas('112.00'));
    assert.deepEqual(t, { subtotal: '112.00', descuento: '0.00', total: '112.00', baseImponible: '100.00', iva: '12.00' });
  });

  it('base + IVA siempre suman exactamente el total', () => {
    const t = calcularTotales(lineas('25999.99'));
    assert.equal(t.baseImponible, '23214.28');
    assert.equal(t.iva, '2785.71');
    assert.equal(new Decimal(t.baseImponible).plus(t.iva).toFixed(2), t.total);
  });

  it('un descuento porcentual se redondea a centavos y reduce el total', () => {
    const t = calcularTotales(lineas('25999.99'), { tipo: 'PORCENTAJE', valor: '10' });
    assert.equal(t.descuento, '2600.00');
    assert.equal(t.total, '23399.99');
  });

  it('un monto fijo mayor que el subtotal deja el total en cero, nunca negativo', () => {
    const t = calcularTotales(lineas('100.00'), { tipo: 'MONTO_FIJO', valor: '500' });
    assert.equal(t.descuento, '100.00');
    assert.equal(t.total, '0.00');
  });

  it('multiplica por la cantidad de cada línea', () => {
    const t = calcularTotales([{ precioUnitario: new Decimal('450.00'), cantidad: 3 }]);
    assert.equal(t.subtotal, '1350.00');
  });
});

describe('RF 09 · cupones', () => {
  let esc;
  let cupones;
  const nuevo = (cambios = {}) =>
    cupones.crearCupon({
      codigo: 'moto10', tipo: 'PORCENTAJE', valor: '10', vigenteDesde: '2026-11-01', vigenteHasta: '2026-11-30', ...cambios,
    });

  beforeEach(async () => {
    esc = await crearEscenario();
    cupones = esc.servicios.cupones;
  });

  it('se crea con el código en mayúsculas y vigencia por días de Guatemala', async () => {
    const cupon = await nuevo();
    assert.equal(cupon.codigo, 'MOTO10');
    assert.equal(cupon.canal, 'AMBOS');
    assert.equal(cupon.vigenteHasta.toISOString(), '2026-12-01T05:59:59.999Z');
  });

  for (const [caso, cambio] of [
    ['un porcentaje mayor que 100', { valor: '150' }],
    ['una vigencia que termina antes de empezar', { vigenteDesde: '2026-12-01' }],
    ['un canal desconocido', { canal: 'TIENDA' }],
    ['un límite de usos de cero', { usosMaximos: 0 }],
    ['un código con espacios', { codigo: 'MOTO 10' }],
  ]) {
    it(`rechaza ${caso}`, async () => {
      await assert.rejects(nuevo(cambio), { estado: 400 });
    });
  }

  it('rechaza un código repetido', async () => {
    await nuevo();
    await assert.rejects(nuevo(), { estado: 409 });
  });

  describe('validación al aplicarlo en una cotización', () => {
    const cotizar = (codigo) => esc.servicios.ventas.cotizar({ items: [{ motocicletaId: esc.moto1.id }], cuponCodigo: codigo });

    it('aplica un cupón vigente', async () => {
      await nuevo();
      const c = await cotizar('moto10');
      assert.equal(c.descuento, '2600.00');
      assert.equal(c.cupon.codigo, 'MOTO10');
    });

    it('rechaza un código inexistente con 404', async () => {
      await assert.rejects(cotizar('NOEXISTE'), { estado: 404 });
    });

    for (const [caso, cambio] of [
      ['vencido', { vigenteDesde: '2026-10-01', vigenteHasta: '2026-10-31' }],
      ['que todavía no empieza', { vigenteDesde: '2026-12-01', vigenteHasta: '2026-12-31' }],
      ['inactivo', { activo: false }],
      ['solo para el mostrador (canal POS)', { canal: 'POS' }],
    ]) {
      it(`rechaza un cupón ${caso} con 409`, async () => {
        await nuevo(cambio);
        await assert.rejects(cotizar('MOTO10'), { estado: 409 });
      });
    }

    it('rechaza un cupón que agotó sus usos', async () => {
      const cupon = await nuevo({ usosMaximos: 1 });
      esc.tablas().cupones.find((c) => c.id === cupon.id).usosActuales = 1;
      await assert.rejects(cotizar('MOTO10'), { estado: 409 });
    });
  });
});
