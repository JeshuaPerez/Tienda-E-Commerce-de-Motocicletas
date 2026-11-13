// RF 01: registro y login de clientes con bcrypt y JWT (PA-3: el registro público solo crea clientes).
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { crearServicioAuth } from '../../src/modulos/auth/auth.servicio.js';
import { crearServicioContrasenas } from '../../src/utils/contrasenas.js';
import { crearServicioTokens } from '../../src/utils/tokens.js';
import { ErrorAplicacion } from '../../src/utils/errores.js';
import { crearRepositorioUsuariosFalso } from './repositorio-falso.js';

const tokens = crearServicioTokens({ secreto: 's'.repeat(32), expira: '1h' });
const contrasenas = crearServicioContrasenas(4);
const datosValidos = { nombre: 'Ana López', correo: 'Ana@Correo.com', contrasena: 'clave-segura-1' };

const esError = (estado) => (error) => {
  assert.ok(error instanceof ErrorAplicacion, `se esperaba ErrorAplicacion y llegó ${error}`);
  assert.equal(error.estado, estado);
  return true;
};

describe('RF 01 · servicio de autenticación', () => {
  let repositorio;
  let servicio;

  beforeEach(() => {
    repositorio = crearRepositorioUsuariosFalso();
    servicio = crearServicioAuth({ repositorioUsuarios: repositorio, contrasenas, tokens });
  });

  describe('registro', () => {
    it('crea un cliente con la contraseña cifrada con bcrypt y el correo normalizado', async () => {
      const { usuario, token } = await servicio.registrarCliente(datosValidos);
      const guardado = repositorio.usuarios[0];

      assert.equal(usuario.correo, 'ana@correo.com');
      assert.equal(usuario.rol, 'CLIENTE');
      assert.notEqual(guardado.hashContrasena, datosValidos.contrasena);
      assert.match(guardado.hashContrasena, /^\$2[aby]\$/);
      assert.ok(await contrasenas.comparar(datosValidos.contrasena, guardado.hashContrasena));
      assert.equal(tokens.verificar(token).sub, usuario.id);
    });

    it('nunca devuelve el hash de la contraseña', async () => {
      const { usuario } = await servicio.registrarCliente(datosValidos);
      assert.equal(usuario.hashContrasena, undefined);
    });

    it('ignora un rol enviado por el cliente: el registro público solo crea clientes', async () => {
      const { usuario } = await servicio.registrarCliente({ ...datosValidos, rol: 'ADMINISTRADOR' });
      assert.equal(usuario.rol, 'CLIENTE');
    });

    it('rechaza un correo ya registrado, sin importar mayúsculas', async () => {
      await servicio.registrarCliente(datosValidos);
      await assert.rejects(
        servicio.registrarCliente({ ...datosValidos, correo: 'ANA@correo.com' }),
        esError(409),
      );
    });

    const invalidos = [
      ['un correo con formato inválido', { correo: 'ana-sin-arroba' }],
      ['una contraseña de menos de 8 caracteres', { contrasena: 'corta' }],
      ['un nombre vacío', { nombre: '   ' }],
      ['un cuerpo vacío', { nombre: undefined, correo: undefined, contrasena: undefined }],
    ];
    for (const [caso, cambio] of invalidos) {
      it(`rechaza ${caso}`, async () => {
        await assert.rejects(servicio.registrarCliente({ ...datosValidos, ...cambio }), esError(400));
      });
    }
  });

  describe('login', () => {
    beforeEach(() => servicio.registrarCliente(datosValidos));

    it('entrega un JWT con el id y el rol del usuario', async () => {
      const { token, usuario } = await servicio.iniciarSesion({
        correo: 'ANA@correo.com',
        contrasena: datosValidos.contrasena,
      });
      const carga = tokens.verificar(token);
      assert.equal(carga.sub, usuario.id);
      assert.equal(carga.rol, 'CLIENTE');
    });

    it('responde igual a una contraseña incorrecta y a un correo inexistente', async () => {
      const incorrecta = await servicio
        .iniciarSesion({ correo: 'ana@correo.com', contrasena: 'otra-clave-123' })
        .catch((e) => e);
      const inexistente = await servicio
        .iniciarSesion({ correo: 'nadie@correo.com', contrasena: 'otra-clave-123' })
        .catch((e) => e);

      assert.equal(incorrecta.estado, 401);
      assert.equal(inexistente.estado, 401);
      assert.equal(incorrecta.message, inexistente.message);
    });

    it('rechaza a un usuario desactivado', async () => {
      repositorio.usuarios[0].activo = false;
      await assert.rejects(
        servicio.iniciarSesion({ correo: 'ana@correo.com', contrasena: datosValidos.contrasena }),
        esError(401),
      );
    });

    it('rechaza un login sin datos', async () => {
      await assert.rejects(servicio.iniciarSesion({}), esError(400));
    });
  });
});

describe('RF 01 · tokens JWT', () => {
  it('rechaza un token firmado con otro secreto', () => {
    const ajeno = crearServicioTokens({ secreto: 'o'.repeat(32), expira: '1h' });
    const token = ajeno.firmar({ id: 1, rol: 'ADMINISTRADOR' });
    assert.throws(() => tokens.verificar(token), esError(401));
  });

  it('rechaza un token vencido', () => {
    const vencido = crearServicioTokens({ secreto: 's'.repeat(32), expira: -10 });
    const token = vencido.firmar({ id: 1, rol: 'CLIENTE' });
    assert.throws(() => tokens.verificar(token), esError(401));
  });

  it('rechaza un texto que no es un token', () => {
    assert.throws(() => tokens.verificar('no-es-un-token'), esError(401));
  });
});
