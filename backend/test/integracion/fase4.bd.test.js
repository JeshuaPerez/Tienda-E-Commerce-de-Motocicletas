// Fase 4 contra PostgreSQL real (base _test): correlativo sin duplicados, una factura vigente por venta
// y reportes con datos reales. Se omite si no hay DATABASE_URL_TEST en backend/.env.
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { obtenerPrisma, desconectarPrisma } from '../../src/db/prisma.js';
import { crearDatos } from '../../src/db/repositorios.js';
import { crearServicioCatalogo } from '../../src/modulos/catalogo/catalogo.servicio.js';
import { crearServicioCaja } from '../../src/modulos/caja/caja.servicio.js';
import { crearServicioPos } from '../../src/modulos/pos/pos.servicio.js';
import { crearServicioFacturacion } from '../../src/modulos/facturacion/facturacion.servicio.js';
import { crearServicioReportes } from '../../src/modulos/reportes/reportes.servicio.js';
import { crearEmisorInterno } from '../../src/modulos/facturacion/emisor-interno.js';
import { fechaGuatemala } from '../../src/config/negocio.js';

const hayBaseDePruebas = Boolean(process.env.DATABASE_URL_TEST);

describe('Fase 4 · integración con PostgreSQL', { skip: !hayBaseDePruebas && 'falta DATABASE_URL_TEST' }, () => {
  let prisma;
  let s;
  let adminId;
  let motos;

  before(() => {
    assert.ok(new URL(process.env.DATABASE_URL).pathname.endsWith('_test'), 'la base de pruebas debe terminar en _test');
    prisma = obtenerPrisma();
    const datos = crearDatos(prisma);
    const emisor = crearEmisorInterno({ serie: 'T' });
    s = {
      catalogo: crearServicioCatalogo({ datos }),
      caja: crearServicioCaja({ datos }),
      pos: crearServicioPos({ datos, emisor }),
      facturacion: crearServicioFacturacion({ datos, emisor }),
      reportes: crearServicioReportes({ datos }),
    };
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "usuarios", "marcas", "accesorios", "cupones", "proveedores", "series_factura" RESTART IDENTITY CASCADE');
    adminId = (await prisma.usuario.create({ data: { nombre: 'Admin', correo: 'admin@motostore.gt', hashContrasena: 'x', rol: 'ADMINISTRADOR' } })).id;
    const marca = await s.catalogo.crearMarca({ nombre: 'Bajaj' });
    const modelo = await s.catalogo.crearModelo({ marcaId: marca.id, nombre: 'Boxer', cilindrada: 150 });
    motos = [];
    for (const n of [1, 2, 3, 4]) {
      motos.push(await s.catalogo.crearMotocicleta(
        { vin: `MD2A11CZ0PCA0000${n}`, modeloId: modelo.id, anio: 2026, color: 'Rojo', precio: '11200.00', costoAdquisicion: '8000.00' }, adminId,
      ));
    }
    await s.caja.abrir({ montoInicial: '0' }, adminId);
  });

  after(() => desconectarPrisma());

  const vender = (moto) =>
    s.pos.registrarVenta({ cliente: { nombre: 'Mostrador' }, items: [{ motocicletaId: moto.id }], pago: { metodo: 'EFECTIVO' } }, adminId);

  it('ventas simultáneas reciben correlativos distintos y consecutivos', async () => {
    await Promise.all(motos.map(vender));
    const numeros = (await prisma.factura.findMany({ orderBy: { numero: 'asc' } })).map((f) => f.numero);
    assert.deepEqual(numeros, [1, 2, 3, 4]);
  });

  it('el índice parcial impide dos facturas vigentes para la misma venta', async () => {
    const venta = await vender(motos[0]);
    const factura = await prisma.factura.findFirst({ where: { ventaId: venta.id }, include: { lineas: true } });
    const { id, lineas, ...copia } = factura;
    await assert.rejects(prisma.factura.create({ data: { ...copia, numero: 99 } }), (e) => e.code === 'P2002');
  });

  it('anular y reemitir deja una anulada y una vigente', async () => {
    const venta = await vender(motos[0]);
    await s.facturacion.anular(venta.facturas[0].id, { motivo: 'Prueba' }, adminId);
    await s.facturacion.reemitir({ ventaId: venta.id }, adminId);
    const estados = (await prisma.factura.findMany({ where: { ventaId: venta.id }, orderBy: { id: 'asc' } })).map((f) => f.estado);
    assert.deepEqual(estados, ['ANULADA', 'EMITIDA']);
  });

  it('el reporte de rendimiento calcula el margen con datos reales', async () => {
    await vender(motos[0]);
    const hoy = fechaGuatemala(new Date());
    const r = await s.reportes.rendimiento({ desde: hoy, hasta: hoy });
    assert.equal(r.ingresosConIva, '11200.00');
    assert.equal(r.ingresosSinIva, '10000.00');
    assert.equal(r.margenBruto, '2000.00');
  });
});
