// Fase 3 contra PostgreSQL real (base _test): concurrencia de ventas (RN 2, PA-9), una sola caja abierta
// y límite de usos de cupones. Se omite si no hay DATABASE_URL_TEST en backend/.env.
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { obtenerPrisma, desconectarPrisma } from '../../src/db/prisma.js';
import { crearDatos } from '../../src/db/repositorios.js';
import { crearServicioCatalogo } from '../../src/modulos/catalogo/catalogo.servicio.js';
import { crearServicioCaja } from '../../src/modulos/caja/caja.servicio.js';
import { crearServicioCupones } from '../../src/modulos/cupones/cupones.servicio.js';
import { crearServicioVentas } from '../../src/modulos/ventas/ventas.servicio.js';
import { crearServicioPos } from '../../src/modulos/pos/pos.servicio.js';
import { crearAlmacenFalso } from '../ayudantes/escenario-ventas.js';

const hayBaseDePruebas = Boolean(process.env.DATABASE_URL_TEST);

describe('Fase 3 · integración con PostgreSQL', { skip: !hayBaseDePruebas && 'falta DATABASE_URL_TEST' }, () => {
  let prisma;
  let s;
  let adminId;
  let clientes;
  let moto;

  before(() => {
    assert.ok(new URL(process.env.DATABASE_URL).pathname.endsWith('_test'), 'la base de pruebas debe terminar en _test');
    prisma = obtenerPrisma();
    const datos = crearDatos(prisma);
    s = {
      catalogo: crearServicioCatalogo({ datos }),
      caja: crearServicioCaja({ datos }),
      cupones: crearServicioCupones({ datos }),
      ventas: crearServicioVentas({ datos, almacen: crearAlmacenFalso() }),
      pos: crearServicioPos({ datos }),
    };
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "usuarios", "marcas", "accesorios", "cupones", "proveedores" RESTART IDENTITY CASCADE');
    adminId = (await prisma.usuario.create({ data: { nombre: 'Admin', correo: 'admin@motostore.gt', hashContrasena: 'x', rol: 'ADMINISTRADOR' } })).id;
    clientes = [];
    for (const n of [1, 2]) {
      const usuario = await prisma.usuario.create({
        data: { nombre: `Cliente ${n}`, correo: `c${n}@correo.com`, hashContrasena: 'x', cliente: { create: { nombre: `Cliente ${n}` } } },
      });
      clientes.push(usuario.id);
    }
    const marca = await s.catalogo.crearMarca({ nombre: 'Suzuki' });
    const modelo = await s.catalogo.crearModelo({ marcaId: marca.id, nombre: 'Gixxer', cilindrada: 155 });
    moto = await s.catalogo.crearMotocicleta({ vin: 'MB8NG4BB0P8000001', modeloId: modelo.id, anio: 2026, color: 'Gris', precio: '22400.00' }, adminId);
  });

  after(() => desconectarPrisma());

  const pedidoWeb = (usuarioId) =>
    s.ventas.checkout({ items: [{ motocicletaId: moto.id }], metodoPago: 'TRANSFERENCIA' }, usuarioId);

  it('RN 2: dos compras web simultáneas del mismo VIN → solo una lo reserva', async () => {
    const resultados = await Promise.allSettled([pedidoWeb(clientes[0]), pedidoWeb(clientes[1])]);
    assert.deepEqual(resultados.map((r) => r.status).sort(), ['fulfilled', 'rejected']);
    assert.equal(resultados.find((r) => r.status === 'rejected').reason.estado, 409);
    assert.equal(await prisma.venta.count(), 1);
    assert.equal((await prisma.motocicleta.findUnique({ where: { id: moto.id } })).estado, 'RESERVADA');
  });

  it('RN 2 + PA-9: una venta web y una del POS a la vez → solo una se queda la moto', async () => {
    await s.caja.abrir({ montoInicial: '0' }, adminId);
    const resultados = await Promise.allSettled([
      pedidoWeb(clientes[0]),
      s.pos.registrarVenta({ cliente: { nombre: 'Mostrador' }, items: [{ motocicletaId: moto.id }], pago: { metodo: 'EFECTIVO' } }, adminId),
    ]);
    assert.equal(resultados.filter((r) => r.status === 'fulfilled').length, 1);
    // La que pierde debe fallar por la regla de negocio (409), no por un error inesperado.
    assert.equal(resultados.find((r) => r.status === 'rejected').reason.estado, 409);
    assert.equal(await prisma.venta.count(), 1);
  });

  it('RF 04: una venta del POS con base real deja la moto vendida, su salida y el ingreso en caja', async () => {
    await s.caja.abrir({ montoInicial: '0' }, adminId);
    const venta = await s.pos.registrarVenta(
      { cliente: { nombre: 'Mostrador' }, items: [{ motocicletaId: moto.id }], pago: { metodo: 'EFECTIVO' } }, adminId,
    );
    assert.equal(venta.estado, 'PAGADA');
    assert.equal((await prisma.motocicleta.findUnique({ where: { id: moto.id } })).estado, 'VENDIDA');
    assert.equal(await prisma.movimientoInventario.count({ where: { motocicletaId: moto.id, motivo: 'VENTA_POS' } }), 1);
    assert.equal(await prisma.movimientoCaja.count({ where: { ventaId: venta.id, tipo: 'INGRESO' } }), 1);
  });

  it('RF 05: el índice parcial impide dos cajas abiertas aunque se abran a la vez', async () => {
    const resultados = await Promise.allSettled([
      s.caja.abrir({ montoInicial: '0' }, adminId),
      s.caja.abrir({ montoInicial: '0' }, adminId),
    ]);
    assert.deepEqual(resultados.map((r) => r.status).sort(), ['fulfilled', 'rejected']);
    assert.equal(await prisma.sesionCaja.count({ where: { estado: 'ABIERTA' } }), 1);
  });

  it('RF 09: un cupón de un solo uso no se puede usar dos veces a la vez', async () => {
    await s.cupones.crearCupon({ codigo: 'UNICO', tipo: 'MONTO_FIJO', valor: '100', vigenteDesde: '2020-01-01', vigenteHasta: '2099-12-31', usosMaximos: 1 });
    const modelo = (await prisma.modelo.findFirst()).id;
    const otra = await s.catalogo.crearMotocicleta({ vin: 'MB8NG4BB0P8000002', modeloId: modelo, anio: 2026, color: 'Azul', precio: '22400.00' }, adminId);
    const resultados = await Promise.allSettled([
      s.ventas.checkout({ items: [{ motocicletaId: moto.id }], metodoPago: 'TRANSFERENCIA', cuponCodigo: 'UNICO' }, clientes[0]),
      s.ventas.checkout({ items: [{ motocicletaId: otra.id }], metodoPago: 'TRANSFERENCIA', cuponCodigo: 'UNICO' }, clientes[1]),
    ]);
    assert.equal(resultados.filter((r) => r.status === 'fulfilled').length, 1);
    assert.equal((await prisma.cupon.findUnique({ where: { codigo: 'UNICO' } })).usosActuales, 1);
  });

  it('la restricción CHECK exige que el total sea subtotal − descuento', async () => {
    const venta = await pedidoWeb(clientes[0]);
    await assert.rejects(prisma.venta.update({ where: { id: venta.id }, data: { total: '1.00' } }));
  });
});
