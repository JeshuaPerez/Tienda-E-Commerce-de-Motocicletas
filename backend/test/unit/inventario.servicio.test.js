// RF 06: stock por VIN, alertas de stock bajo y entradas/salidas.
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { crearServicioCatalogo } from '../../src/modulos/catalogo/catalogo.servicio.js';
import { crearServicioInventario } from '../../src/modulos/inventario/inventario.servicio.js';
import { crearBaseFalsa } from '../ayudantes/base-falsa.js';

const ADMIN = 1;

describe('RF 06 · inventario', () => {
  let base;
  let catalogo;
  let inventario;
  let modelo;
  let casco;

  const crearMoto = (vin) =>
    catalogo.crearMotocicleta({ vin, modeloId: modelo.id, anio: 2026, color: 'Negro', precio: '20000' }, ADMIN);

  beforeEach(async () => {
    base = crearBaseFalsa();
    catalogo = crearServicioCatalogo({ datos: base });
    inventario = crearServicioInventario({ datos: base });
    const marca = await catalogo.crearMarca({ nombre: 'Suzuki' });
    modelo = await catalogo.crearModelo({ marcaId: marca.id, nombre: 'GN125', cilindrada: 125, stockMinimo: 2 });
    casco = await catalogo.crearAccesorio({ sku: 'CAS-1', nombre: 'Casco', precio: '500', stockMinimo: 5 });
  });

  describe('alertas de stock bajo', () => {
    it('alerta cuando las unidades disponibles llegan al mínimo del modelo', async () => {
      await crearMoto('JS1GN7DA0A0000001');
      await crearMoto('JS1GN7DA0A0000002');
      const { modelos } = await inventario.obtenerAlertas();
      assert.equal(modelos.length, 1);
      assert.equal(modelos[0].disponibles, 2);
    });

    it('no alerta cuando hay más unidades que el mínimo', async () => {
      for (const n of [1, 2, 3]) await crearMoto(`JS1GN7DA0A000000${n}`);
      assert.equal((await inventario.obtenerAlertas()).modelos.length, 0);
    });

    it('las motos reservadas no cuentan como disponibles', async () => {
      for (const n of [1, 2, 3]) await crearMoto(`JS1GN7DA0A000000${n}`);
      const moto = (await catalogo.listarMotocicletasAdmin({})).motocicletas[0];
      await catalogo.cambiarEstado(moto.id, { estado: 'RESERVADA' });
      const [alerta] = (await inventario.obtenerAlertas()).modelos;
      assert.equal(alerta.disponibles, 2);
      assert.equal(alerta.reservadas, 1);
    });

    it('un stock mínimo de 0 desactiva la alerta del modelo', async () => {
      await catalogo.actualizarModelo(modelo.id, { stockMinimo: 0 });
      assert.equal((await inventario.obtenerAlertas()).modelos.length, 0);
    });

    it('alerta los accesorios con stock en el mínimo o debajo', async () => {
      const { accesorios } = await inventario.obtenerAlertas();
      assert.equal(accesorios[0].sku, 'CAS-1');
    });
  });

  describe('ajustes de accesorios (entradas y salidas)', () => {
    it('una entrada suma stock y deja un movimiento ENTRADA/AJUSTE', async () => {
      const resultado = await inventario.ajustarAccesorio({ accesorioId: casco.id, cantidad: 10, referencia: 'Conteo físico' }, ADMIN);
      assert.equal(resultado.accesorio.stock, 10);
      const movimiento = base.tablas().movimientos.at(-1);
      assert.equal(movimiento.tipo, 'ENTRADA');
      assert.equal(movimiento.motivo, 'AJUSTE');
      assert.equal(movimiento.cantidad, 10);
    });

    it('una salida resta stock y registra SALIDA con cantidad positiva', async () => {
      await inventario.ajustarAccesorio({ accesorioId: casco.id, cantidad: 10, referencia: 'Conteo' }, ADMIN);
      const { accesorio } = await inventario.ajustarAccesorio({ accesorioId: casco.id, cantidad: -3, referencia: 'Dañados' }, ADMIN);
      assert.equal(accesorio.stock, 7);
      const movimiento = base.tablas().movimientos.at(-1);
      assert.equal(movimiento.tipo, 'SALIDA');
      assert.equal(movimiento.cantidad, 3);
    });

    it('no deja el stock en negativo y no registra nada', async () => {
      const movimientosAntes = base.tablas().movimientos.length;
      await assert.rejects(
        inventario.ajustarAccesorio({ accesorioId: casco.id, cantidad: -1, referencia: 'Robo' }, ADMIN),
        { estado: 409 },
      );
      assert.equal(base.tablas().movimientos.length, movimientosAntes);
    });

    it('exige cantidad distinta de cero y un motivo', async () => {
      await assert.rejects(inventario.ajustarAccesorio({ accesorioId: casco.id, cantidad: 0, referencia: 'x' }, ADMIN), { estado: 400 });
      await assert.rejects(inventario.ajustarAccesorio({ accesorioId: casco.id, cantidad: 2 }, ADMIN), { estado: 400 });
    });
  });

  it('el resumen muestra disponibles, reservadas y vendidas por modelo', async () => {
    await crearMoto('JS1GN7DA0A0000001');
    base.tablas().motocicletas[0].estado = 'VENDIDA';
    await crearMoto('JS1GN7DA0A0000002');
    const { modelos } = await inventario.obtenerResumen();
    assert.deepEqual(
      { disponibles: modelos[0].disponibles, reservadas: modelos[0].reservadas, vendidas: modelos[0].vendidas },
      { disponibles: 1, reservadas: 0, vendidas: 1 },
    );
  });

  it('lista los movimientos filtrando por tipo', async () => {
    await crearMoto('JS1GN7DA0A0000001');
    await inventario.ajustarAccesorio({ accesorioId: casco.id, cantidad: 4, referencia: 'Inicial' }, ADMIN);
    const { movimientos, total } = await inventario.listarMovimientos({ tipo: 'ENTRADA' });
    assert.equal(total, 2);
    assert.equal(movimientos.length, 2);
    await assert.rejects(inventario.listarMovimientos({ tipo: 'OTRO' }), { estado: 400 });
  });
});
