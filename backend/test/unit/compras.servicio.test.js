// RF 07: proveedores, órdenes de compra en GTQ (PA-11) y recepción de mercancía.
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { crearServicioCatalogo } from '../../src/modulos/catalogo/catalogo.servicio.js';
import { crearServicioCompras } from '../../src/modulos/compras/compras.servicio.js';
import { crearBaseFalsa } from '../ayudantes/base-falsa.js';

const ADMIN = 1;
const unidad = (vin) => ({ vin, anio: 2026, color: 'Blanco', precio: '32000.00' });

describe('RF 07 · proveedores y compras', () => {
  let base;
  let catalogo;
  let compras;
  let modelo;
  let casco;
  let proveedor;

  const crearOrden = (detalles) => compras.crearOrden({ proveedorId: proveedor.id, detalles }, ADMIN);
  const ordenEnviada = async () => {
    const orden = await crearOrden([
      { modeloId: modelo.id, cantidad: 3, costoUnitario: '24000.50' },
      { accesorioId: casco.id, cantidad: 10, costoUnitario: '300.00' },
    ]);
    await compras.cambiarEstadoOrden(orden.id, { estado: 'ENVIADA' });
    return orden;
  };

  beforeEach(async () => {
    base = crearBaseFalsa();
    catalogo = crearServicioCatalogo({ datos: base });
    compras = crearServicioCompras({ datos: base });
    const marca = await catalogo.crearMarca({ nombre: 'Kawasaki' });
    modelo = await catalogo.crearModelo({ marcaId: marca.id, nombre: 'Ninja 400', cilindrada: 399 });
    casco = await catalogo.crearAccesorio({ sku: 'CAS-1', nombre: 'Casco', precio: '500' });
    proveedor = await compras.crearProveedor({ nombre: 'Kawasaki Motors Japan', tipo: 'INTERNACIONAL', pais: 'Japón' });
  });

  describe('proveedores', () => {
    it('un proveedor local toma Guatemala como país y valida el NIT', async () => {
      const local = await compras.crearProveedor({ nombre: 'Distribuidora GT', tipo: 'LOCAL', nit: '1234567-8' });
      assert.equal(local.pais, 'Guatemala');
      await assert.rejects(compras.crearProveedor({ nombre: 'X', tipo: 'LOCAL', nit: 'ABC' }), { estado: 400 });
    });

    it('un proveedor internacional necesita país', async () => {
      await assert.rejects(compras.crearProveedor({ nombre: 'X', tipo: 'INTERNACIONAL' }), { estado: 400 });
    });

    it('rechaza un tipo desconocido', async () => {
      await assert.rejects(compras.crearProveedor({ nombre: 'X', tipo: 'MAYORISTA', pais: 'Perú' }), { estado: 400 });
    });
  });

  describe('órdenes de compra', () => {
    it('calcula el total en GTQ sin errores de redondeo (RN 6)', async () => {
      const orden = await crearOrden([
        { modeloId: modelo.id, cantidad: 3, costoUnitario: '10000.10' },
        { accesorioId: casco.id, cantidad: 3, costoUnitario: '0.10' },
      ]);
      assert.equal(orden.total, '30000.60');
      assert.equal(orden.estado, 'BORRADOR');
    });

    for (const [caso, detalles] of [
      ['sin líneas', []],
      ['una línea con modelo y accesorio a la vez', [{ modeloId: 1, accesorioId: 1, cantidad: 1, costoUnitario: '1' }]],
      ['una línea sin artículo', [{ cantidad: 1, costoUnitario: '1' }]],
      ['cantidad cero', [{ modeloId: 1, cantidad: 0, costoUnitario: '1' }]],
      ['costo negativo', [{ modeloId: 1, cantidad: 1, costoUnitario: '-1' }]],
      ['el mismo artículo repetido', [
        { modeloId: 1, cantidad: 1, costoUnitario: '1' },
        { modeloId: 1, cantidad: 2, costoUnitario: '1' },
      ]],
    ]) {
      it(`rechaza una orden con ${caso}`, async () => {
        await assert.rejects(crearOrden(detalles), { estado: 400 });
      });
    }

    it('rechaza un modelo inexistente con 404', async () => {
      await assert.rejects(crearOrden([{ modeloId: 999, cantidad: 1, costoUnitario: '1' }]), { estado: 404 });
    });

    it('no permite comprar a un proveedor inactivo', async () => {
      await compras.actualizarProveedor(proveedor.id, { activo: false });
      await assert.rejects(crearOrden([{ modeloId: modelo.id, cantidad: 1, costoUnitario: '1' }]), { estado: 409 });
    });

    it('sigue el flujo Borrador → Enviada y permite cancelar antes de recibir', async () => {
      const orden = await crearOrden([{ modeloId: modelo.id, cantidad: 1, costoUnitario: '1' }]);
      await assert.rejects(compras.cambiarEstadoOrden(orden.id, { estado: 'RECIBIDA' }), { estado: 409 });
      assert.equal((await compras.cambiarEstadoOrden(orden.id, { estado: 'ENVIADA' })).estado, 'ENVIADA');
      assert.equal((await compras.cambiarEstadoOrden(orden.id, { estado: 'CANCELADA' })).estado, 'CANCELADA');
    });
  });

  describe('recepción de mercancía', () => {
    it('no se recibe una orden en Borrador', async () => {
      const orden = await crearOrden([{ modeloId: modelo.id, cantidad: 1, costoUnitario: '1' }]);
      const detalleId = (await compras.obtenerOrden(orden.id)).detalles[0].id;
      await assert.rejects(
        compras.recibirMercancia(orden.id, { lineas: [{ detalleId, motocicletas: [unidad('JKAEX8A10NA000001')] }] }, ADMIN),
        { estado: 409 },
      );
    });

    it('una recepción parcial crea las motos Disponibles con su costo y deja la orden parcialmente recibida', async () => {
      const orden = await ordenEnviada();
      const [lineaMotos, lineaCascos] = (await compras.obtenerOrden(orden.id)).detalles;

      const resultado = await compras.recibirMercancia(
        orden.id,
        {
          lineas: [
            { detalleId: lineaMotos.id, motocicletas: [unidad('JKAEX8A10NA000001'), unidad('JKAEX8A10NA000002')] },
            { detalleId: lineaCascos.id, cantidad: 4 },
          ],
        },
        ADMIN,
      );

      assert.equal(resultado.orden.estado, 'RECIBIDA_PARCIAL');
      assert.equal(base.tablas().motocicletas.length, 2);
      assert.equal(resultado.motocicletas.length, 2);
      assert.ok(resultado.motocicletas.every((m) => m.estado === 'DISPONIBLE' && m.costoAdquisicion === '24000.50'));
      assert.equal(base.tablas().accesorios[0].stock, 4);
      const compras_ = base.tablas().movimientos.filter((m) => m.motivo === 'COMPRA');
      assert.equal(compras_.length, 3); // una por cada moto y una por el lote de cascos
    });

    it('al recibir todo lo pendiente la orden queda Recibida', async () => {
      const orden = await ordenEnviada();
      const [lineaMotos, lineaCascos] = (await compras.obtenerOrden(orden.id)).detalles;
      const motos = ['JKAEX8A10NA000001', 'JKAEX8A10NA000002', 'JKAEX8A10NA000003'].map(unidad);
      const { orden: final } = await compras.recibirMercancia(
        orden.id,
        { lineas: [{ detalleId: lineaMotos.id, motocicletas: motos }, { detalleId: lineaCascos.id, cantidad: 10 }] },
        ADMIN,
      );
      assert.equal(final.estado, 'RECIBIDA');
    });

    it('no permite recibir más de lo pedido', async () => {
      const orden = await ordenEnviada();
      const [, lineaCascos] = (await compras.obtenerOrden(orden.id)).detalles;
      await assert.rejects(
        compras.recibirMercancia(orden.id, { lineas: [{ detalleId: lineaCascos.id, cantidad: 11 }] }, ADMIN),
        { estado: 409 },
      );
    });

    it('RN 1: un VIN ya registrado cancela toda la recepción', async () => {
      await catalogo.crearMotocicleta(
        { vin: 'JKAEX8A10NA000002', modeloId: modelo.id, anio: 2026, color: 'Verde', precio: '1' },
        ADMIN,
      );
      const orden = await ordenEnviada();
      const [lineaMotos, lineaCascos] = (await compras.obtenerOrden(orden.id)).detalles;

      await assert.rejects(
        compras.recibirMercancia(
          orden.id,
          {
            lineas: [
              { detalleId: lineaCascos.id, cantidad: 5 },
              { detalleId: lineaMotos.id, motocicletas: [unidad('JKAEX8A10NA000001'), unidad('JKAEX8A10NA000002')] },
            ],
          },
          ADMIN,
        ),
        { estado: 409 },
      );
      assert.equal(base.tablas().motocicletas.length, 1);
      assert.equal(base.tablas().accesorios[0].stock, 0);
      assert.equal((await compras.obtenerOrden(orden.id)).estado, 'ENVIADA');
    });

    it('rechaza el mismo VIN dos veces en una recepción', async () => {
      const orden = await ordenEnviada();
      const [lineaMotos] = (await compras.obtenerOrden(orden.id)).detalles;
      await assert.rejects(
        compras.recibirMercancia(
          orden.id,
          { lineas: [{ detalleId: lineaMotos.id, motocicletas: [unidad('JKAEX8A10NA000001'), unidad('jkaex8a10na000001')] }] },
          ADMIN,
        ),
        { estado: 400 },
      );
    });

    it('rechaza una línea que no pertenece a la orden', async () => {
      const orden = await ordenEnviada();
      await assert.rejects(
        compras.recibirMercancia(orden.id, { lineas: [{ detalleId: 999, cantidad: 1 }] }, ADMIN),
        { estado: 400 },
      );
    });

    it('una orden con mercancía recibida ya no se puede cancelar', async () => {
      const orden = await ordenEnviada();
      const [, lineaCascos] = (await compras.obtenerOrden(orden.id)).detalles;
      await compras.recibirMercancia(orden.id, { lineas: [{ detalleId: lineaCascos.id, cantidad: 1 }] }, ADMIN);
      await assert.rejects(compras.cambiarEstadoOrden(orden.id, { estado: 'CANCELADA' }), { estado: 409 });
    });
  });
});
