// Ampliación por HTTP: subir la imagen es solo para administradores; verla es público y se sirve con cabeceras seguras.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { crearApp } from '../../src/app.js';
import { crearServicioContrasenas } from '../../src/utils/contrasenas.js';
import { crearServicioCatalogo } from '../../src/modulos/catalogo/catalogo.servicio.js';
import { crearBaseFalsa } from '../ayudantes/base-falsa.js';
import { PNG, crearAlmacenFalso } from '../ayudantes/escenario-ventas.js';
import { crearRepositorioUsuariosFalso } from './repositorio-falso.js';

const CLAVE = 'clave-segura-123';

describe('Imágenes de modelos por HTTP', () => {
  let servidor;
  let url;
  let modeloId;
  const tokens = {};

  const pedir = async (metodo, ruta, { token, archivo } = {}) => {
    let body;
    if (archivo) { body = new FormData(); body.append('imagen', new Blob([archivo]), 'foto.png'); }
    const r = await fetch(url + ruta, { method: metodo, headers: token ? { authorization: `Bearer ${token}` } : {}, body });
    return { estado: r.status, cabeceras: r.headers, cuerpo: (r.headers.get('content-type') ?? '').includes('json') ? await r.json() : Buffer.from(await r.arrayBuffer()) };
  };

  before(async () => {
    const usuarios = crearRepositorioUsuariosFalso();
    const hash = await crearServicioContrasenas(4).cifrar(CLAVE);
    await usuarios.crearAdministrador({ nombre: 'Admin', correo: 'admin@motostore.gt', hashContrasena: hash });
    await usuarios.crearCliente({ nombre: 'Ana', correo: 'ana@correo.com', hashContrasena: hash });
    const base = crearBaseFalsa();
    const catalogo = crearServicioCatalogo({ datos: base });
    const marca = await catalogo.crearMarca({ nombre: 'Honda' });
    modeloId = (await catalogo.crearModelo({ marcaId: marca.id, nombre: 'Navi', cilindrada: 109 })).id;

    const app = crearApp({ repositorioUsuarios: usuarios, datos: base, almacen: crearAlmacenFalso(), almacenImagenes: crearAlmacenFalso() });
    servidor = await new Promise((r) => { const s = app.listen(0, () => r(s)); });
    url = `http://127.0.0.1:${servidor.address().port}`;
    for (const [k, correo] of [['admin', 'admin@motostore.gt'], ['ana', 'ana@correo.com']]) {
      const r = await fetch(`${url}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ correo, contrasena: CLAVE }) });
      tokens[k] = (await r.json()).token;
    }
  });
  after(() => new Promise((r) => servidor.close(r)));

  it('subir la imagen: 401 sin sesión, 403 para clientes, 200 para administradores', async () => {
    assert.equal((await pedir('PUT', `/api/modelos/${modeloId}/imagen`, { archivo: PNG })).estado, 401);
    assert.equal((await pedir('PUT', `/api/modelos/${modeloId}/imagen`, { archivo: PNG, token: tokens.ana })).estado, 403);
    const r = await pedir('PUT', `/api/modelos/${modeloId}/imagen`, { archivo: PNG, token: tokens.admin });
    assert.equal(r.estado, 200);
    assert.equal(r.cuerpo.modelo.imagenUrl, '/api/imagenes/archivo-1.png');
  });

  it('la imagen es pública y se sirve con su tipo y cabeceras de seguridad', async () => {
    const r = await pedir('GET', '/api/imagenes/archivo-1.png');
    assert.equal(r.estado, 200);
    assert.equal(r.cabeceras.get('content-type'), 'image/png');
    assert.equal(r.cabeceras.get('x-content-type-options'), 'nosniff');
    assert.match(r.cabeceras.get('content-security-policy'), /sandbox/);
    assert.equal(r.cuerpo.length, PNG.length);
  });

  it('un archivo que no es imagen responde 400 y un nombre raro responde 404', async () => {
    assert.equal((await pedir('PUT', `/api/modelos/${modeloId}/imagen`, { archivo: Buffer.from('hola'), token: tokens.admin })).estado, 400);
    assert.equal((await pedir('GET', '/api/imagenes/..%2F.env')).estado, 404);
  });

  it('quitar la imagen es solo para administradores', async () => {
    assert.equal((await pedir('DELETE', `/api/modelos/${modeloId}/imagen`, { token: tokens.ana })).estado, 403);
    const r = await pedir('DELETE', `/api/modelos/${modeloId}/imagen`, { token: tokens.admin });
    assert.equal(r.cuerpo.modelo.imagenUrl, null);
  });
});
