// RN 6: los montos se manejan en quetzales (GTQ) con aritmética decimal exacta.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { leerMonto, formatearMonto } from '../../src/utils/dinero.js';

describe('RN 6 · montos en GTQ', () => {
  it('suma sin errores de punto flotante (0.1 + 0.2 = 0.30)', () => {
    assert.equal(formatearMonto(leerMonto('0.1', 'a').plus(leerMonto('0.2', 'b'))), '0.30');
  });

  it('acepta números y textos con hasta dos decimales', () => {
    assert.equal(formatearMonto(leerMonto(1500, 'precio')), '1500.00');
    assert.equal(formatearMonto(leerMonto('1500.5', 'precio')), '1500.50');
  });

  for (const valor of ['1.005', '-1', 'abc', '', null, '1e5', 12345678901]) {
    it(`rechaza ${JSON.stringify(valor)}`, () => {
      assert.throws(() => leerMonto(valor, 'precio'), { estado: 400 });
    });
  }

  it('el cero solo se acepta cuando se permite', () => {
    assert.throws(() => leerMonto('0', 'precio'), { estado: 400 });
    assert.equal(formatearMonto(leerMonto('0', 'costo', { permitirCero: true })), '0.00');
  });
});
