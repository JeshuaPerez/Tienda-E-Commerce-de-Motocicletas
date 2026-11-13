// Cliente HTTP de la tienda: token JWT, errores de la API en un formato único y sesión vencida.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { crearClienteApi, ErrorApi } from '../src/api/cliente.js';

const respuesta = (estado, cuerpo) =>
  new Response(cuerpo === undefined ? null : JSON.stringify(cuerpo), { status: estado, headers: { 'content-type': 'application/json' } });

describe('cliente de la API', () => {
  it('envía JSON con el token y devuelve el cuerpo', async () => {
    let peticion;
    const api = crearClienteApi({
      obtenerToken: () => 'abc',
      fetch: async (url, opciones) => { peticion = { url, ...opciones }; return respuesta(200, { ok: true }); },
    });
    const datos = await api.pedir('POST', '/checkout', { cuerpo: { a: 1 } });
    assert.deepEqual(datos, { ok: true });
    assert.equal(peticion.url, '/api/checkout');
    assert.equal(peticion.headers.authorization, 'Bearer abc');
    assert.equal(peticion.body, '{"a":1}');
  });

  it('arma la consulta omitiendo filtros vacíos', async () => {
    let url;
    const api = crearClienteApi({ fetch: async (u) => { url = u; return respuesta(200, {}); } });
    await api.pedir('GET', '/motocicletas', { consulta: { marcaId: 2, precioMin: '', cilindradaMax: undefined, pagina: 1 } });
    assert.equal(url, '/api/motocicletas?marcaId=2&pagina=1');
  });

  it('convierte un error de la API en ErrorApi con estado, mensaje y detalles', async () => {
    const api = crearClienteApi({ fetch: async () => respuesta(409, { error: { mensaje: 'No disponible', detalles: ['x'] } }) });
    await assert.rejects(api.pedir('POST', '/checkout'), (e) => {
      assert.ok(e instanceof ErrorApi);
      assert.equal(e.estado, 409);
      assert.equal(e.message, 'No disponible');
      assert.deepEqual(e.detalles, ['x']);
      return true;
    });
  });

  it('avisa cuando la sesión venció (401) para cerrarla', async () => {
    let avisado = false;
    const api = crearClienteApi({ obtenerToken: () => 't', alNoAutorizado: () => { avisado = true; }, fetch: async () => respuesta(401, { error: { mensaje: 'Sesión vencida' } }) });
    await assert.rejects(api.pedir('GET', '/mis-compras'), { estado: 401 });
    assert.ok(avisado);
  });

  it('un fallo de red se reporta como estado 0 con un mensaje claro', async () => {
    const api = crearClienteApi({ fetch: async () => { throw new TypeError('fetch failed'); } });
    await assert.rejects(api.pedir('GET', '/marcas'), { estado: 0, message: 'No se pudo conectar con el servidor' });
  });

  it('con un formulario no fija content-type (el navegador pone el boundary)', async () => {
    let cabeceras;
    const api = crearClienteApi({ fetch: async (_u, o) => { cabeceras = o.headers; return respuesta(201, {}); } });
    await api.pedir('POST', '/ventas/1/comprobante', { formulario: new FormData() });
    assert.equal(cabeceras['content-type'], undefined);
  });
});
