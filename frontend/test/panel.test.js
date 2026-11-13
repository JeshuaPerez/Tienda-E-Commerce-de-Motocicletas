// Lógica del panel: lectura de VIN al recibir mercancía (RN 1), totales de órdenes en GTQ y fechas de Guatemala.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { leerVins, totalOrden, anchoBarra, fechaGuatemala, rangoMes } from '../src/logica/panel.js';

describe('lectura de VIN pegados en la recepción', () => {
  it('acepta uno por línea, separados por comas o espacios, y los pasa a mayúsculas', () => {
    const { vins, invalidos, repetidos } = leerVins('me1rg0710p0000001\nME1RG0710P0000002, ME1RG0710P0000003');
    assert.deepEqual(vins, ['ME1RG0710P0000001', 'ME1RG0710P0000002', 'ME1RG0710P0000003']);
    assert.deepEqual(invalidos, []);
    assert.deepEqual(repetidos, []);
  });

  it('marca los inválidos (largo o letras I, O, Q) y los repetidos', () => {
    const { vins, invalidos, repetidos } = leerVins('ME1RG0710P0000001\nCORTO\nME1RG0710P000000O\nme1rg0710p0000001');
    assert.deepEqual(vins, ['ME1RG0710P0000001']);
    assert.deepEqual(invalidos, ['CORTO', 'ME1RG0710P000000O']);
    assert.deepEqual(repetidos, ['ME1RG0710P0000001']);
  });

  it('un texto vacío no produce VIN', () => {
    assert.deepEqual(leerVins('  \n ').vins, []);
  });
});

describe('total de una orden de compra', () => {
  it('suma cantidad × costo en centavos exactos', () => {
    assert.equal(totalOrden([{ cantidad: 3, costoUnitario: '10000.10' }, { cantidad: 3, costoUnitario: '0.10' }]), '30000.60');
  });

  it('ignora líneas incompletas', () => {
    assert.equal(totalOrden([{ cantidad: '', costoUnitario: '5' }, { cantidad: 2, costoUnitario: 'x' }]), '0.00');
  });
});

describe('gráficas y fechas', () => {
  it('el ancho de una barra es proporcional al máximo y nunca desaparece si hay valor', () => {
    assert.equal(anchoBarra('50.00', '100.00'), 50);
    assert.equal(anchoBarra('0.10', '100000.00'), 2);
    assert.equal(anchoBarra('0', '100'), 0);
    assert.equal(anchoBarra('5', '0'), 0);
  });

  it('usa el día de Guatemala aunque en UTC ya sea el día siguiente', () => {
    assert.equal(fechaGuatemala(new Date('2026-11-14T04:30:00Z')), '2026-11-13');
  });

  it('calcula el primer y el último día del mes', () => {
    assert.deepEqual(rangoMes(new Date('2026-02-10T15:00:00Z')), { desde: '2026-02-01', hasta: '2026-02-28' });
  });
});
