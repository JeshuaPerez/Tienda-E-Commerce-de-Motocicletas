// RF 02 (catálogo) y regla de negocio 1 (VIN único e irrepetible).
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { crearServicioCatalogo } from '../../src/modulos/catalogo/catalogo.servicio.js';
import { crearBaseFalsa } from '../ayudantes/base-falsa.js';

const ADMIN = 1;
const VIN = '1HGBH41JXMN109186';

describe('RF 02 · catálogo de motocicletas', () => {
  let base;
  let catalogo;
  let modelo;

  const crearMoto = (cambios = {}) =>
    catalogo.crearMotocicleta(
      { vin: VIN, modeloId: modelo.id, anio: 2026, color: 'Rojo', precio: '25999.99', ...cambios },
      ADMIN,
    );

  beforeEach(async () => {
    base = crearBaseFalsa();
    catalogo = crearServicioCatalogo({ datos: base });
    const marca = await catalogo.crearMarca({ nombre: 'Yamaha' });
    modelo = await catalogo.crearModelo({ marcaId: marca.id, nombre: 'MT-03', cilindrada: 321, stockMinimo: 2 });
  });

  describe('RN 1 · VIN único e irrepetible', () => {
    it('registra la moto Disponible y deja una ENTRADA en el inventario', async () => {
      const moto = await crearMoto();
      assert.equal(moto.estado, 'DISPONIBLE');
      assert.equal(moto.precio, '25999.99');
      const [movimiento] = base.tablas().movimientos;
      assert.deepEqual(
        { tipo: movimiento.tipo, motivo: movimiento.motivo, motocicletaId: movimiento.motocicletaId, cantidad: movimiento.cantidad },
        { tipo: 'ENTRADA', motivo: 'ALTA_MANUAL', motocicletaId: moto.id, cantidad: 1 },
      );
    });

    it('rechaza un VIN repetido con 409', async () => {
      await crearMoto();
      await assert.rejects(crearMoto({ color: 'Azul' }), { estado: 409 });
    });

    it('normaliza el VIN: minúsculas y espacios no evitan el duplicado', async () => {
      await crearMoto();
      await assert.rejects(crearMoto({ vin: ` ${VIN.toLowerCase()} ` }), { estado: 409 });
    });

    for (const [caso, vin] of [
      ['con menos de 17 caracteres', '1HGBH41JXMN10918'],
      ['con las letras I, O o Q, que el estándar prohíbe', '1HGBH41JXMN1091O6'],
      ['vacío', ''],
    ]) {
      it(`rechaza un VIN ${caso}`, async () => {
        await assert.rejects(crearMoto({ vin }), { estado: 400 });
      });
    }

    it('no permite cambiar el VIN al editar', async () => {
      const moto = await crearMoto();
      await assert.rejects(catalogo.actualizarMotocicleta(moto.id, { vin: '2HGBH41JXMN109186' }), { estado: 400 });
    });

    it('si falla el registro no queda ningún movimiento suelto', async () => {
      await crearMoto();
      await crearMoto().catch(() => {});
      assert.equal(base.tablas().movimientos.length, 1);
    });
  });

  describe('datos de la moto', () => {
    for (const [caso, cambio] of [
      ['un precio negativo', { precio: '-5' }],
      ['un precio con más de dos decimales', { precio: '100.005' }],
      ['un precio que no es número', { precio: 'mil' }],
      ['un año fuera de rango', { anio: 1800 }],
      ['un modelo inexistente', { modeloId: 999 }],
    ]) {
      it(`rechaza ${caso}`, async () => {
        const error = await crearMoto(cambio).catch((e) => e);
        assert.ok([400, 404].includes(error.estado), `estado ${error.estado}`);
      });
    }
  });

  describe('estados (Disponible, Reservada, Vendida)', () => {
    it('permite reservar y liberar manualmente', async () => {
      const moto = await crearMoto();
      assert.equal((await catalogo.cambiarEstado(moto.id, { estado: 'RESERVADA' })).estado, 'RESERVADA');
      assert.equal((await catalogo.cambiarEstado(moto.id, { estado: 'DISPONIBLE' })).estado, 'DISPONIBLE');
    });

    it('no permite marcar como Vendida a mano: eso solo lo hace una venta', async () => {
      const moto = await crearMoto();
      await assert.rejects(catalogo.cambiarEstado(moto.id, { estado: 'VENDIDA' }), { estado: 409 });
    });

    it('una moto vendida no se puede editar ni cambiar de estado', async () => {
      const moto = await crearMoto();
      base.tablas().motocicletas[0].estado = 'VENDIDA';
      await assert.rejects(catalogo.actualizarMotocicleta(moto.id, { precio: '1.00' }), { estado: 409 });
      await assert.rejects(catalogo.cambiarEstado(moto.id, { estado: 'DISPONIBLE' }), { estado: 409 });
    });

    it('rechaza un estado desconocido', async () => {
      const moto = await crearMoto();
      await assert.rejects(catalogo.cambiarEstado(moto.id, { estado: 'PERDIDA' }), { estado: 400 });
    });
  });

  describe('catálogo público con filtros (marca, cilindrada, precio)', () => {
    beforeEach(async () => {
      const honda = await catalogo.crearMarca({ nombre: 'Honda' });
      const cb500 = await catalogo.crearModelo({ marcaId: honda.id, nombre: 'CB500F', cilindrada: 471 });
      await crearMoto({ vin: 'JH2PC40A0XM000001', precio: '25000.00' });
      await crearMoto({ vin: 'JH2PC40A0XM000002', precio: '30000.00', costoAdquisicion: '21000.00' });
      await crearMoto({ vin: 'JH2PC40A0XM000003', modeloId: cb500.id, precio: '45000.00' });
      const reservada = await crearMoto({ vin: 'JH2PC40A0XM000004', precio: '26000.00' });
      await catalogo.cambiarEstado(reservada.id, { estado: 'RESERVADA' });
    });

    it('solo muestra motos Disponibles', async () => {
      const { motocicletas, total } = await catalogo.listarCatalogo({});
      assert.equal(total, 3);
      assert.ok(motocicletas.every((m) => m.estado === 'DISPONIBLE'));
    });

    it('filtra por marca, cilindrada y rango de precio', async () => {
      const honda = (await catalogo.listarMarcas()).find((m) => m.nombre === 'Honda');
      assert.equal((await catalogo.listarCatalogo({ marcaId: String(honda.id) })).total, 1);
      assert.equal((await catalogo.listarCatalogo({ cilindradaMin: '400' })).total, 1);
      assert.equal((await catalogo.listarCatalogo({ precioMin: '26000', precioMax: '45000' })).total, 2);
    });

    it('rechaza filtros con valores inválidos', async () => {
      await assert.rejects(catalogo.listarCatalogo({ precioMin: 'barato' }), { estado: 400 });
      await assert.rejects(catalogo.listarCatalogo({ cilindradaMin: '-1' }), { estado: 400 });
    });

    it('no expone el costo de adquisición al público', async () => {
      const { motocicletas } = await catalogo.listarCatalogo({});
      assert.ok(motocicletas.every((m) => !('costoAdquisicion' in m)));
      assert.ok(motocicletas[0].modelo.marca.nombre);
    });
  });

  describe('marcas y modelos', () => {
    it('rechaza una marca repetida sin importar mayúsculas', async () => {
      await assert.rejects(catalogo.crearMarca({ nombre: 'YAMAHA' }), { estado: 409 });
    });

    it('rechaza un modelo repetido en la misma marca, pero lo permite en otra', async () => {
      await assert.rejects(
        catalogo.crearModelo({ marcaId: modelo.marca.id, nombre: 'mt-03', cilindrada: 321 }),
        { estado: 409 },
      );
      const otra = await catalogo.crearMarca({ nombre: 'Genérica' });
      await catalogo.crearModelo({ marcaId: otra.id, nombre: 'MT-03', cilindrada: 150 });
    });

    it('exige cilindrada positiva', async () => {
      await assert.rejects(
        catalogo.crearModelo({ marcaId: modelo.marca.id, nombre: 'X', cilindrada: 0 }),
        { estado: 400 },
      );
    });
  });

  describe('accesorios (PA-1)', () => {
    it('se crean con SKU único, stock 0 y precio en GTQ', async () => {
      const casco = await catalogo.crearAccesorio({ sku: 'cas-001', nombre: 'Casco', precio: '850.50', stockMinimo: 3 });
      assert.equal(casco.sku, 'CAS-001');
      assert.equal(casco.stock, 0);
      assert.equal(casco.precio, '850.50');
      await assert.rejects(catalogo.crearAccesorio({ sku: 'CAS-001', nombre: 'Otro', precio: '1' }), { estado: 409 });
    });

    it('el stock no se edita directamente: solo con compras o ajustes', async () => {
      const casco = await catalogo.crearAccesorio({ sku: 'CAS-001', nombre: 'Casco', precio: '850.50' });
      await assert.rejects(catalogo.actualizarAccesorio(casco.id, { stock: 50 }), { estado: 400 });
    });
  });
});
