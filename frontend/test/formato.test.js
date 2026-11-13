// RN 6 en pantalla: los montos se muestran en quetzales sin pasar por punto flotante.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatearQuetzales, aCentavos, desdeCentavos, etiquetaEstadoVenta } from '../src/logica/formato.js';

describe('formato de montos en GTQ', () => {
  it('agrega el símbolo Q, separador de miles y dos decimales', () => {
    assert.equal(formatearQuetzales('25999.99'), 'Q 25,999.99');
    assert.equal(formatearQuetzales('1500'), 'Q 1,500.00');
    assert.equal(formatearQuetzales('0.5'), 'Q 0.50');
    assert.equal(formatearQuetzales('1234567.10'), 'Q 1,234,567.10');
  });

  it('muestra los negativos (diferencias de caja) con signo', () => {
    assert.equal(formatearQuetzales('-10.00'), '-Q 10.00');
  });

  it('devuelve un guion si no hay monto', () => {
    assert.equal(formatearQuetzales(null), '—');
    assert.equal(formatearQuetzales('abc'), '—');
  });

  it('convierte a centavos enteros y de vuelta sin errores de redondeo', () => {
    assert.equal(aCentavos('0.1') + aCentavos('0.2'), 30);
    assert.equal(desdeCentavos(aCentavos('25999.99') * 2), '51999.98');
  });

  it('traduce los estados de una venta a texto para el cliente', () => {
    assert.equal(etiquetaEstadoVenta('PENDIENTE_VALIDACION').texto, 'Transferencia en revisión');
    assert.equal(etiquetaEstadoVenta('DESCONOCIDO').texto, 'DESCONOCIDO');
  });
});
