// Fase 4 por HTTP: facturas (RF 08) y reportes (RF 10), con permisos por rol.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { levantarServidor } from '../ayudantes/servidor.js';
import { crearBaseFalsa } from '../ayudantes/base-falsa.js';
import { HOY, crearAlmacenFalso } from '../ayudantes/escenario-ventas.js';
import { crearRepositorioUsuariosFalso } from './repositorio-falso.js';
import { crearServicioContrasenas } from '../../src/utils/contrasenas.js';
import { crearServicioCatalogo } from '../../src/modulos/catalogo/catalogo.servicio.js';

const CLAVE = 'clave-segura-123';

describe('Fase 4 · API de facturación y reportes', () => {
  let api;
  const tokens = {};
  let ventaWeb;
  let facturaPosId;

  before(async () => {
    const usuarios = crearRepositorioUsuariosFalso();
    const hash = await crearServicioContrasenas(4).cifrar(CLAVE);
    await usuarios.crearAdministrador({ nombre: 'Admin', correo: 'admin@motostore.gt', hashContrasena: hash });
    await usuarios.crearCliente({ nombre: 'Ana', correo: 'ana@correo.com', hashContrasena: hash });
    await usuarios.crearCliente({ nombre: 'Beto', correo: 'beto@correo.com', hashContrasena: hash });

    const base = crearBaseFalsa();
    await base.repos.clientes.crear({ nombre: 'Ana', usuarioId: 2 });
    await base.repos.clientes.crear({ nombre: 'Beto', usuarioId: 3 });
    const catalogo = crearServicioCatalogo({ datos: base });
    const marca = await catalogo.crearMarca({ nombre: 'Italika' });
    const modelo = await catalogo.crearModelo({ marcaId: marca.id, nombre: 'FT150', cilindrada: 150 });
    const motos = [];
    for (const n of [1, 2]) {
      motos.push(await catalogo.crearMotocicleta({ vin: `3SCPFTDE0P100000${n}`, modeloId: modelo.id, anio: 2026, color: 'Negro', precio: '11200', costoAdquisicion: '8000' }, 1));
    }

    api = await levantarServidor({ repositorioUsuarios: usuarios, datos: base, almacen: crearAlmacenFalso(), reloj: () => HOY });
    for (const [clave, correo] of [['admin', 'admin@motostore.gt'], ['ana', 'ana@correo.com'], ['beto', 'beto@correo.com']]) {
      tokens[clave] = (await api.pedir('POST', '/api/auth/login', { cuerpo: { correo, contrasena: CLAVE } })).cuerpo.token;
    }

    await api.pedir('POST', '/api/caja/apertura', { cuerpo: { montoInicial: '0' }, token: tokens.admin });
    const pos = await api.pedir('POST', '/api/pos/ventas', {
      cuerpo: { cliente: { nombre: 'Mostrador' }, items: [{ motocicletaId: motos[0].id }], pago: { metodo: 'EFECTIVO' } },
      token: tokens.admin,
    });
    facturaPosId = pos.cuerpo.venta.facturas[0].id;

    const pedido = await api.pedir('POST', '/api/checkout', { cuerpo: { items: [{ motocicletaId: motos[1].id }], metodoPago: 'POS_AL_RETIRAR' }, token: tokens.ana });
    ventaWeb = (await api.pedir('POST', `/api/ventas/${pedido.cuerpo.venta.id}/cobro`, { cuerpo: { metodo: 'EFECTIVO' }, token: tokens.admin })).cuerpo.venta;
  });
  after(() => api.cerrar());

  it('la venta cobrada muestra su factura emitida (estado de facturación)', () => {
    assert.equal(ventaWeb.facturas[0].estado, 'EMITIDA');
    assert.equal(ventaWeb.facturas[0].numeroCompleto, 'A-00000002');
  });

  it('GET /api/mis-facturas: el cliente ve las suyas; el administrador no usa esta ruta', async () => {
    const r = await api.pedir('GET', '/api/mis-facturas', { token: tokens.ana });
    assert.equal(r.estado, 200);
    assert.equal(r.cuerpo.total, 1);
    assert.equal((await api.pedir('GET', '/api/mis-facturas', { token: tokens.beto })).cuerpo.total, 0);
    assert.equal((await api.pedir('GET', '/api/mis-facturas', { token: tokens.admin })).estado, 403);
  });

  it('GET /api/facturas/:id: el dueño y el administrador la ven, otro cliente recibe 404', async () => {
    const id = ventaWeb.facturas[0].id;
    assert.equal((await api.pedir('GET', `/api/facturas/${id}`, { token: tokens.ana })).estado, 200);
    assert.equal((await api.pedir('GET', `/api/facturas/${id}`, { token: tokens.beto })).estado, 404);
    assert.equal((await api.pedir('GET', `/api/facturas/${facturaPosId}`, { token: tokens.admin })).cuerpo.factura.receptor.nit, 'CF');
  });

  it('anular y reemitir son solo para administradores', async () => {
    assert.equal((await api.pedir('PATCH', `/api/facturas/${facturaPosId}/anular`, { cuerpo: { motivo: 'x' }, token: tokens.ana })).estado, 403);
    assert.equal((await api.pedir('PATCH', `/api/facturas/${facturaPosId}/anular`, { cuerpo: { motivo: 'Datos erróneos' }, token: tokens.admin })).estado, 200);
    const nueva = await api.pedir('POST', '/api/facturas', { cuerpo: { ventaId: 1, nit: '1234567-8', nombre: 'Empresa S.A.' }, token: tokens.admin });
    assert.equal(nueva.estado, 201);
    assert.equal(nueva.cuerpo.factura.numeroCompleto, 'A-00000003');
  });

  it('los reportes son solo para administradores y responden con los datos del período', async () => {
    assert.equal((await api.pedir('GET', '/api/reportes/ventas')).estado, 401);
    assert.equal((await api.pedir('GET', '/api/reportes/ventas', { token: tokens.ana })).estado, 403);

    const ventas = await api.pedir('GET', '/api/reportes/ventas?desde=2026-11-13&hasta=2026-11-13', { token: tokens.admin });
    assert.equal(ventas.estado, 200);
    assert.equal(ventas.cuerpo.resumen.total, '22400.00');

    const rendimiento = await api.pedir('GET', '/api/reportes/rendimiento?desde=2026-11-13&hasta=2026-11-13', { token: tokens.admin });
    assert.equal(rendimiento.cuerpo.costoMotocicletas, '16000.00');
    assert.equal((await api.pedir('GET', '/api/reportes/mas-vendidas', { token: tokens.admin })).cuerpo.modelos[0].unidades, 2);
    assert.equal((await api.pedir('GET', '/api/reportes/flujo-caja?desde=x', { token: tokens.admin })).estado, 400);
  });
});
