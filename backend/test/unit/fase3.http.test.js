// Fase 3 por HTTP: RN 3 (checkout con sesión), subida de comprobantes, RN 4, RN 5 y permisos por rol.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { crearApp } from '../../src/app.js';
import { crearServicioContrasenas } from '../../src/utils/contrasenas.js';
import { crearServicioCatalogo } from '../../src/modulos/catalogo/catalogo.servicio.js';
import { crearBaseFalsa } from '../ayudantes/base-falsa.js';
import { HOY, PDF, crearAlmacenFalso } from '../ayudantes/escenario-ventas.js';
import { crearRepositorioUsuariosFalso } from './repositorio-falso.js';

const CLAVE = 'clave-segura-123';

describe('Fase 3 · API de ventas, caja y POS', () => {
  let servidor;
  let base;
  let url;
  const tokens = {};
  let motoId;
  let otraMotoId;

  const pedir = async (metodo, ruta, { cuerpo, token, formulario } = {}) => {
    const cabeceras = token ? { authorization: `Bearer ${token}` } : {};
    if (cuerpo !== undefined) cabeceras['content-type'] = 'application/json';
    const r = await fetch(url + ruta, { method: metodo, headers: cabeceras, body: formulario ?? (cuerpo && JSON.stringify(cuerpo)) });
    const tipo = r.headers.get('content-type') ?? '';
    return { estado: r.status, tipo, cuerpo: tipo.includes('json') ? await r.json() : Buffer.from(await r.arrayBuffer()) };
  };
  const formularioCon = (contenido, nombre = 'comprobante.pdf') => {
    const f = new FormData();
    f.append('comprobante', new Blob([contenido]), nombre);
    return f;
  };

  before(async () => {
    const usuarios = crearRepositorioUsuariosFalso();
    const hash = await crearServicioContrasenas(4).cifrar(CLAVE);
    await usuarios.crearAdministrador({ nombre: 'Admin', correo: 'admin@motostore.gt', hashContrasena: hash });
    await usuarios.crearCliente({ nombre: 'Ana', correo: 'ana@correo.com', hashContrasena: hash });
    await usuarios.crearCliente({ nombre: 'Beto', correo: 'beto@correo.com', hashContrasena: hash });

    base = crearBaseFalsa();
    await base.repos.clientes.crear({ nombre: 'Ana', usuarioId: 2 });
    await base.repos.clientes.crear({ nombre: 'Beto', usuarioId: 3 });
    const catalogo = crearServicioCatalogo({ datos: base });
    const marca = await catalogo.crearMarca({ nombre: 'Honda' });
    const modelo = await catalogo.crearModelo({ marcaId: marca.id, nombre: 'Navi', cilindrada: 109 });
    motoId = (await catalogo.crearMotocicleta({ vin: 'MLHJF8000P5000001', modeloId: modelo.id, anio: 2026, color: 'Rojo', precio: '11200' }, 1)).id;
    otraMotoId = (await catalogo.crearMotocicleta({ vin: 'MLHJF8000P5000002', modeloId: modelo.id, anio: 2026, color: 'Azul', precio: '11200' }, 1)).id;

    const app = crearApp({ repositorioUsuarios: usuarios, datos: base, almacen: crearAlmacenFalso(), reloj: () => HOY });
    servidor = await new Promise((resolver) => { const s = app.listen(0, () => resolver(s)); });
    url = `http://127.0.0.1:${servidor.address().port}`;

    for (const [clave, correo] of [['admin', 'admin@motostore.gt'], ['ana', 'ana@correo.com'], ['beto', 'beto@correo.com']]) {
      tokens[clave] = (await pedir('POST', '/api/auth/login', { cuerpo: { correo, contrasena: CLAVE } })).cuerpo.token;
    }
  });
  after(() => new Promise((resolver) => servidor.close(resolver)));

  let ventaId;
  let comprobanteId;

  it('cotizar es público (el carrito no necesita sesión)', async () => {
    const r = await pedir('POST', '/api/checkout/cotizar', { cuerpo: { items: [{ motocicletaId: motoId }] } });
    assert.equal(r.estado, 200);
    assert.equal(r.cuerpo.iva, '1200.00');
  });

  it('RN 3: el checkout exige sesión de cliente (401 sin token, 403 para un administrador)', async () => {
    const cuerpo = { items: [{ motocicletaId: motoId }], metodoPago: 'TRANSFERENCIA' };
    assert.equal((await pedir('POST', '/api/checkout', { cuerpo })).estado, 401);
    assert.equal((await pedir('POST', '/api/checkout', { cuerpo, token: tokens.admin })).estado, 403);
    const r = await pedir('POST', '/api/checkout', { cuerpo, token: tokens.ana });
    assert.equal(r.estado, 201);
    ventaId = r.cuerpo.venta.id;
  });

  it('PA-8: rechaza un archivo que no es imagen ni PDF y uno de más de 5 MB', async () => {
    const texto = await pedir('POST', `/api/ventas/${ventaId}/comprobante`, { formulario: formularioCon(Buffer.from('hola'), 'x.pdf'), token: tokens.ana });
    assert.equal(texto.estado, 400);
    const grande = Buffer.concat([PDF, Buffer.alloc(5 * 1024 * 1024)]);
    const r = await pedir('POST', `/api/ventas/${ventaId}/comprobante`, { formulario: formularioCon(grande), token: tokens.ana });
    assert.equal(r.estado, 400);
  });

  it('el cliente sube el comprobante; otro cliente no puede', async () => {
    assert.equal((await pedir('POST', `/api/ventas/${ventaId}/comprobante`, { formulario: formularioCon(PDF), token: tokens.beto })).estado, 404);
    const r = await pedir('POST', `/api/ventas/${ventaId}/comprobante`, { formulario: formularioCon(PDF), token: tokens.ana });
    assert.equal(r.estado, 201);
    comprobanteId = r.cuerpo.venta.comprobantes[0].id;
  });

  it('el archivo del comprobante lo ven el dueño y el administrador, con su tipo real', async () => {
    const r = await pedir('GET', `/api/comprobantes/${comprobanteId}/archivo`, { token: tokens.ana });
    assert.equal(r.estado, 200);
    assert.equal(r.tipo, 'application/pdf');
    assert.equal((await pedir('GET', `/api/comprobantes/${comprobanteId}/archivo`, { token: tokens.beto })).estado, 404);
  });

  it('RN 4 + RF 05: aprobar exige caja abierta; al aprobar se puede despachar', async () => {
    assert.equal((await pedir('PATCH', `/api/comprobantes/${comprobanteId}/aprobar`, { token: tokens.ana })).estado, 403);
    assert.equal((await pedir('PATCH', `/api/ventas/${ventaId}/entregar`, { token: tokens.admin })).estado, 409);
    assert.equal((await pedir('PATCH', `/api/comprobantes/${comprobanteId}/aprobar`, { token: tokens.admin })).estado, 409);

    assert.equal((await pedir('POST', '/api/caja/apertura', { cuerpo: { montoInicial: '500' }, token: tokens.admin })).estado, 201);
    const aprobada = await pedir('PATCH', `/api/comprobantes/${comprobanteId}/aprobar`, { token: tokens.admin });
    assert.equal(aprobada.estado, 200);
    assert.equal(aprobada.cuerpo.venta.estado, 'PAGADA');
    assert.equal((await pedir('PATCH', `/api/ventas/${ventaId}/entregar`, { token: tokens.admin })).cuerpo.venta.estado, 'ENTREGADA');
  });

  it('POS y caja son solo para administradores; la venta entra al cuadre', async () => {
    const cuerpo = { cliente: { nombre: 'Mostrador' }, items: [{ motocicletaId: otraMotoId }], pago: { metodo: 'EFECTIVO' } };
    assert.equal((await pedir('POST', '/api/pos/ventas', { cuerpo })).estado, 401);
    assert.equal((await pedir('POST', '/api/pos/ventas', { cuerpo, token: tokens.ana })).estado, 403);
    assert.equal((await pedir('GET', '/api/caja/actual', { token: tokens.ana })).estado, 403);

    const venta = await pedir('POST', '/api/pos/ventas', { cuerpo, token: tokens.admin });
    assert.equal(venta.estado, 201);
    const { cuerpo: actual } = await pedir('GET', '/api/caja/actual', { token: tokens.admin });
    assert.equal(actual.resumen.efectivoEsperado, '11700.00');
    assert.equal(actual.resumen.transferencias, '11200.00');
  });

  it('RN 2 por HTTP: la moto vendida en el POS ya no se puede comprar en la web', async () => {
    const r = await pedir('POST', '/api/checkout', { cuerpo: { items: [{ motocicletaId: otraMotoId }], metodoPago: 'TRANSFERENCIA' }, token: tokens.beto });
    assert.equal(r.estado, 409);
  });

  it('el cliente ve su historial y los cupones son solo para administradores', async () => {
    const r = await pedir('GET', '/api/mis-compras', { token: tokens.ana });
    assert.equal(r.cuerpo.ventas.length, 1);
    assert.equal(r.cuerpo.ventas[0].estado, 'ENTREGADA');
    assert.equal((await pedir('GET', '/api/cupones', { token: tokens.ana })).estado, 403);
  });
});
