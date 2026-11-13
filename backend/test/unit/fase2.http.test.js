// Fase 2 por HTTP: el catálogo es público; modificarlo, el inventario y las compras son solo para administradores.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { levantarServidor } from '../ayudantes/servidor.js';
import { crearBaseFalsa } from '../ayudantes/base-falsa.js';
import { crearRepositorioUsuariosFalso } from './repositorio-falso.js';
import { crearServicioContrasenas } from '../../src/utils/contrasenas.js';

const CLAVE = 'clave-segura-123';

describe('Fase 2 · API de catálogo, inventario y compras', () => {
  let api;
  let tokenAdmin;
  let tokenCliente;
  let modeloId;

  before(async () => {
    const usuarios = crearRepositorioUsuariosFalso();
    const hash = await crearServicioContrasenas(4).cifrar(CLAVE);
    await usuarios.crearAdministrador({ nombre: 'Admin', correo: 'admin@motostore.gt', hashContrasena: hash });
    await usuarios.crearCliente({ nombre: 'Cliente', correo: 'cliente@correo.com', hashContrasena: hash });
    api = await levantarServidor({ repositorioUsuarios: usuarios, datos: crearBaseFalsa() });

    const login = async (correo) => (await api.pedir('POST', '/api/auth/login', { cuerpo: { correo, contrasena: CLAVE } })).cuerpo.token;
    tokenAdmin = await login('admin@motostore.gt');
    tokenCliente = await login('cliente@correo.com');

    const marca = await api.pedir('POST', '/api/marcas', { cuerpo: { nombre: 'Bajaj' }, token: tokenAdmin });
    const modelo = await api.pedir('POST', '/api/modelos', {
      cuerpo: { marcaId: marca.cuerpo.marca.id, nombre: 'Pulsar NS200', cilindrada: 199, stockMinimo: 1 },
      token: tokenAdmin,
    });
    modeloId = modelo.cuerpo.modelo.id;
  });
  after(() => api.cerrar());

  const moto = (vin) => ({ vin, modeloId, anio: 2026, color: 'Gris', precio: 21500 });

  it('POST /api/motocicletas: 401 sin sesión, 403 para clientes, 201 para administradores', async () => {
    assert.equal((await api.pedir('POST', '/api/motocicletas', { cuerpo: moto('MD2A36FZ0RCA00001') })).estado, 401);
    assert.equal(
      (await api.pedir('POST', '/api/motocicletas', { cuerpo: moto('MD2A36FZ0RCA00001'), token: tokenCliente })).estado,
      403,
    );
    const creada = await api.pedir('POST', '/api/motocicletas', { cuerpo: moto('MD2A36FZ0RCA00001'), token: tokenAdmin });
    assert.equal(creada.estado, 201);
    assert.equal(creada.cuerpo.motocicleta.precio, '21500.00');
  });

  it('RN 1 por HTTP: un VIN repetido responde 409', async () => {
    const repetida = await api.pedir('POST', '/api/motocicletas', { cuerpo: moto('MD2A36FZ0RCA00001'), token: tokenAdmin });
    assert.equal(repetida.estado, 409);
  });

  it('GET /api/motocicletas es público y filtra', async () => {
    const { estado, cuerpo } = await api.pedir('GET', `/api/motocicletas?cilindradaMax=200&precioMax=22000`);
    assert.equal(estado, 200);
    assert.equal(cuerpo.total, 1);
    assert.equal(cuerpo.motocicletas[0].costoAdquisicion, undefined);
  });

  it('un :id que no es número responde 400 y uno inexistente 404', async () => {
    assert.equal((await api.pedir('GET', '/api/motocicletas/abc')).estado, 400);
    assert.equal((await api.pedir('GET', '/api/motocicletas/999')).estado, 404);
  });

  it('el inventario es solo para administradores', async () => {
    assert.equal((await api.pedir('GET', '/api/inventario/alertas')).estado, 401);
    assert.equal((await api.pedir('GET', '/api/inventario/alertas', { token: tokenCliente })).estado, 403);
    const { estado, cuerpo } = await api.pedir('GET', '/api/inventario/alertas', { token: tokenAdmin });
    assert.equal(estado, 200);
    assert.equal(cuerpo.modelos[0].disponibles, 1);
  });

  it('flujo de compra completo: proveedor → orden → envío → recepción', async () => {
    assert.equal((await api.pedir('GET', '/api/proveedores', { token: tokenCliente })).estado, 403);

    const proveedor = await api.pedir('POST', '/api/proveedores', {
      cuerpo: { nombre: 'Bajaj Auto', tipo: 'INTERNACIONAL', pais: 'India' },
      token: tokenAdmin,
    });
    assert.equal(proveedor.estado, 201);

    const orden = await api.pedir('POST', '/api/ordenes-compra', {
      cuerpo: { proveedorId: proveedor.cuerpo.proveedor.id, detalles: [{ modeloId, cantidad: 1, costoUnitario: '15000.00' }] },
      token: tokenAdmin,
    });
    assert.equal(orden.estado, 201);
    const { id, detalles } = orden.cuerpo.orden;

    await api.pedir('PATCH', `/api/ordenes-compra/${id}/estado`, { cuerpo: { estado: 'ENVIADA' }, token: tokenAdmin });
    const recepcion = await api.pedir('POST', `/api/ordenes-compra/${id}/recepciones`, {
      cuerpo: { lineas: [{ detalleId: detalles[0].id, motocicletas: [moto('MD2A36FZ0RCA00002')] }] },
      token: tokenAdmin,
    });
    assert.equal(recepcion.estado, 201);
    assert.equal(recepcion.cuerpo.orden.estado, 'RECIBIDA');
    assert.equal(recepcion.cuerpo.motocicletas[0].costoAdquisicion, '15000.00');
  });
});
