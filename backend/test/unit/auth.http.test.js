// RF 01 por HTTP: endpoints de autenticación y protección de rutas por rol.
// Usa el repositorio en memoria, así que no necesita base de datos.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { levantarServidor } from '../ayudantes/servidor.js';
import { crearRepositorioUsuariosFalso } from './repositorio-falso.js';
import { crearServicioContrasenas } from '../../src/utils/contrasenas.js';

const cliente = { nombre: 'Luis Gómez', correo: 'luis@correo.com', contrasena: 'clave-cliente-1' };
const admin = { nombre: 'Admin', correo: 'admin@motostore.gt', contrasena: 'clave-admin-123' };

describe('RF 01 · API de autenticación y roles', () => {
  let api;
  let repositorio;

  before(async () => {
    repositorio = crearRepositorioUsuariosFalso();
    const hash = await crearServicioContrasenas(4).cifrar(admin.contrasena);
    await repositorio.crearAdministrador({ nombre: admin.nombre, correo: admin.correo, hashContrasena: hash });
    api = await levantarServidor({ repositorioUsuarios: repositorio });
  });
  after(() => api.cerrar());

  it('POST /api/auth/registro crea un cliente (201) sin exponer el hash', async () => {
    const { estado, cuerpo } = await api.pedir('POST', '/api/auth/registro', { cuerpo: cliente });
    assert.equal(estado, 201);
    assert.equal(cuerpo.usuario.rol, 'CLIENTE');
    assert.ok(cuerpo.token);
    assert.equal(JSON.stringify(cuerpo).includes('hash'), false);
  });

  it('POST /api/auth/registro con correo repetido responde 409', async () => {
    const { estado, cuerpo } = await api.pedir('POST', '/api/auth/registro', { cuerpo: cliente });
    assert.equal(estado, 409);
    assert.ok(cuerpo.error.mensaje);
  });

  it('POST /api/auth/registro con datos inválidos responde 400 con detalles', async () => {
    const { estado, cuerpo } = await api.pedir('POST', '/api/auth/registro', { cuerpo: { correo: 'x' } });
    assert.equal(estado, 400);
    assert.ok(Array.isArray(cuerpo.error.detalles));
  });

  it('un JSON mal formado responde 400', async () => {
    const { estado } = await api.pedir('POST', '/api/auth/registro', { crudo: '{"nombre":' });
    assert.equal(estado, 400);
  });

  it('POST /api/auth/login entrega un token; con clave incorrecta responde 401', async () => {
    const bien = await api.pedir('POST', '/api/auth/login', { cuerpo: cliente });
    assert.equal(bien.estado, 200);
    assert.ok(bien.cuerpo.token);

    const mal = await api.pedir('POST', '/api/auth/login', { cuerpo: { ...cliente, contrasena: 'incorrecta-1' } });
    assert.equal(mal.estado, 401);
  });

  it('GET /api/auth/perfil exige token (401) y lo devuelve con token válido', async () => {
    assert.equal((await api.pedir('GET', '/api/auth/perfil')).estado, 401);
    assert.equal((await api.pedir('GET', '/api/auth/perfil', { token: 'falso' })).estado, 401);

    const { cuerpo } = await api.pedir('POST', '/api/auth/login', { cuerpo: cliente });
    const perfil = await api.pedir('GET', '/api/auth/perfil', { token: cuerpo.token });
    assert.equal(perfil.estado, 200);
    assert.equal(perfil.cuerpo.usuario.correo, cliente.correo);
  });

  it('un token deja de servir si la cuenta se desactiva', async () => {
    const { cuerpo } = await api.pedir('POST', '/api/auth/login', { cuerpo: cliente });
    const usuario = repositorio.usuarios.find((u) => u.correo === cliente.correo);
    usuario.activo = false;
    const perfil = await api.pedir('GET', '/api/auth/perfil', { token: cuerpo.token });
    usuario.activo = true;
    assert.equal(perfil.estado, 401);
  });

  describe('POST /api/usuarios (solo administradores, PA-3)', () => {
    const nuevoAdmin = { nombre: 'Otro Admin', correo: 'otro@motostore.gt', contrasena: 'clave-admin-456' };

    it('sin token responde 401', async () => {
      assert.equal((await api.pedir('POST', '/api/usuarios', { cuerpo: nuevoAdmin })).estado, 401);
    });

    it('con token de cliente responde 403', async () => {
      const { cuerpo } = await api.pedir('POST', '/api/auth/login', { cuerpo: cliente });
      const respuesta = await api.pedir('POST', '/api/usuarios', { cuerpo: nuevoAdmin, token: cuerpo.token });
      assert.equal(respuesta.estado, 403);
    });

    it('con token de administrador crea un administrador (201)', async () => {
      const { cuerpo } = await api.pedir('POST', '/api/auth/login', { cuerpo: admin });
      const respuesta = await api.pedir('POST', '/api/usuarios', { cuerpo: nuevoAdmin, token: cuerpo.token });
      assert.equal(respuesta.estado, 201);
      assert.equal(respuesta.cuerpo.usuario.rol, 'ADMINISTRADOR');
    });
  });

  it('una ruta inexistente responde 404 en JSON', async () => {
    const { estado, cuerpo } = await api.pedir('GET', '/api/no-existe');
    assert.equal(estado, 404);
    assert.ok(cuerpo.error.mensaje);
  });
});
