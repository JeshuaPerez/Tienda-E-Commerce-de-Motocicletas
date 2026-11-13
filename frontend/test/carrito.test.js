// PA-10: el carrito vive en el navegador; al pagar se envía al backend como lista de artículos.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  carritoVacio, agregarMoto, agregarAccesorio, cambiarCantidad, quitarMoto, contarArticulos,
  subtotalEstimado, aItems, leerCarrito,
} from '../src/logica/carrito.js';

const moto = { id: 7, vin: 'ME1RG0710P0000001', titulo: 'Yamaha FZ 2.0 2026', precio: '25999.99' };
const casco = { id: 3, sku: 'CAS-1', nombre: 'Casco', precio: '450.00', stock: 4 };

describe('carrito en el navegador', () => {
  it('agrega una moto una sola vez (cada VIN es una unidad única)', () => {
    let c = agregarMoto(carritoVacio(), moto);
    c = agregarMoto(c, moto);
    assert.equal(c.motos.length, 1);
  });

  it('suma accesorios sin superar el stock disponible', () => {
    let c = agregarAccesorio(carritoVacio(), casco, 3);
    c = agregarAccesorio(c, casco, 3);
    assert.equal(c.accesorios[0].cantidad, 4);
  });

  it('cambiar la cantidad a 0 quita el accesorio', () => {
    const c = cambiarCantidad(agregarAccesorio(carritoVacio(), casco, 2), casco.id, 0);
    assert.equal(c.accesorios.length, 0);
  });

  it('no modifica el carrito original (inmutable)', () => {
    const original = carritoVacio();
    agregarMoto(original, moto);
    assert.equal(original.motos.length, 0);
  });

  it('cuenta artículos y estima el subtotal en centavos exactos', () => {
    const c = agregarAccesorio(agregarMoto(carritoVacio(), moto), casco, 2);
    assert.equal(contarArticulos(c), 3);
    assert.equal(subtotalEstimado(c), '26899.99');
  });

  it('se convierte en los items que espera POST /api/checkout', () => {
    const c = agregarAccesorio(agregarMoto(carritoVacio(), moto), casco, 2);
    assert.deepEqual(aItems(c), [{ motocicletaId: 7 }, { accesorioId: 3, cantidad: 2 }]);
  });

  it('quitar una moto la saca del carrito', () => {
    assert.equal(quitarMoto(agregarMoto(carritoVacio(), moto), moto.id).motos.length, 0);
  });

  it('un valor guardado dañado o ajeno se ignora y deja el carrito vacío', () => {
    assert.deepEqual(leerCarrito('{no es json'), carritoVacio());
    assert.deepEqual(leerCarrito(JSON.stringify({ motos: 'x' })), carritoVacio());
    assert.deepEqual(leerCarrito(null), carritoVacio());
    const valido = agregarMoto(carritoVacio(), moto);
    assert.deepEqual(leerCarrito(JSON.stringify(valido)), valido);
  });
});
