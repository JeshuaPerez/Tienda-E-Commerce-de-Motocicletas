// Fase 2 contra PostgreSQL real (base _test): restricciones de la base y transacciones.
// Se omite si no hay DATABASE_URL_TEST en backend/.env.
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { obtenerPrisma, desconectarPrisma } from '../../src/db/prisma.js';
import { crearDatos } from '../../src/db/repositorios.js';
import { crearServicioCatalogo } from '../../src/modulos/catalogo/catalogo.servicio.js';
import { crearServicioCompras } from '../../src/modulos/compras/compras.servicio.js';
import { crearServicioInventario } from '../../src/modulos/inventario/inventario.servicio.js';

const hayBaseDePruebas = Boolean(process.env.DATABASE_URL_TEST);
const TABLAS = [
  'movimientos_inventario', 'motocicletas', 'recepciones', 'ordenes_compra_detalle', 'ordenes_compra',
  'proveedores', 'accesorios', 'modelos', 'marcas', 'clientes', 'usuarios',
];

describe('Fase 2 · integración con PostgreSQL', { skip: !hayBaseDePruebas && 'falta DATABASE_URL_TEST' }, () => {
  let prisma;
  let catalogo;
  let compras;
  let inventario;
  let adminId;
  let modelo;
  let casco;

  before(() => {
    assert.ok(new URL(process.env.DATABASE_URL).pathname.endsWith('_test'), 'la base de pruebas debe terminar en _test');
    prisma = obtenerPrisma();
    const datos = crearDatos(prisma);
    catalogo = crearServicioCatalogo({ datos });
    compras = crearServicioCompras({ datos });
    inventario = crearServicioInventario({ datos });
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${TABLAS.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`);
    adminId = (await prisma.usuario.create({
      data: { nombre: 'Admin', correo: 'admin@motostore.gt', hashContrasena: 'x', rol: 'ADMINISTRADOR' },
    })).id;
    const marca = await catalogo.crearMarca({ nombre: 'Honda' });
    modelo = await catalogo.crearModelo({ marcaId: marca.id, nombre: 'XR190L', cilindrada: 184, stockMinimo: 1 });
    casco = await catalogo.crearAccesorio({ sku: 'CAS-1', nombre: 'Casco', precio: '500.00' });
  });

  after(() => desconectarPrisma());

  const unidad = (vin) => ({ vin, anio: 2026, color: 'Rojo', precio: '23500.00' });

  it('RN 1: el índice único de la base rechaza un VIN repetido aunque se salte el servicio', async () => {
    await catalogo.crearMotocicleta({ ...unidad('ME4KC0910P8000001'), modeloId: modelo.id }, adminId);
    await assert.rejects(
      prisma.motocicleta.create({ data: { ...unidad('ME4KC0910P8000001'), modeloId: modelo.id } }),
      (error) => error.code === 'P2002',
    );
  });

  it('la restricción CHECK impide un stock negativo directamente en la base', async () => {
    await assert.rejects(prisma.accesorio.update({ where: { id: casco.id }, data: { stock: -1 } }));
  });

  it('el catálogo filtra por marca, cilindrada y precio con datos reales', async () => {
    await catalogo.crearMotocicleta({ ...unidad('ME4KC0910P8000001'), modeloId: modelo.id }, adminId);
    const { total, motocicletas } = await catalogo.listarCatalogo({ cilindradaMin: '150', precioMax: '25000' });
    assert.equal(total, 1);
    assert.equal(motocicletas[0].precio, '23500.00');
  });

  it('una recepción con un VIN repetido se revierte completa (transacción)', async () => {
    await catalogo.crearMotocicleta({ ...unidad('ME4KC0910P8000002'), modeloId: modelo.id }, adminId);
    const proveedor = await compras.crearProveedor({ nombre: 'Honda GT', tipo: 'LOCAL', nit: '1234567-8' });
    const orden = await compras.crearOrden({
      proveedorId: proveedor.id,
      detalles: [
        { modeloId: modelo.id, cantidad: 2, costoUnitario: '18000.00' },
        { accesorioId: casco.id, cantidad: 5, costoUnitario: '200.00' },
      ],
    }, adminId);
    await compras.cambiarEstadoOrden(orden.id, { estado: 'ENVIADA' });
    const [lineaMotos, lineaCascos] = orden.detalles;

    await assert.rejects(
      compras.recibirMercancia(orden.id, {
        lineas: [
          { detalleId: lineaCascos.id, cantidad: 5 },
          { detalleId: lineaMotos.id, motocicletas: [unidad('ME4KC0910P8000001'), unidad('ME4KC0910P8000002')] },
        ],
      }, adminId),
      { estado: 409 },
    );

    assert.equal(await prisma.motocicleta.count(), 1);
    assert.equal((await prisma.accesorio.findUnique({ where: { id: casco.id } })).stock, 0);
    assert.equal(await prisma.recepcion.count(), 0);
    assert.equal((await compras.obtenerOrden(orden.id)).estado, 'ENVIADA');
  });

  it('dos recepciones simultáneas no superan lo pedido (bloqueo de la orden)', async () => {
    const proveedor = await compras.crearProveedor({ nombre: 'Honda GT', tipo: 'LOCAL' });
    const orden = await compras.crearOrden({
      proveedorId: proveedor.id,
      detalles: [{ accesorioId: casco.id, cantidad: 5, costoUnitario: '200.00' }],
    }, adminId);
    await compras.cambiarEstadoOrden(orden.id, { estado: 'ENVIADA' });
    const detalleId = orden.detalles[0].id;

    const resultados = await Promise.allSettled([
      compras.recibirMercancia(orden.id, { lineas: [{ detalleId, cantidad: 4 }] }, adminId),
      compras.recibirMercancia(orden.id, { lineas: [{ detalleId, cantidad: 4 }] }, adminId),
    ]);
    assert.deepEqual(resultados.map((r) => r.status).sort(), ['fulfilled', 'rejected']);
    assert.equal((await prisma.accesorio.findUnique({ where: { id: casco.id } })).stock, 4);
  });

  it('un ajuste que dejaría stock negativo no cambia nada', async () => {
    await assert.rejects(
      inventario.ajustarAccesorio({ accesorioId: casco.id, cantidad: -1, referencia: 'Prueba' }, adminId),
      { estado: 409 },
    );
    assert.equal(await prisma.movimientoInventario.count(), 0);
  });
});
